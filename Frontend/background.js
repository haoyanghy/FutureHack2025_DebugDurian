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
    sendResponse({ dataUrl: lastCroppedImage });
  }
  else if (request.action === "croppedImage") {
    lastCroppedImage = request.dataUrl;
    sendResponse({ status: "success" });
  }
  return true;
});