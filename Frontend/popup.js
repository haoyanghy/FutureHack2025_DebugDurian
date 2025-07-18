document.addEventListener('DOMContentLoaded', function () {
  const reviewForm = document.getElementById('reviewForm');
  const reviewText = document.getElementById('reviewText');
  const modelSelect = document.getElementById('modelSelect');
  const submitBtn = document.getElementById('submitBtn');
  const captureButton = document.getElementById('capture');
  const imgResultDiv = document.getElementById('screenshotContainer');
  const clearButton = document.getElementById('clearCapture');
  const resultsDiv = document.getElementById('results');
  const reviewResults = document.getElementById('reviewResults');

  const loadingContainer = document.getElementById('loadingContainer');
  const loadingText = document.getElementById('loadingText');
  const progressFill = document.getElementById('progressFill');

  const API_URL = 'http://localhost:8000/durian/review';

  let lastCroppedImage = null;

  // Enable submit only if model selected and text or image exists
  function updateSubmitButtonState() {
    if (
      modelSelect.value &&
      (reviewText.value.trim().length > 0 || lastCroppedImage !== null)
    ) {
      submitBtn.disabled = false;
    } else {
      submitBtn.disabled = true;
    }
  }

  // Show/hide loading
  function showLoading(text = 'Loading...') {
    loadingText.textContent = text;
    loadingContainer.classList.remove('hidden');
    updateProgressBar(0);
  }
  function hideLoading() {
    loadingContainer.classList.add('hidden');
  }
  function updateProgressBar(percent) {
    progressFill.style.width = `${percent}%`;
  }

  // Display captured image
  function displayImage(dataUrl) {
    imgResultDiv.innerHTML = '';
    const img = new Image();
    img.src = dataUrl;
    img.alt = 'Cropped Screenshot';
    img.style.maxWidth = '100%';
    imgResultDiv.appendChild(img);
    imgResultDiv.classList.remove('empty');
    imgResultDiv.classList.add('has-image');
    clearButton.classList.remove('hidden');
    clearButton.classList.add('visible');
    lastCroppedImage = dataUrl;
    updateSubmitButtonState();
  }

  // Clear capture
  clearButton.addEventListener('click', () => {
    imgResultDiv.innerHTML = '';
    imgResultDiv.classList.add('empty');
    imgResultDiv.classList.remove('has-image');
    clearButton.classList.remove('visible');
    clearButton.classList.add('hidden');
    lastCroppedImage = null;
    updateSubmitButtonState();
  });

  // Update submit button state on textarea and model change
  reviewText.addEventListener('input', updateSubmitButtonState);
  modelSelect.addEventListener('change', updateSubmitButtonState);

  // Load last cropped image from chrome storage
  chrome.storage.local.get('lastCroppedImage', (result) => {
    if (result.lastCroppedImage) {
      displayImage(result.lastCroppedImage);
    }
  });

  // Listen for cropped image sent from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'croppedImage') {
      displayImage(request.dataUrl);
      chrome.storage.local.set({ lastCroppedImage: request.dataUrl });
    }
    return true;
  });

  // Capture button click: start capture flow
  captureButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'capture' }, (response) => {
      if (response.error) {
        alert(response.error);
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;
        chrome.scripting.executeScript(
          {
            target: { tabId },
            files: ['crop.js'],
          },
          () => {
            chrome.tabs.sendMessage(tabId, {
              action: 'startCropping',
              screenshot: response.screenshot,
            });
          }
        );
      });
    });
  });

  // Form submit: send review text or captured image to backend
  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!modelSelect.value) {
      alert('Please select a model');
      return;
    }

    // If no text but have image, send image only; else send text
    let payload;
    if (reviewText.value.trim().length > 0) {
      payload = { text: reviewText.value.trim(), model: modelSelect.value };
    } else if (lastCroppedImage) {
      payload = { image: lastCroppedImage, model: modelSelect.value };
    } else {
      alert('Please enter review text or capture an image.');
      return;
    }

    showLoading('Analyzing review...');
    updateProgressBar(30);
    submitBtn.disabled = true;
    submitBtn.textContent = 'Analyzing...';

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      updateProgressBar(60);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to analyze review');
      }

      const data = await response.json();
      displayResults(data);

      updateProgressBar(90);
      setTimeout(hideLoading, 500);
    } catch (error) {
      alert('Error: ' + error.message);
      hideLoading();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Analyze Review';
    }
  });

  // Display results
  function displayResults(data) {
    reviewResults.innerHTML = '';
    data.forEach((result) => {
      const div = document.createElement('div');
      div.className = 'result-item';

      div.innerHTML = `
        <p><strong>Review:</strong> ${result.review}</p>
        <p><strong>Label:</strong> ${result.label}</p>
        <p><strong>Confidence:</strong> ${(result.confidence * 100).toFixed(2)}%</p>
        ${
          result.label === 'fake' && result.cluster_type
            ? `<p><strong>Category:</strong> ${result.cluster_type}</p>`
            : ''
        }
      `;

      const heatmap = document.createElement('div');
      heatmap.className = 'heatmap-container';

      if (result.explanation && Array.isArray(result.explanation)) {
        const maxVal = Math.max(...result.explanation.map(([, v]) => Math.abs(v))) || 1;
        result.explanation.forEach(([word, value]) => {
          const intensity = Math.abs(value) / maxVal;
          const red = Math.round(255 * intensity);
          const green = Math.round(255 * (1 - intensity));
          const span = document.createElement('span');
          span.textContent = word + ' ';
          span.style.backgroundColor = `rgb(${red}, ${green}, 0)`;
          span.style.padding = '2px 4px';
          span.style.margin = '2px';
          span.style.borderRadius = '3px';
          span.title = `Sentiment contribution: ${value.toFixed(4)}`;
          heatmap.appendChild(span);
        });
      }

      div.appendChild(heatmap);
      reviewResults.appendChild(div);
    });

    resultsDiv.classList.remove('hidden');
  }
});
