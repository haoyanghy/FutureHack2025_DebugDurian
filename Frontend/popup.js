document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const reviewForm = document.getElementById('reviewForm');
  const resultsDiv = document.getElementById('results');
  const labelSpan = document.getElementById('label');
  const confidenceSpan = document.getElementById('confidence');
  const heatmapDiv = document.getElementById('heatmap');
  const cropBtn = document.getElementById('cropBtn');
  const submitBtn = document.getElementById('submitBtn');
  const platformSelect = document.getElementById('platform')
  const scrapeBtn = document.getElementById('scrapeBtn');
  const urlInputField = document.getElementById('urlInput');

  // API configuration
  const API_URL = 'http://localhost:8000/durian/review';

  //--------------------Loading Session------------------
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

  //------------------Function------------------------------

  // Handle form submission
  reviewForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const reviewText = document.getElementById('reviewText').value.trim();
    const modelSelect = document.getElementById('modelSelect').value;
    
    if (!reviewText) {
      alert('Please enter review text');
      return;
    }

    showLoading('Analyzing review...');
    updateProgressBar(30);
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

      updateProgressBar(60);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to analyze review');
      }

      const data = await response.json();
      displayResults(data);

      // Validate response structure
      if (!data.label || typeof data.confidence !== 'number' || !Array.isArray(data.explanation)) {
        throw new Error('Invalid response format: Missing label, confidence, or explanation');
      }

      updateProgressBar(90);

      labelSpan.textContent = data.label;
      confidenceSpan.textContent = `${(data.confidence * 100).toFixed(2)}%`;
      
      // Generate sentiment heatmap
      heatmapDiv.innerHTML = '';
      const maxVal = Math.max(...data.explanation.map(([_, v]) => Math.abs(v))) || 1;
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
      updateProgressBar(100);
      setTimeout(hideLoading, 500);
    } catch (error) {
      console.error('API Error:', error);
      alert(`Error: ${error.message}`);
      hideLoading();
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

  // Initialize the platform selection handler
  platformSelect.addEventListener('change', function() {
      const platformSelected = this.value !== "";
      scrapeBtn.disabled = !platformSelected;
      const urlInput = document.getElementById('urlInput');
      if (platformSelected) {
          urlInput.classList.remove('hidden');
      } else {
          urlInput.classList.add('hidden');
      }
      document.getElementById('scrapedText').classList.add('hidden');
      document.getElementById('scrapedReviews').value = '';
  });

  scrapeBtn.addEventListener('click', async () => {
    const platform = document.getElementById('platform').value;
    const productUrl = document.getElementById('url').value.trim();

    const platformDomains = {
      amazon: "amazon.",
      shopee: "shopee.",
      lazada: "lazada."
    }

    if (!productUrl || !productUrl.includes(platformDomains[platform])) {
      alert(`Please enter a valid ${platform} product URL`);
      return;
    }

    showLoading(`Scraping ${platform.charAt(0).toUpperCase() + platform.slice(1)} reviews...`);
    updateProgressBar(10);

    chrome.tabs.create({ url: productUrl, active: false }, (tab) => {
      const tabId = tab.id;
      let attempts = 0;
      const maxAttempts = 3;

      const scrapeReviews = () => {
        attempts++;
        updateProgressBar(10 + (attempts * 25));

        chrome.scripting.executeScript({
          target: { tabId },
          func: (platform) => {
            if (document.querySelector('#captchacharacters')) {
              return { status: 'captcha_blocked', reviews: [] };
            }

            let reviews = [];

            if (platform === 'amazon') {
              const containers = document.querySelectorAll('[data-hook="review"]');
              containers.forEach(container => {
                const textEl = container.querySelector('[data-hook="review-body"] span') || container.querySelector('.review-text-content');
                if (textEl) reviews.push(textEl.textContent.trim());
              });
            } else if (platform === 'shopee') {
                setTimeout(() => {
                  document.querySelectorAll('.shopee-product-rating__main, .YNedDV').forEach(el => {
                    const text = el.textContent.trim();
                    if (text) reviews.push(text);
                  });
                  console.log(reviews); 
                }, 3000);
            } else if (platform === 'lazada') {
              return new Promise((resolve) => {
                window.scrollTo(0, document.body.scrollHeight);
                setTimeout(() => {
                  const selectorsToTry = [
                    '.item-content-main-content-reviews-item span',
                    '.lzd-review-content span',
                    '[class*="review"] span',
                    '.next-card-body p'
                  ];
                  for (const selector of selectorsToTry) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                      elements.forEach(el => {
                        const text = el.textContent.trim();
                        if (text.length > 10) reviews.push(text);
                      });
                      break;
                    }
                  }
                  resolve({
                    status: reviews.length ? 'success' : 'no_reviews',
                    reviews: reviews
                  });
                }, 3000);
              });
            }

            return {
              status: reviews.length ? 'success' : 'no_reviews',
              reviews,
              containerCount: reviews.length
            };
          },
          args: [platform]
        }, (results) => {
          const result = results?.[0]?.result || { status: 'error', reviews: [] };

          if (result.status === 'success' && result.reviews.length > 0) {
            updateProgressBar(90);
            const combined = result.reviews.join(' | ');  

            chrome.storage.local.set({ extractedText: combined }, () => {
              document.getElementById('scrapedReviews').value = combined;
              document.querySelector('#scrapedText').style.display = 'block';

              chrome.tabs.remove(tabId);
              updateProgressBar(100);
              setTimeout(() => {
                hideLoading();
                alert(`Successfully scraped ${result.reviews.length} ${platform} reviews!`);
              }, 500);
            });
          }
          else if (result.status === 'captcha_blocked') {
            chrome.tabs.remove(tabId);
            hideLoading();
            alert(`${platform} is showing CAPTCHA. Please solve it manually and try again.`);
          }
          else if (attempts < maxAttempts) {
            setTimeout(scrapeReviews, 3000);
          }
          else {
            chrome.tabs.remove(tabId);
            hideLoading();
            let message = `${platform.charAt(0).toUpperCase() + platform.slice(1)} Review Scraping Failed\n\n`;
            message += `Technical details:\nStatus: ${result.status}\nReviews found: ${result.containerCount || 0}`;

            alert(message);
          }
        });
      };

      setTimeout(scrapeReviews, 7000);
    });
  });
});