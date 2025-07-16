function extractComments() {
  const commentElements = document.querySelectorAll('div[class*="shopee-product-rating__main"]');
  const comments = [];

  commentElements.forEach(el => {
    const text = el.innerText.trim();
    if (text) comments.push(text);
  });

  chrome.runtime.sendMessage({ action: 'commentsExtracted', comments });
}

extractComments();
