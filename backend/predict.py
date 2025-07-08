import torch
from transformers import (
    DistilBertForSequenceClassification,
    DistilBertTokenizer,
    AutoModel,
)
from lime.lime_text import LimeTextExplainer
import numpy as np
import re
import string


TOKENIZER_NAME = "distilbert-base-uncased"
tokenizer = DistilBertTokenizer.from_pretrained(TOKENIZER_NAME)

# Create and save a temporary model for testing purpose
MODEL_PATH = "bert.pt"
try:
    model = DistilBertForSequenceClassification.from_pretrained(
        TOKENIZER_NAME, num_labels=2
    )
    torch.save(model.state_dict(), MODEL_PATH)
except FileNotFoundError:
    print(f"Directory not found. Ensure the path exists.")
    raise

# Load model
model = DistilBertForSequenceClassification.from_pretrained(
    TOKENIZER_NAME, num_labels=2
)
model.load_state_dict(torch.load(MODEL_PATH, map_location=torch.device("cpu")))
model.eval()

# LIME explainer
explainer = LimeTextExplainer(class_names=["genuine", "fake"])


def predict_review(text: str) -> tuple[str, float]:
    """
    Predict if a review is fake or genuine and return the label and confidence.
    """
    processed_text = preprocess_text(text)
    inputs = tokenizer(
        processed_text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=512,
    )
    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.softmax(outputs.logits, dim=1)
        confidence = probs[0][1].item()  # Probability for "fake" (class 1)
        label = "fake" if probs[0][1] > probs[0][0] else "genuine"
    return label, confidence


def get_lime_explanation(text: str) -> list:
    """
    Generate LIME explanation for the review classification.
    """

    def classifier_fn(texts):
        inputs = tokenizer(
            texts, return_tensors="pt", truncation=True, padding=True, max_length=512
        )
        with torch.no_grad():
            outputs = model(**inputs)
            probs = torch.softmax(outputs.logits, dim=1)
        return probs.numpy()

    explanation = explainer.explain_instance(
        text,
        classifier_fn=classifier_fn,
        num_features=5,
        num_samples=500,
    )
    return explanation.as_list()


def preprocess_text(text: str) -> str:
    """
    Preprocess review text for BERT input.
    """
    text = text.lower()
    text = text.translate(str.maketrans("", "", string.punctuation))
    text = re.sub(r"\s+", " ", text).strip()
    return text
