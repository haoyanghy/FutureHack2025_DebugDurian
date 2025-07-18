from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from predict import predict_review, get_lime_explanation

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class ReviewInput(BaseModel):
    text: str
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
            result = {
                "review": text,
                "label": label,
                "confidence": confidence,
                "explanation": explanation,
            }
            if label == "fake":
                result["cluster_type"] = cluster_type
            results.append(result)

    return results


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
