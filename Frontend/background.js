chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "capture") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0].url;
      if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
        sendResponse({ error: "Cannot capture chrome:// or extension pages" });
        return;
      }

      chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
        sendResponse({ screenshot: dataUrl });
      });
    });
  } else if (request.action === "getLastCroppedImage") {
    sendResponse({ dataUrl: lastCroppedImage });
  }
  else if (request.action === "croppedImage") {
    lastCroppedImage = request.dataUrl;
  }
  return true;

});
