// J.A.R.V.I.S. Ambient Companion - Service Worker

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-companion") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "toggle_sidebar" });
      }
    });
  }
});

// Listener for context messages or explicit popups
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "get_tab_info") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ title: tabs[0]?.title || "", url: tabs[0]?.url || "" });
    });
    return true; // Keep response channel open for async calls
  } else if (request.action === "open_tab") {
    chrome.tabs.create({ url: request.url });
    sendResponse({ success: true });
    return true;
  }
});
