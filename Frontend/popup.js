document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const reviewForm = document.getElementById('reviewForm');
  const resultsDiv = document.getElementById('results');
  const labelSpan = document.getElementById('label');
  const confidenceSpan = document.getElementById('confidence');
  const heatmapDiv = document.getElementById('heatmap');
  const submitBtn = document.getElementById('submitBtn');
  const cropBtn = document.getElementById('cropBtn');
  const pageAnalyzeBtn = document.getElementById('pageAnalyzeBtn');

  // API configuration
  const API_URL = 'http://localhost:8000/durian/review';

  // Handle form submission
  reviewForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const reviewText = document.getElementById('reviewText').value.trim();
    const modelSelect = document.getElementById('modelSelect').value;
    
    if (!reviewText) {
      alert('Please enter review text');
      return;
    }

    // Set loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Analyzing...';

    try {
      // Make API request
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: reviewText,
          model: modelSelect
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to analyze review');
      }

      const data = await response.json();

      // Display results
      displayResults(data);
      
    } catch (error) {
      console.error('API Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      // Reset button state
      submitBtn.disabled = false;
      submitBtn.textContent = 'Analyze Review';
    }
  });

  // Display results function
  function displayResults(data) {
    labelSpan.textContent = data.label;
    confidenceSpan.textContent = `${(data.confidence * 100).toFixed(2)}%`;
    
    // Clear previous heatmap
    heatmapDiv.innerHTML = '';
    
    // Create heatmap visualization (simplified example)
    if (data.explanation && Array.isArray(data.explanation)) {
      data.explanation.forEach(item => {
        const wordSpan = document.createElement('span');
        const score = Math.abs(item.score); // Normalize score
        const color = score > 0.5 ? 
          `rgba(255, 0, 0, ${score})` : // Red for high impact
          `rgba(0, 0, 255, ${score})`;  // Blue for low impact
        
        wordSpan.textContent = item.word + ' ';
        wordSpan.style.backgroundColor = color;
        wordSpan.style.padding = '2px';
        wordSpan.style.margin = '1px';
        wordSpan.style.borderRadius = '3px';
        
        heatmapDiv.appendChild(wordSpan);
      });
    }
    
    resultsDiv.classList.remove('hidden');
  }

  // Crop button functionality
  cropBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "activateCropMode"});
    });
  });

  // Page analyze button functionality
  pageAnalyzeBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "analyzePageReviews"});
    });
  });
});
