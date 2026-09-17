// J.A.R.V.I.S. Ambient Setup controller (popup)

document.addEventListener("DOMContentLoaded", () => {
  const apiKeyField = document.getElementById("api-key-input");
  const contextToggle = document.getElementById("context-default");
  const saveButton = document.getElementById("save-button");
  const saveToast = document.getElementById("save-feedback");
  const helpKey = document.getElementById("help-key");

  // Load existing credentials cache
  chrome.storage.local.get(["gemini_api_key", "include_context_default"], (data) => {
    if (data.gemini_api_key) {
      apiKeyField.value = data.gemini_api_key;
    } else if (typeof CHROME_COMPANION_DEFAULT_KEY !== 'undefined' && CHROME_COMPANION_DEFAULT_KEY) {
      apiKeyField.value = CHROME_COMPANION_DEFAULT_KEY;
    }
    if (data.include_context_default !== undefined) {
      contextToggle.checked = data.include_context_default;
    }
  });

  // Help button navigation
  helpKey.addEventListener("click", () => {
    window.open("https://aistudio.google.com/app/apikey", "_blank");
  });

  // Save changes
  saveButton.addEventListener("click", () => {
    const freshKey = apiKeyField.value.trim();
    const contextDefault = contextToggle.checked;

    chrome.storage.local.set({
      gemini_api_key: freshKey,
      include_context_default: contextDefault
    }, () => {
      // Flash successes
      saveToast.style.display = "block";
      saveButton.innerText = "LINK RE-SYNCHRONIZED";
      saveButton.style.background = "#10b981";
      saveButton.style.color = "#ffffff";

      setTimeout(() => {
        saveToast.style.display = "none";
        saveButton.innerText = "Initialize Neural Link";
        saveButton.style.background = "#fbbf24";
        saveButton.style.color = "#09090b";
      }, 2000);
      
      // Send message to active tabs to refresh configuration instantly
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { action: "refresh_config" }).catch(() => {
              // Tab may not have our active content script, catch silently
            });
          }
        });
      });
    });
  });
});
