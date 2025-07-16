import torch
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
)
from lime.lime_text import LimeTextExplainer
import numpy as np

# Model configurations
MODEL_CONFIGS = {
    "bert": {
        "name": "jesmine0820/fake-review-detector-bert-base-uncased",
        "class_names": ["genuine", "fake"],
    },
    "roberta": {
        "name": "jesmine0820/fake-review-detector-roberta-base",
        "class_names": ["genuine", "fake"],
    },
    "electra": {
        "name": "jesmine0820/fake-review-detector-google",
        "class_names": ["genuine", "fake"],
    },
}

# Initialize single tokenizer and models
tokenizer = AutoTokenizer.from_pretrained("google-bert/bert-base-uncased")
models = {}
explainers = {}

for model_type in MODEL_CONFIGS:
    models[model_type] = AutoModelForSequenceClassification.from_pretrained(
        MODEL_CONFIGS[model_type]["name"], num_labels=2
    )
    models[model_type].eval()
    explainers[model_type] = LimeTextExplainer(
        class_names=MODEL_CONFIGS[model_type]["class_names"]
    )


def predict_review(text: str, model_type: str) -> tuple[str, float]:
    """
    Predict if a review is fake or genuine and return the label and confidence.
    """
    if model_type not in MODEL_CONFIGS:
        raise ValueError(f"Invalid model type: {model_type}")

    processed_text = text.replace("\n", " ").strip()
    inputs = tokenizer(
        processed_text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=512,
    )
    with torch.no_grad():
        outputs = models[model_type](**inputs)
        probs = torch.softmax(outputs.logits, dim=1)
        confidence = probs[0][1].item()  # Probability for "fake" (class 1)
        label = "fake" if probs[0][1] > probs[0][0] else "genuine"
    return label, confidence


def get_lime_explanation(text: str, model_type: str) -> list:
    """
    Generate LIME explanation for the review classification.
    """
    if model_type not in MODEL_CONFIGS:
        raise ValueError(f"Invalid model type: {model_type}")

    def classifier_fn(texts):
        inputs = tokenizer(
            texts, return_tensors="pt", truncation=True, padding=True, max_length=512
        )
        with torch.no_grad():
            outputs = models[model_type](**inputs)
            probs = torch.softmax(outputs.logits, dim=1)
        return probs.numpy()

    processed_text = text.replace("\n", " ").strip()
    explanation = explainers[model_type].explain_instance(
        processed_text,
        classifier_fn=classifier_fn,
        num_features=5,
        num_samples=500,
    )
    return explanation.as_list()
