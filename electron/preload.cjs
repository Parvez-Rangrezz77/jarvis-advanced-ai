const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Stats Listener
  onSystemStatsUpdate: (callback) => {
    const subscription = (event, stats) => callback(stats);
    ipcRenderer.on('system-stats', subscription);
    return () => {
      ipcRenderer.removeListener('system-stats', subscription);
    };
  },
  
  // App Control & Shell Exec
  openApp: (appName) => ipcRenderer.invoke('open-app', appName),
  executeCommand: (command) => ipcRenderer.invoke('execute-system-command', command),
  typeText: (payload) => ipcRenderer.invoke('type-text', payload),
  sendWhatsApp: (payload) => ipcRenderer.invoke('send-whatsapp', payload),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  
  // Direct Screen Vision & Screenshot Capturing
  getScreenSources: () => ipcRenderer.invoke('get-desktop-sources'),
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  
  // Window Control Actions (Minimize, Maximize, Close)
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),

  // Persistent Memory System
  memoryGetAll: () => ipcRenderer.invoke('memory-get-all'),
  memoryAddPinned: (content, category) => ipcRenderer.invoke('memory-add-pinned', content, category),
  memoryAddConversation: (summary) => ipcRenderer.invoke('memory-add-conversation', summary),
  memoryUpdateProfile: (key, value) => ipcRenderer.invoke('memory-update-profile', key, value),
  memoryDeletePinned: (id) => ipcRenderer.invoke('memory-delete-pinned', id),
  memoryGetPath: () => ipcRenderer.invoke('memory-get-path'),
  memoryAddLearning: (context, lesson, source) => ipcRenderer.invoke('memory-add-learning', context, lesson, source),

  // Live Web Intelligence & Scraping
  webSearch: (query) => ipcRenderer.invoke('web-search', query),
  scrapeWebpage: (url) => ipcRenderer.invoke('scrape-webpage', url)
});
