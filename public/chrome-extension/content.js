// J.A.R.V.I.S. Ambient Companion - Interactive Tab Agent

(function() {
  // Prevent duplicate runs on the same page
  if (window.hasJarvisLoaded) return;
  window.hasJarvisLoaded = true;

  // Signal to the dashboard that the J.A.R.V.I.S. Chrome companion is active and installed!
  try {
    document.documentElement.setAttribute("data-jarvis-extension-installed", "true");
    // Also dispatch a custom event to notify React immediately
    window.dispatchEvent(new CustomEvent("jarvis-extension-handshake", { detail: { active: true } }));
  } catch (e) {
    console.error("J.A.R.V.I.S. extension handshake error:", e);
  }

  // Intercept open_url posts from the dashboard to open tabs from highly privileged background context
  window.addEventListener("message", (event) => {
    if (event.data && event.data.source === 'jarvis-web-panel') {
      if (event.data.action === 'open_url') {
        const url = event.data.url;
        try {
          chrome.runtime.sendMessage({ action: "open_tab", url: url });
        } catch (err) {
          console.error("Runtime message failure, opening via target window:", err);
          window.open(url, "_blank");
        }
      }
    }
  });

  let sidebarOpen = false;
  let chatHistory = [];
  let apiKey = "";
  let includeContext = true;

  // --- Cybernetic Media and YouTube Control Module ---
  function handleTabMediaAction(query) {
    const q = query.toLowerCase().trim();
    const video = document.querySelector('video');
    
    // Play / Resume
    if (q === "play" || q === "resume" || q === "unpause" || q === "play video" || q === "video play" || q === "video play karo" || q === "chalao") {
      if (video) {
        video.play();
        return { success: true, message: "Aapka video play kar diya hai, sir. (Playing video feed now.)" };
      }
      const ytPlayBtn = document.querySelector('.ytp-play-button');
      if (ytPlayBtn) {
        ytPlayBtn.click();
        return { success: true, message: "Playing YouTube stream." };
      }
      return { success: false, message: "No active video stream found in this viewport, sir." };
    }

    // Pause / Stop
    if (q === "pause" || q === "stop" || q === "hold" || q === "pause video" || q === "video pause" || q === "video pause karo" || q === "roko") {
      if (video) {
        video.pause();
        return { success: true, message: "Video paused. Standing by, sir." };
      }
      const ytPlayBtn = document.querySelector('.ytp-play-button');
      if (ytPlayBtn) {
        ytPlayBtn.click();
        return { success: true, message: "Pausing page media stream." };
      }
      return { success: false, message: "No active video found to pause in this viewport, sir." };
    }

    // Mute
    if (q === "mute" || q === "silent" || q === "shant" || q === "mute video" || q === "silent mode") {
      if (video) {
        video.muted = true;
        return { success: true, message: "Audio feed muted, sir." };
      }
      const ytMuteBtn = document.querySelector('.ytp-mute-button');
      if (ytMuteBtn) {
        ytMuteBtn.click();
        return { success: true, message: "Muted YouTube audio stream." };
      }
      return { success: false, message: "Mute target index empty, sir." };
    }

    // Unmute
    if (q === "unmute" || q === "sound on" || q === "unmute video") {
      if (video) {
        video.muted = false;
        return { success: true, message: "Audio feed restored, sir." };
      }
      const ytMuteBtn = document.querySelector('.ytp-mute-button');
      if (ytMuteBtn) {
        ytMuteBtn.click();
        return { success: true, message: "Restored video audio feed, sir." };
      }
      return { success: false, message: "Unmute target key index empty, sir." };
    }

    // Skip / Next Video
    if (q === "next" || q === "next video" || q === "skip" || q === "skip video" || q === "agla") {
      const nextBtn = document.querySelector('.ytp-next-button') || document.querySelector('a.ytp-next-button');
      if (nextBtn) {
        nextBtn.click();
        return { success: true, message: "Bypassing to next index. Skipping video, sir." };
      }
      return { success: false, message: "Next track control interface is ofline on this page, sir." };
    }

    // Volume Raise
    if (q === "volume up" || q === "volume raise" || q === "volume badhao" || q === "awaj badhao") {
      if (video) {
        video.volume = Math.min(1.0, video.volume + 0.15);
        return { success: true, message: `Volume raised to ${Math.round(video.volume * 100)}%, sir.` };
      }
      return { success: false, message: "Media control volume registers are offline on this page." };
    }

    // Volume Lower
    if (q === "volume down" || q === "volume lower" || q === "volume kam karo" || q === "awaj kam karo") {
      if (video) {
        video.volume = Math.max(0.0, video.volume - 0.15);
        return { success: true, message: `Volume lowered to ${Math.round(video.volume * 100)}%, sir.` };
      }
      return { success: false, message: "Media control volume registers are offline on this page." };
    }

    // Direct App Navigation
    if (q === "open youtube" || q === "go to youtube" || q === "youtube kholo" || q === "youtube open karo" || q === "youtube" || q === "youtube.com") {
      try {
        chrome.runtime.sendMessage({ action: "open_tab", url: "https://www.youtube.com" });
        return { success: true, message: "Opening YouTube interface in a new viewport immediately, sir." };
      } catch (err) {
        window.open("https://www.youtube.com", "_blank");
        return { success: true, message: "Initiating YouTube launch sequence, sir." };
      }
    }

    // Advanced YouTube Searches & Video Autoplay Mapping
    // Matches: "play X on youtube", "search X on youtube", "play X video", or simple "play X" on YouTube page
    const ytPlayRegex = /^(?:play|search|find|dikhao|bajao|chalao)\s+(.+?)\s+(?:on\s+youtube|youtube\s+par)$/i;
    const ytPlayStartRegex = /^(?:play|bajao|chalao)\s+(.+)$/i;
    
    let targetSearch = "";
    if (ytPlayRegex.test(query)) {
      targetSearch = query.match(ytPlayRegex)[1];
    } else if (window.location.host.includes("youtube.com") && ytPlayStartRegex.test(query)) {
      const searchCandidate = query.match(ytPlayStartRegex)[1].trim();
      const forbiddenList = ["video", "song", "audio", "movie", "current", "this", "now", "play", "pause"];
      if (!forbiddenList.includes(searchCandidate.toLowerCase())) {
        targetSearch = searchCandidate;
      }
    }

    if (targetSearch) {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(targetSearch)}&jarvis_autoplay=true`;
      try {
        chrome.runtime.sendMessage({ action: "open_tab", url: searchUrl });
        return { success: true, message: `Searching and launching "${targetSearch}" on YouTube in a new tab, sir.` };
      } catch (err) {
        window.location.href = searchUrl;
        return { success: true, message: `Searching and playing "${targetSearch}" on YouTube. Redirecting link immediately, sir.` };
      }
    }

    return null; // Let LLM interpret it
  }

  // Autoplay handler for J.A.R.V.I.S. redirected YouTube searches
  function checkAndAutoplayYouTube() {
    if (window.location.href.includes("jarvis_autoplay=true") && window.location.href.includes("/results")) {
      let attempts = 0;
      const maxAttempts = 12;
      
      const selectFirstVideo = () => {
        const videoLink = document.querySelector('ytd-video-renderer a#thumbnail, ytd-grid-video-renderer a#thumbnail, a.yt-simple-endpoint');
        if (videoLink) {
          let href = videoLink.getAttribute('href');
          if (href) {
            if (!href.startsWith('http')) {
              href = 'https://www.youtube.com' + href;
            }
            window.location.href = href;
            return;
          }
        }
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(selectFirstVideo, 400);
        }
      };
      
      setTimeout(selectFirstVideo, 600);
    }
  }

  checkAndAutoplayYouTube();
  window.addEventListener("yt-navigate-finish", checkAndAutoplayYouTube);

  // Initialize Audio Synth
  const playBeep = (type) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'click') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch brief chirp
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
      } else if (type === 'toggle') {
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      }
    } catch (e) {
      // AudioContext fails if user hasn't interacted with page yet, ignore silently
    }
  };

  // Get configuration from browser storage
  function refreshConfig() {
    chrome.storage.local.get(["gemini_api_key", "include_context_default"], (data) => {
      if (data.gemini_api_key) {
        apiKey = data.gemini_api_key;
      } else if (typeof CHROME_COMPANION_DEFAULT_KEY !== 'undefined' && CHROME_COMPANION_DEFAULT_KEY) {
        apiKey = CHROME_COMPANION_DEFAULT_KEY;
      }
      if (data.include_context_default !== undefined) {
        includeContext = data.include_context_default;
        const toggleNode = shadowRoot?.querySelector(".context-checkbox");
        if (toggleNode) toggleNode.checked = includeContext;
      }
    });
  }

  // Set up Floating Launcher Widget
  const launcher = document.createElement("div");
  launcher.className = "jarvis-launcher-wrap";
  launcher.innerHTML = `
    <button class="jarvis-orb-button" title="Toggle J.A.R.V.I.S. Companion (Alt+J)">
      <div class="jarvis-orb-pulse"></div>
      <svg class="jarvis-orb-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </button>
  `;
  document.body.appendChild(launcher);

  // Set up Sidebar Host Container
  const sidebarContainer = document.createElement("div");
  sidebarContainer.className = "jarvis-sidebar-host";
  document.body.appendChild(sidebarContainer);

  // Use Shadow DOM to completely protect jarvis formatting against parent style bleeding
  const shadowRoot = sidebarContainer.attachShadow({ mode: "open" });

  // Stylesheet to define sidebar design (Self-contained HUD glassmorphism layout)
  const styleBlock = document.createElement("style");
  styleBlock.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .companion-panel {
      width: 100%;
      height: 100%;
      background: rgba(10, 10, 14, 0.95);
      backdrop-filter: blur(20px);
      border-left: 2px solid rgba(251, 191, 36, 0.3);
      display: flex;
      flex-direction: column;
      color: #f3f4f6;
      box-shadow: -10px 0 40px rgba(0,0,0,0.8);
      overflow: hidden;
    }

    /* Cyber holographic header grid */
    .panel-header {
      padding: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      background: radial-gradient(circle at top left, rgba(139, 92, 246, 0.12), transparent);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .companion-title {
      font-weight: 800;
      letter-spacing: 0.15em;
      font-size: 14px;
      color: #fbbf24;
      text-shadow: 0 0 10px rgba(251, 191, 36, 0.35);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-text {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #10b981;
      font-weight: bold;
      background: rgba(16, 185, 129, 0.1);
      padding: 3px 8px;
      border-radius: 99px;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }

    .close-btn {
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
      border-radius: 8px;
      transition: all 0.2s;
    }
    
    .close-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
    }

    /* Suboptions / context-gather options */
    .context-bar {
      padding: 10px 20px;
      background: rgba(0, 0, 0, 0.3);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 11px;
      color: #9ca3af;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .context-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }

    .context-checkbox {
      accent-color: #fbbf24;
      cursor: pointer;
    }

    /* Conversation body Scrollable area */
    .chat-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 15px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }

    /* Message card visual style */
    .msg-wrap {
      display: flex;
      flex-direction: column;
      max-width: 85%;
      gap: 4px;
    }

    .msg-wrap.user {
      self-end;
    }

    .msg-wrap.jarvis {
      self-start;
    }

    .msg-info {
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #6b7280;
      font-weight: bold;
    }

    .msg-content {
      padding: 12px 16px;
      font-size: 12px;
      line-height: 1.6;
      border-radius: 14px;
      word-break: break-word;
    }

    .user .msg-content {
      background: rgba(139, 92, 246, 0.12);
      border: 1px solid rgba(139, 92, 246, 0.25);
      color: #e9d5ff;
      border-bottom-right-radius: 2px;
    }

    .jarvis .msg-content {
      background: rgba(251, 191, 36, 0.05);
      border: 1px solid rgba(251, 191, 36, 0.18);
      color: #fef08a;
      border-top-left-radius: 2px;
    }

    .system .msg-content {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: #fca5a5;
      font-family: monospace;
    }

    /* Formatting */
    p {
      margin-bottom: 8px;
    }
    p:last-child {
      margin-bottom: 0;
    }

    ul, ol {
      margin-left: 20px;
      margin-bottom: 8px;
    }

    code {
      font-family: 'Fira Code', 'JetBrains Mono', monospace;
      background: rgba(0,0,0,0.4);
      padding: 2px 4px;
      border-radius: 4px;
      color: #ffb703;
      font-size: 11px;
    }

    pre {
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.05);
      padding: 10px;
      border-radius: 8px;
      margin-top: 6px;
      margin-bottom: 8px;
      overflow-x: auto;
    }

    pre code {
      background: none;
      padding: 0;
      color: #e5e7eb;
    }

    /* Typist indicator waiting state */
    .indicator {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 10px 15px;
      background: rgba(251, 191, 36, 0.03);
      border: 1px dashed rgba(251, 191, 36, 0.15);
      border-radius: 12px;
      color: #9ca3af;
      font-size: 11px;
      align-self: flex-start;
      margin-top: 5px;
      display: none;
    }

    .indicator-dot {
      width: 5px;
      height: 5px;
      background: #fbbf24;
      border-radius: 50%;
      animation: bounce 1.4s infinite ease-in-out both;
    }

    .indicator-dot:nth-child(2) { animation-delay: 0.2s; }
    .indicator-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1.0); }
    }

    /* Input bar */
    .input-row {
      padding: 15px 20px 25px 20px;
      background: rgba(0, 0, 0, 0.4);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      gap: 10px;
    }

    .input-field {
      flex: 1;
      background: rgba(18, 18, 22, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 10px 14px;
      color: #ffffff;
      font-size: 12px;
      outline: none;
      transition: all 0.25s;
    }

    .input-field:focus {
      border-color: #fbbf24;
      box-shadow: 0 0 10px rgba(251, 191, 36, 0.15);
    }

    .send-btn {
      background: #fbbf24;
      color: #0c0a09;
      border: none;
      padding: 0 16px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.05em;
      cursor: pointer;
      transition: all 0.25s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .send-btn:hover {
      background: #f59e0b;
      transform: scale(1.02);
      box-shadow: 0 0 15px rgba(251, 191, 36, 0.4);
    }

    .send-btn:disabled {
      background: #374151;
      color: #9ca3af;
      cursor: not-allowed;
      box-shadow: none;
      transform: none;
    }
  `;
  shadowRoot.appendChild(styleBlock);

  // Injected Panel Structure
  const companionPanel = document.createElement("div");
  companionPanel.className = "companion-panel";
  companionPanel.innerHTML = `
    <!-- Header -->
    <div class="panel-header">
      <div class="companion-title">
        <svg style="width: 14px; height: 14px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>JARVIS COMPANION</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="status-text">NEURAL LINK</span>
        <button class="close-btn" title="Dismiss Sidebar">
          <svg style="width: 14px; height: 14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Active context checkbox toggles -->
    <div class="context-bar">
      <span>Ambient Context Gathering:</span>
      <label class="context-toggle" title="Let J.A.R.V.I.S understand context of active webpage">
        <input type="checkbox" class="context-checkbox" checked>
        <span>Active Tab Reader</span>
      </label>
    </div>

    <!-- Scrollable Dialog Center -->
    <div class="chat-body" id="chat-body">
      <!-- Welcome card -->
      <div class="msg-wrap jarvis">
        <span class="msg-info">J.A.R.V.I.S. Ambient HUD</span>
        <div class="msg-content">
          <p>Awaiting user instructions. I'm connected to your active Chrome webpage tab and can process textual features or explore specific content with you. How can I assist you today, sir?</p>
        </div>
      </div>
    </div>

    <!-- Typist load state bar -->
    <div class="indicator" id="jarvis-typing">
      <div class="indicator-dot"></div>
      <div class="indicator-dot"></div>
      <div class="indicator-dot"></div>
      <span style="font-family: monospace; font-size: 9px; margin-left: 4px;">SYNTHESIZING...</span>
    </div>

    <!-- Input text send row -->
    <div class="input-row">
      <input type="text" class="input-field" placeholder="Inquire or dictate instruction..." id="chat-input">
      <button class="send-btn" id="send-button">TRANSMIT</button>
    </div>
  `;
  shadowRoot.appendChild(companionPanel);

  // Access Sub Nodes
  const chatBody = shadowRoot.getElementById("chat-body");
  const chatInput = shadowRoot.getElementById("chat-input");
  const sendButton = shadowRoot.getElementById("send-button");
  const closeButton = shadowRoot.querySelector(".close-btn");
  const contextCheckbox = shadowRoot.querySelector(".context-checkbox");
  const typingIndicator = shadowRoot.getElementById("jarvis-typing");

  refreshConfig();

  // Scrape Page Context Details for active ambient prompt context
  function scrapePageTabDOM() {
    try {
      const title = document.title || "Unknown Page";
      const metaDesc = document.querySelector('meta[name="description"]')?.content || "";
      
      // Grab main heading text
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
        .map(h => h.innerText.trim())
        .filter(t => t.length > 5)
        .slice(0, 8)
        .join(" | ");

      // Sample first 15 paragraphs of substantial content
      const paragraphs = Array.from(document.querySelectorAll('p, pre, li'))
        .map(p => p.innerText.trim())
        .filter(t => t.length > 25)
        .slice(0, 15)
        .join("\n\n");

      return `[CHROME ACTIVE TAB WEB CONTEXT]
URL: ${window.location.href}
Title: ${title}
Meta Description: ${metaDesc}
Main Headings: ${headings}

Content Extract:
${paragraphs.slice(0, 6000)}`;
    } catch (e) {
      console.warn("Scraping DOM failure:", e);
      return "[Context scrape failed - browser sandbox limitation]";
    }
  }

  // Handle message layout rendering (minimal parsed formatting of markdown code snippets)
  function renderMarkdownSnippet(text) {
    if (!text) return "";
    
    // Simple fast formatting regexes for lists, code tags, or bold terms
    let formattedHtml = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

    // Parse block code formatting blocks
    const lines = formattedHtml.split('\n');
    let insidePre = false;
    let finalLines = [];

    for (let line of lines) {
      if (line.trim().startsWith('```')) {
        if (!insidePre) {
          finalLines.push('<pre><code>');
          insidePre = true;
        } else {
          finalLines.push('</code></pre>');
          insidePre = false;
        }
      } else {
        if (insidePre) {
          finalLines.push(line);
        } else {
          // If list items
          if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            finalLines.push('<li>' + line.trim().substring(2) + '</li>');
          } else if (/^\d+\.\s/.test(line.trim())) {
            const listText = line.trim().replace(/^\d+\.\s/, '');
            finalLines.push('<li>' + listText + '</li>');
          } else if (line.trim().length > 0) {
            finalLines.push('<p>' + line + '</p>');
          }
        }
      }
    }

    return finalLines.join('\n');
  }

  // Add Message to DOM UI Screen
  function appendMessage(role, text) {
    const wrap = document.createElement("div");
    wrap.className = `msg-wrap ${role}`;
    
    const info = document.createElement("span");
    info.className = "msg-info";
    info.innerText = role === 'user' ? 'INTELLIGENT OVERRIDE' : 'J.A.R.V.I.S. AGENT';

    const contentBox = document.createElement("div");
    contentBox.className = "msg-content";
    contentBox.innerHTML = role === 'system' ? text : renderMarkdownSnippet(text);

    wrap.appendChild(info);
    wrap.appendChild(contentBox);
    chatBody.appendChild(wrap);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // Submit dialog sequence
  async function submitInstruction() {
    const query = chatInput.value.trim();
    if (!query) return;

    chatInput.value = "";
    playBeep('click');
    
    // Render immediately on screen
    appendMessage('user', query);

    // Refresh credentials cache
    refreshConfig();

    // Check for interactive media & playback overrides (e.g., YouTube control)
    const localMediaRes = handleTabMediaAction(query);
    if (localMediaRes) {
      if (localMediaRes.success) {
        appendMessage('jarvis', localMediaRes.message);
        playBeep('success');
        chatHistory.push({ role: 'user', text: query });
        chatHistory.push({ role: 'model', text: localMediaRes.message });
      } else {
        appendMessage('system', `<strong>[MEDIA FAILURE]</strong>: ${localMediaRes.message}`);
      }
      return; // Stop standard Gemini network pipeline immediately
    }

    if (!apiKey) {
      appendMessage('system', "<strong>[CONNECTION REFUSED]</strong>: Your Gemini API Key is missing. Open the J.A.R.V.I.S. extension panel (puzzle icon on browser taskbar) to insert your key, or launch the web dashboard.");
      return;
    }

    // Capture state
    typingIndicator.style.display = "flex";
    chatBody.scrollTop = chatBody.scrollHeight;

    try {
      // Establish active prompt body
      let promptText = query;
      if (includeContext) {
        const pageContext = scrapePageTabDOM();
        promptText = `${pageContext}\n\nUsing the context of the active webpage tab provided above, please answer this question or request:\n${query}`;
      }

      // Build gemini call history arrays
      const contentsPayload = chatHistory.map(item => ({
        role: item.role === 'user' ? 'user' : 'model',
        parts: [{ text: item.text }]
      }));
      contentsPayload.push({
        role: 'user',
        parts: [{ text: promptText }]
      });

      // Execute REST payload to google v1beta generative platform
      const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: contentsPayload,
          systemInstruction: {
            parts: [{
              text: "You are JARVIS, an extremely brilliant, witty, dry-humored cybernetic assistant injected directly into the user's Chrome tab. Speak in Hinglish (a mixture of English and Hindi) when suitable, but remain extremely smart and high-tech. Answer questions concisely and precisely, referencing parsed webpage details if relevant."
            }]
          },
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 1000
          }
        })
      });

      const parsedRes = await response.json();
      const outputText = parsedRes.candidates?.[0]?.content?.parts?.[0]?.text;

      typingIndicator.style.display = "none";

      if (outputText) {
        appendMessage('jarvis', outputText);
        playBeep('success');
        
        // Push both states into system cache history
        chatHistory.push({ role: 'user', text: query });
        chatHistory.push({ role: 'model', text: outputText });
        if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
      } else {
        const errDetails = parsedRes.error?.message || "Invalid API parameters provided.";
        appendMessage('system', `<strong>[NEURAL PIPELINE FAILURE]</strong>: General parsing error. System response: "${errDetails}". Please verify your Gemini key is correct.`);
      }
    } catch (err) {
      typingIndicator.style.display = "none";
      appendMessage('system', `<strong>[CRITICAL CONNECTIVITY ERROR]</strong>: Unresolved HTTP networking failure: ${err.message}. Confirm you are connected to the internet.`);
    }
  }

  // Toggle open/close sidebar states
  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    playBeep('toggle');
    
    if (sidebarOpen) {
      sidebarContainer.classList.add("open");
      chatInput.focus();
      // Auto scrape and greet nicely if context checked
      refreshConfig();
    } else {
      sidebarContainer.classList.remove("open");
    }
  }

  // Listeners binding
  launcher.addEventListener("click", () => {
    toggleSidebar();
  });

  closeButton.addEventListener("click", () => {
    toggleSidebar();
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      submitInstruction();
    }
  });

  sendButton.addEventListener("click", () => {
    submitInstruction();
  });

  contextCheckbox.addEventListener("change", (e) => {
    includeContext = e.target.checked;
    chrome.storage.local.set({ include_context_default: includeContext });
    playBeep('click');
  });

  // Listen for background message triggers (e.g. keyboard shortcuts)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "toggle_sidebar") {
      toggleSidebar();
      sendResponse({ status: "success" });
    }
  });

})();
  
