# 🧠 Fake Review Detector – Chrome Extension

This Chrome Extension allows users to submit a product review and detect whether it may be fake, paid, or bot-generated using a FastAPI-powered NLP backend.

---

## 📂 Project Structure

chrome-extension/
├── manifest.json # Chrome Extension config
├── popup.html # HTML interface for user input
├── popup.js # JavaScript logic (fetches API)


---

## 🚀 Features

- Submit product reviews directly from your browser.
- Connects to a FastAPI backend for fake review classification.
- Displays prediction label, confidence score, and explanation.

---

## 🛠️ Setup Instructions

### 1. Start the FastAPI Backend

Ensure you have your FastAPI app running locally (usually on `http://localhost:8000`):

```bash
cd backend
uvicorn main:app --reload
