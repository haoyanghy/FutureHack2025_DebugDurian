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
    const model = document.getElementById('modelSelect').value;
    const text = reviewText.value.trim();

    if (!text) {
      alert('Please enter review text');
      return;
    }

    try {
      const response = await fetch('http://localhost:8080/durian/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      labelSpan.textContent = data.label || 'N/A';
      confidenceSpan.textContent = data.confidence ? `${(data.confidence * 100).toFixed(2)}%` : 'N/A';
      
      // Generate sentiment heatmap
      heatmapDiv.innerHTML = '';
      if (data.explanation && Array.isArray(data.explanation)) {
        const values = data.explanation.map(([_, value]) => Math.abs(value));
        const maxValue = Math.max(...values) || 1;
        data.explanation.forEach(([word, value]) => {
          const intensity = Math.abs(value) / maxValue; 
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
      } else {
        heatmapDiv.textContent = 'No explanation provided';
      }

      resultsDiv.classList.remove('hidden');
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to analyze review. Please try again.');
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