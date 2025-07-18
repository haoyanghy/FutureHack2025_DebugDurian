chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "capture") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url;
      if (!url || url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
        sendResponse({ error: "Cannot capture chrome:// or extension pages" });
        return;
      }

      chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ screenshot: dataUrl });
        }
      });
    });
    return true; 
  }
  else if (request.action === "getLastCroppedImage") {
    chrome.storage.local.get(['lastCroppedImage'], (result) => {
      sendResponse({ dataUrl: result.lastCroppedImage || null });
    });
    return true;
  }
  else if (request.action === "croppedImage") {
    const dataUrl = request.dataUrl;
    if (!dataUrl || !dataUrl.startsWith('data:image/png;base64,')) {
      sendResponse({ error: 'Invalid cropped image data' });
      return true;
    }

    const base64 = dataUrl.split(',')[1];
    fetch('http://localhost:8000/durian/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imgPath: base64, model: request.model || 'bert' })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Text extraction failed');
      }
      return response.json();
    })
    .then(data => {
      chrome.storage.local.set({
        croppedImageResult: { dataUrl, text: data.text },
        lastCroppedImage: dataUrl
      }, () => {
        sendResponse({ status: 'success', text: data.text });
      });
    })
    .catch(error => {
      chrome.storage.local.set({
        croppedImageResult: { dataUrl, error: error.message }
      }, () => {
        sendResponse({ error: error.message });
      });
    });
    return true;
  }
  return true;
});