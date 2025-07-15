from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from predict import predict_review, get_lime_explanation

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["chrome-extension://*"],  # Extension's origin
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],  # Allow POST and OPTIONS (for preflight)
    allow_headers=["Content-Type"],  # Allow Content-Type header
)


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
