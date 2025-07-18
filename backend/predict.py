import torch
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
)
from lime.lime_text import LimeTextExplainer
from typing import List, Dict, Any
import numpy as np
import re

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


def predict_batch(texts: List[str], model_type: str) -> List[Dict[str, Any]]:
    results = []
    for text in texts:
        try:
            label, confidence = predict_review(text, model_type)
            explanation = get_lime_explanation(text, model_type)
            cluster_type = None
            if label == "fake":
                cluster_type = detect_cluster_type(text)
                results.append(
                    {
                        "review": text,
                        "label": label,
                        "confidence": confidence,
                        "cluster_type": cluster_type,
                        "explanation": explanation,
                    }
                )
        except Exception as e:
            results.append({"review": text, "error": str(e)})
    return results


def predict_review(text: str, model_type: str) -> tuple[str, float, str]:
    """
    Predict if a review is fake or genuine and return the label, confidence, and cluster type.
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
        cluster_type = detect_cluster_type(text) if label == "fake" else None
    return label, confidence, cluster_type


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


def detect_cluster_type(text: str) -> str:
    """
    Classify fake reviews into categories: spam, overly_positive, overly_negative, too_short, or generic_fake.
    """
    text_lower = text.lower().strip()
    words = text_lower.split()

    spam_indicators = [
        r"http[s]?://",  # URLs
        r"\.{2,}",
        r"!{2,}",
        r"\?{2,}",  # Excessive punctuation
        r"\b(buy now|discount|free|click here|visit|deal|offer)\b",  # Promotional phrases
    ]
    if any(re.search(pattern, text_lower) for pattern in spam_indicators):
        return "Spam"

    word_counts = {}
    for word in words:
        word_counts[word] = word_counts.get(word, 0) + 1
    if any(count >= 3 for count in word_counts.values()) and len(words) < 20:
        return "Spam"

    positive_keywords = [
        "excellent",
        "amazing",
        "perfect",
        "fantastic",
        "great",
        "awesome",
        "wonderful",
        "superb",
        "outstanding",
        "best",
    ]
    negative_keywords = [
        "worst",
        "terrible",
        "awful",
        "horrible",
        "bad",
        "poor",
        "disappointing",
        "useless",
        "trash",
        "lousy",
    ]

    pos_count = sum(1 for word in words if word in positive_keywords)
    neg_count = sum(1 for word in words if word in negative_keywords)

    net_sentiment = pos_count - neg_count

    if pos_count >= 2 and net_sentiment > 0:
        return "Overly positive"
    elif neg_count >= 2 and net_sentiment < 0:
        return "Overly negative"

    if len(words) < 5:
        generic_phrases = ["good product", "nice", "okay", "works well", "not bad"]
        if any(phrase in text_lower for phrase in generic_phrases):
            return "Too short"
    return "Generic fake"
