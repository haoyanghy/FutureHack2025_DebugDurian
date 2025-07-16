document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reviewForm');
  const cropBtn = document.getElementById('cropBtn');
  const pageAnalyzeBtn = document.getElementById('pageAnalyzeBtn');
  const reviewText = document.getElementById('reviewText');
  const resultsDiv = document.getElementById('results');
  const labelSpan = document.getElementById('label');
  const confidenceSpan = document.getElementById('confidence');
  const heatmapDiv = document.getElementById('heatmap');
  const scrape = document.getElementById('scrapeBtn');
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

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = reviewText.value.trim();

    if (!text) {
      alert('Please enter review text');
      return;
    }

    showLoading('Analyzing review...');
    updateProgressBar(30);

    try {
      const response = await fetch('http://localhost:8000/durian/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      updateProgressBar(60);

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
      console.error('Error:', error);
      alert(`Failed to analyze review: ${error.message}. Check console for details.`);
      hideLoading();
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

  // Handle Scrape from Amazon
  scrape.addEventListener('click', async () => {
    const productUrl = document.getElementById('amazonUrl').value.trim();
    
    if (!productUrl || !productUrl.includes("amazon.")) {
      alert("Please enter a valid Amazon product URL (e.g., https://www.amazon.com/dp/B0XXXXXXX)");
      return;
    }

    showLoading('Scraping Amazon reviews...');
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
          func: () => {
            // Check for CAPTCHA first
            if (document.querySelector('#captchacharacters')) {
              return { status: 'captcha_blocked', reviews: [] };
            }

            // Scroll to reviews section
            const reviewSection = document.getElementById('cm_cr-review_list') || 
                                document.querySelector('[data-hook="review-list"]');
            if (reviewSection) {
              reviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            // Get all review containers - try multiple selectors
            let reviewContainers = document.querySelectorAll('[data-hook="review"]');
            if (reviewContainers.length === 0) {
              reviewContainers = document.querySelectorAll('.review');
            }
            if (reviewContainers.length === 0) {
              reviewContainers = document.querySelectorAll('.a-section.review');
            }

            const reviews = [];
            
            reviewContainers.forEach(container => {
              const reviewTextElement = container.querySelector('[data-hook="review-body"] span') || 
                          container.querySelector('.review-text-content');
              if (reviewTextElement) {
                reviews.push(reviewTextElement.textContent.trim());
              }
            });
            return { 
              status: reviews.length ? 'success' : 'no_reviews', 
              reviews,
              containerCount: reviewContainers.length
            };
          }
        }, (results) => {
          const result = results?.[0]?.result || { status: 'error', reviews: [] };

          if (result.status === 'success' && result.reviews.length > 0) {
            updateProgressBar(90);
            const combined = result.reviews.join('\n\n---\n\n');
            
            chrome.storage.local.set({ extractedText: combined }, () => {
              document.getElementById('scrapedReviews').value = combined;

              document.querySelector('.scrapedText').style.display = 'block';

              chrome.tabs.remove(tabId);
              updateProgressBar(100);
              setTimeout(() => {
                hideLoading();
                alert(`Successfully scraped ${result.reviews.length} Amazon reviews!`);
              }, 500);
            });

          }
          else if (result.status === 'captcha_blocked') {
            chrome.tabs.remove(tabId);
            hideLoading();
            alert("Amazon is showing CAPTCHA. Please solve it manually and try again.");
          }
          else if (attempts < maxAttempts) {
            setTimeout(scrapeReviews, 3000);
          }
          else {
            chrome.tabs.remove(tabId);
            hideLoading();
            
            let message = "Amazon Review Scraping Failed\n\n";
            message += "Possible reasons:\n";
            message += "1. Not on a product page\n";
            message += "2. Amazon blocked the request\n";
            message += "3. No reviews available\n";
            message += "4. Page structure changed\n\n";
            message += `Technical details:\nStatus: ${result.status}\nContainers found: ${result.containerCount || 0}`;
            
            alert(message);
          }
        });
      };

      setTimeout(scrapeReviews, 7000);
    });
  });
});