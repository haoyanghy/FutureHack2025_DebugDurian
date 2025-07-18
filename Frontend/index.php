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
        <div id="screenshotContainer" class="empty"></div>
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

  <script src="popup.js"></script>
</body>
</html>
