document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyze-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const totalReviewsEl = document.getElementById('total-reviews');
  const fakeReviewsEl = document.getElementById('fake-reviews');
  const confidenceEl = document.getElementById('confidence');
  const sensitivitySlider = document.getElementById('sensitivity');
  const sensitivityValue = document.getElementById('sensitivity-value');
  const highlightReviews = document.getElementById('highlight-reviews');
  const notifyFakes = document.getElementById('notify-fakes');

  // Load saved settings
  chrome.storage.sync.get(
    ['sensitivity', 'highlightReviews', 'notifyFakes'],
    function(data) {
      sensitivitySlider.value = data.sensitivity || 5;
      sensitivityValue.textContent = data.sensitivity || 5;
      highlightReviews.checked = data.highlightReviews !== false;
      notifyFakes.checked = data.notifyFakes !== false;
    }
  );

  // Update status
  updateStatus();

  // Toggle settings panel
  settingsBtn.addEventListener('click', function() {
    settingsPanel.classList.toggle('hidden');
  });

  // Sensitivity slider
  sensitivitySlider.addEventListener('input', function() {
    sensitivityValue.textContent = this.value;
    chrome.storage.sync.set({ sensitivity: this.value });
  });

  // Highlight reviews checkbox
  highlightReviews.addEventListener('change', function() {
    chrome.storage.sync.set({ highlightReviews: this.checked });
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'toggleHighlight',
        value: this.checked
      });
    }.bind(this));
  });

  // Notify fakes checkbox
  notifyFakes.addEventListener('change', function() {
    chrome.storage.sync.set({ notifyFakes: this.checked });
  });

  // Analyze button
  analyzeBtn.addEventListener('click', function() {
    statusIndicator.className = 'status-indicator active';
    statusText.textContent = 'Analyzing reviews...';
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'analyzeReviews' }, function(response) {
        if (response) {
          updateStats(response);
          statusText.textContent = 'Analysis complete';
        } else {
          statusIndicator.className = 'status-indicator error';
          statusText.textContent = 'No reviews found';
        }
      });
    });
  });

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateStatus') {
      updateStatus(request.data);
    }
  });

  function updateStatus(data) {
    if (data && data.totalReviews > 0) {
      statusIndicator.className = 'status-indicator active';
      statusText.textContent = `${data.totalReviews} reviews detected`;
      updateStats(data);
    } else {
      statusIndicator.className = 'status-indicator';
      statusText.textContent = 'No reviews detected';
    }
  }

  function updateStats(data) {
    totalReviewsEl.textContent = data.totalReviews || 0;
    fakeReviewsEl.textContent = data.fakeReviews || 0;
    confidenceEl.textContent = data.confidence ? `${data.confidence}%` : '0%';
  }
});
