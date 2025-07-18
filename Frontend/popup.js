document.addEventListener('DOMContentLoaded', function () {
  // Existing variables and handlers...
  const reviewForm = document.getElementById('reviewForm');
  const resultsDiv = document.getElementById('results');
  const reviewResults = document.getElementById('reviewResults');
  const submitBtn = document.getElementById('submitBtn');
  const platformSelect = document.getElementById('platform');
  const scrapeBtn = document.getElementById('scrapeBtn');
  const captureButton = document.getElementById('capture');
  const imgResultDiv = document.getElementById('screenshotContainer');
  const clearButton = document.getElementById('clearCapture');

  let lastCroppedImage = null;

  const API_URL = 'http://localhost:8000/durian/review';

  const showLoading = (text = 'Loading...') => {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingContainer').classList.remove('hidden');
    updateProgressBar(0);
  };

  const hideLoading = () => {
    document.getElementById('loadingContainer').classList.add('hidden');
  };

  const updateProgressBar = (percent) => {
    document.getElementById('progressFill').style.width = `${percent}%`;
  };

  // Submit review form to FastAPI
  reviewForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const reviewText = document.getElementById('reviewText').value.trim();
    const modelSelect = document.getElementById('modelSelect').value;
    if (!reviewText) return alert('Please enter review text');

    showLoading('Analyzing review...');
    updateProgressBar(30);
    submitBtn.disabled = true;
    submitBtn.textContent = 'Analyzing...';

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reviewText, model: modelSelect })
      });

      updateProgressBar(60);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to analyze review');
      }

      const data = await response.json();
      displayResults(data);
      updateProgressBar(90);
      setTimeout(hideLoading, 500);
    } catch (error) {
      console.error('API Error:', error);
      alert(`Error: ${error.message}`);
      hideLoading();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Analyze Review';
    }
  });

  function displayResults(data) {
    reviewResults.innerHTML = '';
    data.forEach(result => {
      const resultDiv = document.createElement('div');
      resultDiv.className = 'result-item';

      resultDiv.innerHTML += `
        <p><strong>Review:</strong> ${result.review}</p>
        <p><strong>Label:</strong> ${result.label}</p>
        <p><strong>Confidence:</strong> ${(result.confidence * 100).toFixed(2)}%</p>
      `;
      if (result.label === 'fake' && result.cluster_type) {
        resultDiv.innerHTML += `<p><strong>Category:</strong> ${result.cluster_type ?? 'Null'}</p>`;
      }

      const heatmapDiv = document.createElement('div');
      heatmapDiv.className = 'heatmap-container';
      if (result.explanation && Array.isArray(result.explanation)) {
        const maxVal = Math.max(...result.explanation.map(([_, v]) => Math.abs(v))) || 1;
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
          heatmapDiv.appendChild(span);
        });
      }
      resultDiv.appendChild(heatmapDiv);
      reviewResults.appendChild(resultDiv);
    });
    resultsDiv.classList.remove('hidden');
  }

  function displayImage(dataUrl) {
    imgResultDiv.innerHTML = "";
    const img = new Image();
    img.src = dataUrl;
    img.alt = "Cropped Screenshot";
    img.style.maxWidth = "100%";
    imgResultDiv.appendChild(img);
    imgResultDiv.classList.remove('empty');
    imgResultDiv.classList.add('has-image');
    clearButton.classList.remove('hidden');
    clearButton.classList.add('visible');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && clearButton.classList.contains('visible')) {
      clearButton.click();
    }
  });

  clearButton.addEventListener("click", () => {
    imgResultDiv.innerHTML = "";
    imgResultDiv.classList.add('empty');
    imgResultDiv.classList.remove('has-image');
    clearButton.classList.remove('visible');
    clearButton.classList.add('hidden');
    chrome.storage.local.remove('lastCroppedImage');
    document.getElementById('reviewText').placeholder = "Enter or paste review text here";
  });

  chrome.storage.local.get('lastCroppedImage', (result) => {
    if (result.lastCroppedImage) {
      displayImage(result.lastCroppedImage);
    } else {
      imgResultDiv.classList.add('empty');
      clearButton.classList.remove('visible');
      clearButton.classList.add('hidden');
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendRes
