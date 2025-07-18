from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from predict import predict_review, get_lime_explanation
from extract import extract_word
import base64
import tempfile
import os

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*", "http://localhost", "http://127.0.0.1"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class ReviewInput(BaseModel):
    text: str
    model: str


class ImgInput(BaseModel):
    imgPath: str
    model: str


@app.post("/durian/review")
async def classify_review(review: ReviewInput):
    if not review.text.strip():
        raise HTTPException(status_code=400, detail="Review text cannot be empty")
    if review.model not in ["bert", "roberta", "electra"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid model. Choose 'bert', 'roberta', or 'electra'",
        )

    # Split reviews by '|' delimiter
    reviews = review.text.split("|")
    if not reviews:
        raise HTTPException(status_code=400, detail="No reviews provided")

    # Process each review and collect results
    results = []
    for text in reviews:
        if text.strip():
            label, confidence, cluster_type = predict_review(text.strip(), review.model)
            explanation = get_lime_explanation(text.strip(), review.model)
            results.append(
                {
                    "review": text,
                    "label": label,
                    "confidence": confidence,
                    "cluster_type": cluster_type,
                    "explanation": explanation,
                }
            )

    return results


@app.post("/durian/extract")
async def extract_review(img: ImgInput):
    if not img.imgPath.strip():
        raise HTTPException(status_code=400, detail="Image is empty")
    if img.model not in ["bert", "roberta", "electra"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid model. Choose 'bert', 'roberta', or 'electra'",
        )
    # Decode base64 and save to temp file
    try:
        image_data = base64.b64decode(img.imgPath)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp:
            temp.write(image_data)
            temp_path = temp.name
        texts = extract_word(temp_path)
        os.remove(temp_path)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Image decode or OCR failed: {str(e)}"
        )

    if not texts:
        raise HTTPException(status_code=400, detail="No reviews provided")

    return {"text": texts}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
