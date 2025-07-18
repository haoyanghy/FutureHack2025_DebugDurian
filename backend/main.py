from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from predict import predict_review, get_lime_explanation
from extract import extract_word

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://*",
        "http://localhost",
        "http://127.0.0.1"
        ],
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
            label, confidence = predict_review(text.strip(), review.model)
            explanation = get_lime_explanation(text.strip(), review.model)
            results.append(
                {
                    "review": text,
                    "label": label,
                    "confidence": confidence,
                    "explanation": explanation,
                }
            )

    return results

@app.post("/durian/extract")
async def extract_review(img: ImgInput):
    if not img.text.strip():
        raise HTTPException(status_code=400, detail="Image is empty")
    if img.model not in ["bert", "roberta", "electra"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid model. Choose 'bert', 'roberta', or 'electra'"
        )
    
    results = []
    texts = extract_word(img.imgPath)
    if not texts:
        raise HTTPException(status_code=400, detail="No reviews provided")
    
    # Split reviews by '|' delimiter
    reviews = texts.split("|")
    for text in reviews:
        if text.strip():
            label, confidence = predict_review(text.strip(), img.model)
            explanation = get_lime_explanation(text.strip(), img.model)
            results.append(
                {
                    "review": text,
                    "label": label,
                    "confidence": confidence,
                    "explanation": explanation,
                }
            )

    return results

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
