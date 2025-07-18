document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const reviewForm = document.getElementById('reviewForm');
  const resultsDiv = document.getElementById('results');
  const reviewResults = document.getElementById('reviewResults');
  const submitBtn = document.getElementById('submitBtn');
  const platformSelect = document.getElementById('platform');
  const scrapeBtn = document.getElementById('scrapeBtn');
  const captureButton = document.getElementById('capture');
  const imgResultDiv = document.getElementById('results');

  let lastCroppedImage = null;

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

      updateProgressBar(90);
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
    reviewResults.innerHTML = '';
    
    data.forEach(result => {
      const resultDiv = document.createElement('div');
      resultDiv.className = 'result-item';
      
      // Review text
      const reviewP = document.createElement('p');
      reviewP.innerHTML = `<strong>Review:</strong> ${result.review}`;
      resultDiv.appendChild(reviewP);
      
      // Label
      const labelP = document.createElement('p');
      labelP.innerHTML = `<strong>Label:</strong> ${result.label}`;
      resultDiv.appendChild(labelP);
      
      // Confidence
      const confidenceP = document.createElement('p');
      confidenceP.innerHTML = `<strong>Confidence:</strong> ${(result.confidence * 100).toFixed(2)}%`;
      resultDiv.appendChild(confidenceP);
      
      // Category (for fake reviews)
      if (result.label === 'fake' && result.cluster_type) {
        const categoryP = document.createElement('p');
        categoryP.innerHTML = `<strong>Category:</strong> ${result.cluster_type?? 'Null'}`;
        resultDiv.appendChild(categoryP);
      }
      
      // Explanation (heatmap)
      const explanationDiv = document.createElement('div');
      explanationDiv.innerHTML = '<strong>Explanation:</strong>';
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
      
      explanationDiv.appendChild(heatmapDiv);
      resultDiv.appendChild(explanationDiv);
      reviewResults.appendChild(resultDiv);
    });
    
    resultsDiv.classList.remove('hidden');
  }

  // Display image function
  function displayImage(dataUrl) {
    imgResultDiv.innerHTML = "";
    const img = new Image();
    img.src = dataUrl;
    img.alt = "Cropped Screenshot";
    img.style.maxWidth = "100%";
    imgResultDiv.appendChild(img);
    imgResultDiv.classList.remove('hidden');
  }

  // Initialize with stored image
  chrome.storage.local.get('lastCroppedImage', (result) => {
    if (result.lastCroppedImage) {
      displayImage(result.lastCroppedImage);
    }
  });

  // Message listener (keep this as is)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "croppedImage") {
      lastCroppedImage = request.dataUrl;
      displayImage(request.dataUrl);
      chrome.storage.local.set({ lastCroppedImage: request.dataUrl });
    }
  });

  // Simplified capture button handler
  captureButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "capture" }, (response) => {
      if (response.error) {
        alert(response.error);
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;
        chrome.scripting.executeScript(
          {
            target: { tabId },
            files: ["crop.js"]
          },
          () => {
            chrome.tabs.sendMessage(tabId, {
              action: "startCropping",
              screenshot: response.screenshot
            });
          }
        );
      });
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
            alert(`${platform.charAt(0).toUpperCase() + platform.slice(1)} is showing CAPTCHA. Please solve it manually and try again.`);
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