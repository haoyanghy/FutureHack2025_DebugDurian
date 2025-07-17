# Fake Review Detector - Debug Durian

## Overview

Fake Review Detector is a Chrome extension developed by Team Debug Durian for a hackathon addressing the problem statement: _Fake Review & Fraud Detection_. It leverages advanced NLP models to identify fake product reviews on e-commerce platforms, protecting consumers and ensuring fair ratings. The extension supports Amazon, Shopee, and Lazada, offering three key features: manual review input, screen cropping for text extraction, and review scraping from product links.

## Problem Statement

The project addresses the challenge of identifying fake product reviews (e.g., paid, bot-generated, or malicious posts) on e-commerce platforms to enhance consumer trust and maintain fair product ratings.

## Features

1. **Manual Review Input**: Users can submit a review via a form in the extension, which is sent to the backend for classification as "genuine" or "fake" using BERT, RoBERTa, or ELECTRA models.
2. **Screen Cropping (Advanced Feature)**: Users can crop a portion of their screen to extract review text automatically, which is then analyzed for authenticity.
3. **Review Scraping from Product Links (Advanced Feature)**: Users can paste a product link from Amazon, Shopee, or Lazada, and the extension scrapes review text for analysis, streamlining the detection process.

## Team

- **Tan Hao Yang**
- **Jesmine Tey Khai Jing**
- **Foo Xin Chee**

## Prerequisites

- **Python 3.11** for running the backend and model development.
- **Google Chrome** for running the extension.
- **Git** for cloning the repository.
- **Internet connection** to download models from Hugging Face.

## Setup Instructions

### 1. Prepare the Models

You have two options to prepare the NLP models (BERT, RoBERTa, ELECTRA):

- **Option 1: Train Models**
  1. Navigate to the `model_development` folder.
  2. Install required libraries:
     ```bash
     pip install -r requirements.txt
     ```
  3. Run the Jupyter notebooks to train the models.
- **Option 2: Use Pre-trained Models**
  - Use the pre-trained models uploaded by Team Debug Durian at [Hugging Face](https://huggingface.co/jesmine0820):
    - `jesmine0820/fake-review-detector-bert-base-uncased`
    - `jesmine0820/fake-review-detector-roberta-base`
    - `jesmine0820/fake-review-detector-google` (ELECTRA)

### 2. Run the Backend

The backend is built with FastAPI and processes review text using the selected model.

1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the FastAPI server:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```
4. Verify the server is running at `http://localhost:8000`.
5. View the API documentation at `http://localhost:8000/docs`.

### 3. Install and Run the Chrome Extension

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer Mode** in the top right corner.
3. Click **Load Unpacked** and select the `frontend` folder.
4. The Fake Review Detector extension will appear in Chrome’s toolbar, ready for use.

## Usage

1. **Manual Input**: Open the extension, enter a review in the input form, select a model (BERT, RoBERTa, or ELECTRA), and submit to get a "genuine" or "fake" prediction with confidence and LIME explanations.
2. **Screen Cropping**: Use the cropping tool to select a review on a webpage, and the extension will extract and analyze the text.
3. **Review Scraping**: Paste a product link from Amazon, Shopee, or Lazada, and the extension will scrape reviews and classify them.

## Acknowledgments

Developed for a hackathon by Team Debug Durian to combat fake reviews and enhance e-commerce transparency.
