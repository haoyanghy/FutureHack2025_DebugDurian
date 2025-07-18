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

  // Updated to point to your Python backend
  const API_URL = 'http://localhost:5000/analyze'; // Assuming your Python backend runs on port 5000

  let lastCroppedImage = null;

  // Enable submit only if model selected and text or image exists
  function updateSubmitButtonState() {
    submitBtn.disabled = !(modelSelect.value && (reviewText.value.trim().length > 0 || lastCroppedImage));
  }

  // Show/hide loading
  function showLoading(text = 'Analyzing review...') {
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
    clearButton.classList.remove('hidden');
    lastCroppedImage = dataUrl;
    updateSubmitButtonState();
  }

  // Clear capture
  clearButton.addEventListener('click', () => {
    imgResultDiv.innerHTML = '';
    imgResultDiv.classList.add('empty');
    clearButton.classList.add('hidden');
    lastCroppedImage = null;
    updateSubmitButtonState();
  });

  // Update submit button state on changes
  reviewText.addEventListener('input', updateSubmitButtonState);
  modelSelect.addEventListener('change', updateSubmitButtonState);

  // Capture button click handler
  captureButton.addEventListener('click', async () => {
    try {
      // Use the Screen Capture API
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' }
      });
      
      // Create video element to capture the screen
      const video = document.createElement('video');
      video.srcObject = stream;
      
      video.onloadedmetadata = () => {
        video.play();
        
        // Create canvas to take screenshot
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Stop the stream
        stream.getTracks().forEach(track => track.stop());
        
        // Show the screenshot for cropping
        const screenshotUrl = canvas.toDataURL('image/png');
        const screenshotImg = new Image();
        screenshotImg.src = screenshotUrl;
        
        screenshotImg.onload = function() {
          // Display the full screenshot for cropping
          displayImage(screenshotUrl);
          
          // Initialize selection functionality
          initSelection(screenshotImg);
        };
      };
    } catch (err) {
      console.error('Error capturing screen:', err);
      alert('Failed to capture screen: ' + err.message);
    }
  });

  // Initialize selection functionality
  function initSelection(screenshotImg) {
    const selectionArea = document.createElement('div');
    selectionArea.id = 'selectionArea';
    selectionArea.style.position = 'absolute';
    selectionArea.style.border = '2px dashed red';
    selectionArea.style.backgroundColor = 'rgba(255,0,0,0.1)';
    selectionArea.style.display = 'none';
    imgResultDiv.appendChild(selectionArea);
    
    let isSelecting = false;
    let startX, startY;
    
    screenshotImg.addEventListener('mousedown', (e) => {
      isSelecting = true;
      const rect = screenshotImg.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      
      selectionArea.style.left = startX + 'px';
      selectionArea.style.top = startY + 'px';
      selectionArea.style.width = '0px';
      selectionArea.style.height = '0px';
      selectionArea.style.display = 'block';
    });
    
    screenshotImg.addEventListener('mousemove', (e) => {
      if (!isSelecting) return;
      
      const rect = screenshotImg.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      
      selectionArea.style.width = Math.abs(currentX - startX) + 'px';
      selectionArea.style.height = Math.abs(currentY - startY) + 'px';
      
      if (currentX < startX) {
        selectionArea.style.left = currentX + 'px';
      }
      if (currentY < startY) {
        selectionArea.style.top = currentY + 'px';
      }
    });
    
    screenshotImg.addEventListener('mouseup', () => {
      if (!isSelecting) return;
      isSelecting = false;
      
      // Get the final coordinates
      const left = parseInt(selectionArea.style.left);
      const top = parseInt(selectionArea.style.top);
      const width = parseInt(selectionArea.style.width);
      const height = parseInt(selectionArea.style.height);
      
      // Create canvas for cropping
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      // Crop the image
      ctx.drawImage(
        screenshotImg,
        left, top, width, height,
        0, 0, width, height
      );
      
      // Update the displayed image with the cropped version
      const croppedImageUrl = canvas.toDataURL('image/png');
      displayImage(croppedImageUrl);
    });
  }

  // Form submit handler
  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!modelSelect.value) {
      alert('Please select a model');
      return;
    }

    showLoading();
    submitBtn.disabled = true;

    try {
      // Prepare the payload for the Python backend
      const payload = {
        model: modelSelect.value,
        reviewText: reviewText.value.trim(),
        imageData: lastCroppedImage // Send the base64 image data if it exists
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      displayResults(data);

    } catch (error) {
      console.error('Error:', error);
      alert('Error analyzing review: ' + error.message);
    } finally {
      hideLoading();
      submitBtn.disabled = false;
    }
  });

  // Display results
  function displayResults(data) {
    reviewResults.innerHTML = '';
    
    // Handle both single result and array of results
    const results = Array.isArray(data) ? data : [data];
    
    results.forEach((result) => {
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

      if (result.explanation && Array.isArray(result.explanation)) {
        const heatmap = document.createElement('div');
        heatmap.className = 'heatmap-container';
        
        const maxVal = Math.max(...result.explanation.map(([, v]) => Math.abs(v))) || 1;
        
        result.explanation.forEach(([word, value]) => {
          const intensity = Math.abs(value) / maxVal;
          const red = Math.round(255 * intensity);
          const green = Math.round(255 * (1 - intensity));
          
          const span = document.createElement('span');
          span.textContent = word;
          span.style.backgroundColor = `rgb(${red}, ${green}, 0)`;
          span.style.padding = '2px 4px';
          span.style.margin = '2px';
          span.style.borderRadius = '3px';
          span.title = `Sentiment contribution: ${value.toFixed(4)}`;
          heatmap.appendChild(span);
        });
        
        div.appendChild(heatmap);
      }

      reviewResults.appendChild(div);
    });

    resultsDiv.classList.remove('hidden');
  }
});
