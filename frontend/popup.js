document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const reviewForm = document.getElementById('reviewForm');
  const reviewTextarea = document.getElementById('reviewText');
  const resultsDiv = document.getElementById('results');
  const reviewResults = document.getElementById('reviewResults');
  const submitBtn = document.getElementById('submitBtn');
  const platformSelect = document.getElementById('platform');
  const captureButton = document.getElementById('capture');
  const imgResultDiv = document.getElementById('screenshotContainer');
  const clearAllBtn = document.getElementById('clearAll');
  const modelSelect = document.getElementById('modelSelect');
  const urlInput = document.getElementById('urlInput');
  const urlField = document.getElementById('url');
  const scrapedTextDiv = document.getElementById('scrapedText');
  const scrapedReviews = document.getElementById('scrapedReviews');

  let lastCroppedImage = null;
  let currentInputMethod = 'text'; 

  // API configuration
  const API_URL = 'http://localhost:8000/durian/review';
  const EXTRACT_API_URL = 'http://localhost:8000/durian/extract';

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

  initializeFromStorage();
  updateSubmitButtonState();

  reviewTextarea.addEventListener('input', function() {
    currentInputMethod = 'text';
    updateSubmitButtonState();
  });

  platformSelect.addEventListener('change', function() {
    const platformSelected = this.value !== "";
    urlInput.classList.toggle('hidden', !platformSelected);
    scrapedTextDiv.classList.add('hidden');
    scrapedReviews.value = '';
    currentInputMethod = platformSelected ? 'scrape' : 'text';
    updateSubmitButtonState();
  });

  urlField.addEventListener('input', function() {
    currentInputMethod = 'scrape';
    updateSubmitButtonState();
  });

  captureButton.addEventListener("click", () => {
    currentInputMethod = 'image';
    imgResultDiv.classList.add('active');
    
    showLoading('Capturing screenshot...');
    chrome.runtime.sendMessage({ 
      action: "capture",
      model: modelSelect.value // Pass selected model
    }, (response) => {
      if (response.error) {
        hideLoading();
        alert(`Capture failed: ${response.error}`);
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
            if (chrome.runtime.lastError) {
              hideLoading();
              alert(`Cropping failed: ${chrome.runtime.lastError.message}`);
              return;
            }
            chrome.tabs.sendMessage(tabId, {
              action: "startCropping",
              screenshot: response.screenshot,
              model: modelSelect.value // Pass model to crop.js
            }, () => {
              hideLoading();
              alert('Please drag to crop the screen. Reopen the extension to view results.');
            });
          }
        );
      });
    });
  });

  reviewForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    showLoading('Analyzing review...');
    updateProgressBar(30);
    submitBtn.disabled = true;

    try {
      let reviewText = '';
      let model = modelSelect.value;

      // Handle different input methods
      switch(currentInputMethod) {
        case 'text':
          reviewText = reviewTextarea.value.trim();
          break;
          
        case 'image':
          if (!lastCroppedImage) {
            throw new Error('No image captured');
          }
          reviewText = reviewTextarea.value.trim(); 
          break;
          
        case 'scrape':
          const platform = platformSelect.value;
          const productUrl = urlField.value.trim();
          
          if (!validateUrl(platform, productUrl)) {
            throw new Error(`Please enter a valid ${platform} product URL`);
          }

          showLoading(`Scraping ${platform.charAt(0).toUpperCase() + platform.slice(1)} reviews...`);
          reviewText = await scrapeReviews(platform, productUrl);
          scrapedReviews.value = reviewText.formatted;
          scrapedTextDiv.classList.remove('hidden');
          reviewText = reviewText.combined;
          break;
      }

      if (!reviewText) {
        throw new Error('No review text to analyze');
      }

      showLoading('Analyzing review...');
      const analysisResults = await analyzeText(reviewText, model);
      displayResults(analysisResults);
      updateProgressBar(90);
      
    } catch (error) {
      console.error('Analysis failed:', error);
      alert(`Error: ${error.message}`);
    } finally {
      hideLoading();
      submitBtn.disabled = false;
    }
  });

  clearAllBtn.addEventListener('click', clearAll);

  // --------------Helper Functions------------------------------

  async function analyzeText(text, model) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Analysis failed');
    }
    
    return await response.json();
  }

  async function scrapeReviews(platform, productUrl) {
    return new Promise((resolve, reject) => {
      showLoading(`Scraping ${platform.charAt(0).toUpperCase() + platform.slice(1)} reviews...`);
      updateProgressBar(10);

      chrome.tabs.create({ url: productUrl, active: false }, (tab) => {
        const tabId = tab.id;
        let attempts = 0;
        const maxAttempts = 3;

        const tryScrape = () => {
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
                const reviewElements = document.querySelectorAll('.shopee-product-rating__main, .YNedDV');
                reviewElements.forEach(el => {
                  const text = el.textContent.trim();
                  if (text) reviews.push(text);
                });
              } else if (platform === 'lazada') {
                window.scrollTo(0, document.body.scrollHeight);
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
              const formatted = result.reviews.map((review, index) => `${index + 1}. ${review}`).join('\n');

              chrome.storage.local.set({ extractedText: combined }, () => {
                updateProgressBar(95);
                document.getElementById('scrapedReviews').value = formatted;
                document.querySelector('#scrapedText').style.display = 'block';
                chrome.tabs.remove(tabId);
                updateProgressBar(100);
                setTimeout(() => {
                  hideLoading();
                  alert(`Successfully scraped ${result.reviews.length} ${platform} reviews!`);
                  resolve({ combined, formatted });
                }, 500);
              });
            } else if (result.status === 'captcha_blocked') {
              chrome.tabs.remove(tabId);
              hideLoading();
              reject(new Error(`${platform.charAt(0).toUpperCase() + platform.slice(1)} is showing CAPTCHA. Please solve it manually and try again.`));
            } else if (attempts < maxAttempts) {
              updateProgressBar(10 + (attempts * 25));
              setTimeout(tryScrape, 3000);
            } else {
              chrome.tabs.remove(tabId);
              hideLoading();
              let message = `${platform.charAt(0).toUpperCase() + platform.slice(1)} Review Scraping Failed\n\n`;
              message += `Technical details:\nStatus: ${result.status}\nReviews found: ${result.containerCount || 0}`;
              reject(new Error(message));
            }
          });
        };

        // Wait for page to load before first attempt
        setTimeout(() => {
          updateProgressBar(20);
          tryScrape();
        }, 7000);
      });
    });
  }

  function validateUrl(platform, url) {
    const platformDomains = {
      amazon: "amazon.",
      shopee: "shopee.",
      lazada: "lazada."
    };
    return url && url.includes(platformDomains[platform]);
  }

  function updateSubmitButtonState() {
    let hasContent = false;
    
    switch(currentInputMethod) {
      case 'text':
        hasContent = reviewTextarea.value.trim() !== '';
        break;
      case 'image':
        hasContent = lastCroppedImage !== null;
        break;
      case 'scrape':
        hasContent = (scrapedReviews.value.trim() !== '' || 
                     (platformSelect.value !== '' && validateUrl(platformSelect.value, urlField.value.trim())));
        break;
    }
    submitBtn.disabled = !hasContent || modelSelect.value === '';
  }

  function displayImage(dataUrl) {
    imgResultDiv.innerHTML = "";
    const img = new Image();
    img.src = dataUrl;
    img.alt = "Cropped Screenshot";
    img.style.maxWidth = "100%";
    img.style.maxHeight = "100%"; 
    img.style.objectFit = "contain"; 
    imgResultDiv.appendChild(img);
    imgResultDiv.classList.remove('empty');
    imgResultDiv.classList.add('has-image');
  }

  async function initializeFromStorage() {
    try {
      const result = await new Promise(resolve => {
        chrome.storage.local.get(['lastExtractedText', 'lastCroppedImage', 'croppedImageResult'], resolve);
      });

      if (result.lastExtractedText) {
        reviewTextarea.value = result.lastExtractedText;
        currentInputMethod = 'text';
        reviewTextarea.dispatchEvent(new Event('input')); 
      }

      if (result.croppedImageResult) {
        if (result.croppedImageResult.error) {
          alert(`Text extraction failed: ${result.croppedImageResult.error}`);
        } else {
          reviewTextarea.value = result.croppedImageResult.text;
          lastCroppedImage = result.croppedImageResult.dataUrl;
          displayImage(lastCroppedImage);
          currentInputMethod = 'image';
          reviewTextarea.dispatchEvent(new Event('input')); 
        }
        chrome.storage.local.remove('croppedImageResult'); 
      } else if (result.lastCroppedImage) {
        lastCroppedImage = result.lastCroppedImage;
        displayImage(lastCroppedImage);
        currentInputMethod = 'image';
      }
      
      updateSubmitButtonState();
    } catch (error) {
      console.error('Storage init failed:', error);
    }
  }

  function clearAll() {
    document.getElementById('reviewText').value = '';
    document.getElementById('url').value = '';
    document.getElementById('scrapedReviews').value = '';

    imgResultDiv.innerHTML = '';
    imgResultDiv.classList.add('empty');
    imgResultDiv.classList.remove('has-image');
    chrome.storage.local.remove('lastCroppedImage');
    lastCroppedImage = null;
    
    document.getElementById('modelSelect').selectedIndex = 0;
    document.getElementById('platform').selectedIndex = 0;
    document.getElementById('urlInput').classList.add('hidden');
    document.getElementById('scrapedText').classList.add('hidden');

    resultsDiv.classList.add('hidden');
    reviewResults.innerHTML = '';

    chrome.storage.local.remove([
      'lastCroppedImage',
      'lastExtractedText',
      'lastExtractionTime',
      'croppedImageResult'
    ]);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Analyze Review';

    hideLoading();
  }

  function displayResults(data) {
    reviewResults.innerHTML = '';
    
    data.forEach(result => {
      const resultDiv = document.createElement('div');
      resultDiv.className = 'result-item';

      const reviewP = document.createElement('p');
      reviewP.innerHTML = `<strong>Review:</strong> ${result.review}`;
      resultDiv.appendChild(reviewP);

      const labelP = document.createElement('p');
      labelP.innerHTML = `<strong>Label:</strong> ${result.label}`;
      resultDiv.appendChild(labelP);

      const confidenceP = document.createElement('p');
      confidenceP.innerHTML = `<strong>Confidence:</strong> ${(result.confidence * 100).toFixed(2)}%`;
      resultDiv.appendChild(confidenceP);

      if (result.label === 'fake' && result.cluster_type) {
        const categoryP = document.createElement('p');
        categoryP.innerHTML = `<strong>Category:</strong> ${result.cluster_type}`;
        categoryP.className = 'category-type';
        resultDiv.appendChild(categoryP);
      }

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
});