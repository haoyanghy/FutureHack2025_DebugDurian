from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from predict import predict_review, get_lime_explanation

app = FastAPI()


class ReviewInput(BaseModel):
    text: str


@app.post("/durian/review")
async def classify_review(review: ReviewInput):
    if not review.text.strip():
        raise HTTPException(status_code=400, detail="Review text cannot be empty")
    label, confidence = predict_review(review.text)
    explanation = get_lime_explanation(review.text)
    return {"label": label, "confidence": confidence, "explanation": explanation}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
