document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reviewForm');
  const cropBtn = document.getElementById('cropBtn');
  const pageAnalyzeBtn = document.getElementById('pageAnalyzeBtn');
  const reviewText = document.getElementById('reviewText');
  const resultsDiv = document.getElementById('results');
  const labelSpan = document.getElementById('label');
  const confidenceSpan = document.getElementById('confidence');
  const heatmapDiv = document.getElementById('heatmap');

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = reviewText.value.trim();

    if (!text) {
      alert('Please enter review text');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/durian/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, Body: ${errorText}`);
      }

      let data;
      try {
        data = await response.json();
        console.log('Response data:', data);
      } catch (jsonError) {
        throw new Error(`Failed to parse JSON response: ${jsonError.message}`);
      }

      // Validate response structure
      if (!data.label || typeof data.confidence !== 'number' || !Array.isArray(data.explanation)) {
        throw new Error('Invalid response format: Missing label, confidence, or explanation');
      }

      labelSpan.textContent = data.label;
      confidenceSpan.textContent = `${(data.confidence * 100).toFixed(2)}%`;
      
      // Generate sentiment heatmap
      heatmapDiv.innerHTML = '';
      data.explanation.forEach(([word, value]) => {
        const intensity = Math.abs(value) / (Math.max(...data.explanation.map(([_, v]) => Math.abs(v))) || 1);
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

      resultsDiv.classList.remove('hidden');
    } catch (error) {
      console.error('Error:', error);
      alert(`Failed to analyze review: ${error.message}. Check console for details.`);
    }
  });

  // Handle screen cropping
  cropBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'captureScreen' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        alert('Failed to initiate screen capture');
        return;
      }

      if (response && response.dataUrl) {
        // Placeholder for OCR processing
        alert('Screen captured! OCR processing not implemented in this example.');
        reviewText.value = 'Sample extracted text from cropped image';
      }
    });
  });

  // Handle page analysis (placeholder)
  pageAnalyzeBtn.addEventListener('click', () => {
    alert('Page analysis functionality to be implemented later.');
    chrome.scripting.executeScript({
      target: { tabId: chrome.tabs.TAB_ID_NONE },
      function: () => {
        console.log('Page analysis triggered');
      }
    });
  });
});