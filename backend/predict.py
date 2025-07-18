import torch
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
)
from lime.lime_text import LimeTextExplainer
import numpy as np
import pickle
from sentence_transformers import SentenceTransformer
from fcmeans import FCM
from umap import UMAP
from huggingface_hub import hf_hub_download

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

CLUSTER_LABEL_MAP = {
    0: "Scripted/Overwritten Fake Reviews",
    1: "Polished Positive Fake Reviews",
    2: "Template/Spam-Generated Fake Reviews",
}

# Initialize tokenizer and models
tokenizer = AutoTokenizer.from_pretrained("google-bert/bert-base-uncased")
sentence_model = SentenceTransformer("all-MiniLM-L6-v2")
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


# Load UMAP and FCM models from Hugging Face
def load_umap_model():
    path = hf_hub_download(
        repo_id="jesmine0820/fake_review_clustering_model",
        filename="umap_model.pkl",
        repo_type="model",
    )
    with open(path, "rb") as f:
        umap_model = pickle.load(f)
    if not isinstance(umap_model, UMAP):
        raise ValueError("Loaded UMAP model is not a valid UMAP instance")
    return umap_model


def load_fcm_model():
    path = hf_hub_download(
        repo_id="jesmine0820/fake_review_clustering_model",
        filename="fcm_model.pkl",
        repo_type="model",
    )
    with open(path, "rb") as f:
        fcm_model = pickle.load(f)
    if not isinstance(fcm_model, FCM):
        raise ValueError("Loaded FCM model is not a valid FCM instance")
    return fcm_model


umap_model = load_umap_model()
fcm_model = load_fcm_model()


def predict_review(text: str, model_type: str) -> tuple[str, float, str | None]:
    """
    Predict if a review is fake or genuine, return label, confidence, and cluster type (if fake).
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
        # Classification
        outputs = models[model_type](**inputs)
        probs = torch.softmax(outputs.logits, dim=1)
        confidence = (
            probs[0][1].item() if probs[0][1] > probs[0][0] else probs[0][0].item()
        )
        label = "fake" if probs[0][1] > probs[0][0] else "genuine"

        # Clustering for fake reviews
        cluster_type = None
        if label == "fake":
            # Get SentenceTransformer embeddings
            embeddings = sentence_model.encode(
                [processed_text], show_progress_bar=False
            )
            # Apply UMAP
            reduced_embeddings = umap_model.transform(embeddings)
            # Apply FCM
            cluster_idx = fcm_model.predict(reduced_embeddings)[0]
            cluster_type = CLUSTER_LABEL_MAP.get(cluster_idx, "Unknown")

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
