document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const reviewForm = document.getElementById('reviewForm');
  const resultsDiv = document.getElementById('results');
  const labelSpan = document.getElementById('label');
  const confidenceSpan = document.getElementById('confidence');
  const heatmapDiv = document.getElementById('heatmap');
<<<<<<< HEAD
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
=======
  const submitBtn = document.getElementById('submitBtn');
  const cropBtn = document.getElementById('cropBtn');
  const pageAnalyzeBtn = document.getElementById('pageAnalyzeBtn');

  // API configuration
  const API_URL = 'http://localhost:8000/durian/review';
>>>>>>> 342ed0f7f9e2fad6aec18cde908866752d08fe6e

  // Handle form submission
  reviewForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const reviewText = document.getElementById('reviewText').value.trim();
    const modelSelect = document.getElementById('modelSelect').value;
    
    if (!reviewText) {
      alert('Please enter review text');
      return;
    }

<<<<<<< HEAD
    showLoading('Analyzing review...');
    updateProgressBar(30);
=======
    // Set loading state
    submitBtn.disabled = true;
    submitBtn.textContent = 'Analyzing...';
>>>>>>> 342ed0f7f9e2fad6aec18cde908866752d08fe6e

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

<<<<<<< HEAD
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
=======
      // Display results
      displayResults(data);
      
    } catch (error) {
      console.error('API Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      // Reset button state
      submitBtn.disabled = false;
      submitBtn.textContent = 'Analyze Review';
>>>>>>> 342ed0f7f9e2fad6aec18cde908866752d08fe6e
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
});
