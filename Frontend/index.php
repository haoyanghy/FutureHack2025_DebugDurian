<?php
// index.php

$result = null;
$error = null;

// Handle POST form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $model = $_POST['model'] ?? '';
    $reviewText = trim($_POST['reviewText'] ?? '');

    if (!$model) {
        $error = "Please select a model.";
    } elseif (!$reviewText) {
        $error = "Please enter or capture review text.";
    } else {
        // Here, you can call your backend API or run analysis logic.
        // For demo, let's simulate analysis response:

        // Example fake response:
        $result = [
            [
                'review' => $reviewText,
                'label' => 'fake',
                'confidence' => 0.87,
                'cluster_type' => 'Spam',
                'explanation' => [
                    ['great', 0.1],
                    ['product', -0.2],
                    ['fake', -0.8],
                ],
            ]
        ];
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fake Review Detector</title>
  <link rel="stylesheet" href="styles.css" />
  <style>
    /* Basic styles for demonstration */
    .error { color: red; margin-bottom: 1em; }
    .results-container { margin-top: 1em; border: 1px solid #ccc; padding: 1em; }
    #screenshotContainer { border: 1px dashed #ccc; margin: 10px 0; min-height: 100px; position: relative; }
    #screenshotContainer img { max-width: 100%; }
    #screenshotContainer.empty { background-color: #f5f5f5; }
    #selectionArea { position: absolute; border: 2px dashed red; background-color: rgba(255,0,0,0.1); display: none; }
    .hidden { display: none; }
    .clear-btn-container { text-align: right; }
    .small-btn { padding: 3px 8px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="title-container">
      <img src="icons/durian.png" alt="Logo" class="logo" />
      <h2>Fake Review Detector</h2>
    </div>

    <?php if ($error): ?>
      <div class="error"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>

    <form id="reviewForm" method="post" action="">
      <div class="form-section">
        <div class="form-group">
          <label for="modelSelect">Select Model:</label>
          <select id="modelSelect" name="model" required>
            <option value="" disabled <?= !$model ? 'selected' : '' ?>>Select a model</option>
            <option value="bert" <?= ($model ?? '') === 'bert' ? 'selected' : '' ?>>BERT</option>
            <option value="roberta" <?= ($model ?? '') === 'roberta' ? 'selected' : '' ?>>RoBERTa</option>
            <option value="electra" <?= ($model ?? '') === 'electra' ? 'selected' : '' ?>>ELECTRA</option>
          </select>
        </div>
      </div>

      <div class="form-section">
        <div class="form-group">
          <label for="reviewText">Enter Review Text:</label>
          <textarea id="reviewText" name="reviewText" rows="5" placeholder="Paste or capture review text here" required><?= htmlspecialchars($reviewText ?? '') ?></textarea>
        </div>
      </div>

      <div class="form-section">
        <button type="button" id="capture" class="method-btn">
          <span class="icon">📷</span>
          <span>Capture & Crop from Screen</span>
        </button>
        <div id="screenshotContainer" class="empty">
          <div id="selectionArea"></div>
        </div>
        <div class="clear-btn-container">
          <button type="button" id="clearCapture" class="hidden small-btn">Clear</button>
        </div>
        <canvas id="overlayCanvas" style="display:none;"></canvas>
      </div>

      <div class="submit-section">
        <button type="submit" id="submitBtn" class="primary-btn">
          Analyze Review
        </button>
      </div>
    </form>

    <?php if ($result): ?>
    <div id="results" class="results-container">
      <h3>Results</h3>
      <?php foreach ($result as $res): ?>
        <div class="result-item" style="margin-bottom:1em;">
          <p><strong>Review:</strong> <?= htmlspecialchars($res['review']) ?></p>
          <p><strong>Label:</strong> <?= htmlspecialchars($res['label']) ?></p>
          <p><strong>Confidence:</strong> <?= number_format($res['confidence'] * 100, 2) ?>%</p>
          <?php if ($res['label'] === 'fake' && !empty($res['cluster_type'])): ?>
            <p><strong>Category:</strong> <?= htmlspecialchars($res['cluster_type']) ?></p>
          <?php endif; ?>
          <div><strong>Explanation:</strong>
            <div style="display:flex; flex-wrap: wrap; gap:5px; margin-top:5px;">
              <?php 
                $maxVal = 1;
                if (!empty($res['explanation'])) {
                    $maxVal = max(array_map(fn($e) => abs($e[1]), $res['explanation']));
                }
                foreach ($res['explanation'] ?? [] as [$word, $value]):
                  $intensity = abs($value) / $maxVal;
                  $red = (int)(255 * $intensity);
                  $green = (int)(255 * (1 - $intensity));
              ?>
                <span style="
                  background-color: rgb(<?= $red ?>, <?= $green ?>, 0);
                  padding: 2px 5px; border-radius: 3px;" 
                  title="Sentiment contribution: <?= number_format($value, 4) ?>">
                  <?= htmlspecialchars($word) ?>
                </span>
              <?php endforeach; ?>
            </div>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <div id="loadingContainer" class="loading-container hidden">
      <div class="spinner"></div>
      <div class="progress-bar">
        <div class="progress-bar-fill" id="progressFill"></div>
      </div>
      <p id="loadingText">Analyzing review...</p>
    </div>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const captureBtn = document.getElementById('capture');
      const clearCaptureBtn = document.getElementById('clearCapture');
      const screenshotContainer = document.getElementById('screenshotContainer');
      const selectionArea = document.getElementById('selectionArea');
      const reviewText = document.getElementById('reviewText');
      const overlayCanvas = document.getElementById('overlayCanvas');
      const ctx = overlayCanvas.getContext('2d');
      
      let isSelecting = false;
      let startX, startY, endX, endY;
      let screenshotImg = null;

      // Handle capture button click
      captureBtn.addEventListener('click', async function() {
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
            screenshotImg = new Image();
            screenshotImg.src = screenshotUrl;
            
            screenshotImg.onload = function() {
              screenshotContainer.innerHTML = '';
              screenshotContainer.appendChild(screenshotImg);
              screenshotContainer.appendChild(selectionArea);
              screenshotContainer.classList.remove('empty');
              clearCaptureBtn.classList.remove('hidden');
              
              // Set canvas size to match image
              overlayCanvas.width = screenshotImg.width;
              overlayCanvas.height = screenshotImg.height;
              
              // Initialize selection area
              initSelection();
            };
          };
        } catch (err) {
          console.error('Error capturing screen:', err);
          alert('Failed to capture screen: ' + err.message);
        }
      });
      
      // Handle clear capture button
      clearCaptureBtn.addEventListener('click', function() {
        screenshotContainer.innerHTML = '<div id="selectionArea"></div>';
        screenshotContainer.classList.add('empty');
        clearCaptureBtn.classList.add('hidden');
        reviewText.value = '';
        isSelecting = false;
      });
      
      // Initialize selection functionality
      function initSelection() {
        screenshotImg.addEventListener('mousedown', startSelection);
        screenshotImg.addEventListener('mousemove', updateSelection);
        screenshotImg.addEventListener('mouseup', endSelection);
      }
      
      function startSelection(e) {
        isSelecting = true;
        const rect = screenshotImg.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        
        selectionArea.style.left = startX + 'px';
        selectionArea.style.top = startY + 'px';
        selectionArea.style.width = '0px';
        selectionArea.style.height = '0px';
        selectionArea.style.display = 'block';
      }
      
      function updateSelection(e) {
        if (!isSelecting) return;
        
        const rect = screenshotImg.getBoundingClientRect();
        endX = e.clientX - rect.left;
        endY = e.clientY - rect.top;
        
        const width = endX - startX;
        const height = endY - startY;
        
        selectionArea.style.width = Math.abs(width) + 'px';
        selectionArea.style.height = Math.abs(height) + 'px';
        
        if (width < 0) {
          selectionArea.style.left = endX + 'px';
        }
        if (height < 0) {
          selectionArea.style.top = endY + 'px';
        }
      }
      
      function endSelection() {
        if (!isSelecting) return;
        isSelecting = false;
        
        // Get the final coordinates
        const left = parseInt(selectionArea.style.left);
        const top = parseInt(selectionArea.style.top);
        const width = parseInt(selectionArea.style.width);
        const height = parseInt(selectionArea.style.height);
        
        // Hide selection area
        selectionArea.style.display = 'none';
        
        // Perform OCR on the selected area (in a real app, you'd use Tesseract.js or similar)
        // For demo purposes, we'll just extract the image and show it
        
        // Create canvas with the selected area
        overlayCanvas.width = width;
        overlayCanvas.height = height;
        ctx.drawImage(
          screenshotImg,
          left, top, width, height,
          0, 0, width, height
        );
        
        // Convert to data URL and show in the textarea (in real app, use OCR here)
        const croppedImageUrl = overlayCanvas.toDataURL('image/png');
        reviewText.value = "Review text extracted from image would appear here.\n(Image captured: " + croppedImageUrl.substring(0, 50) + "...)";
        
        // For demo, we'll just show the cropped area
        screenshotContainer.innerHTML = '';
        const croppedImg = new Image();
        croppedImg.src = croppedImageUrl;
        croppedImg.style.maxWidth = '100%';
        screenshotContainer.appendChild(croppedImg);
      }
    });
  </script>
</body>
</html>
