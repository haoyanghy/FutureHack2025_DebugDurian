chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureScreen') {
    chrome.desktopCapture.chooseDesktopMedia(
      ['screen', 'window', 'tab'],
      (streamId) => {
        if (!streamId) {
          sendResponse({ error: 'No stream selected' });
          return;
        }

        // Request screenshot from active tab
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            sendResponse({ error: 'Failed to capture screenshot' });
            return;
          }
          sendResponse({ dataUrl });
        });
      }
    );
    return true; // Keep message channel open for async response
  }
});