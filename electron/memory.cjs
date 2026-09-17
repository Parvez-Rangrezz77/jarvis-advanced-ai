const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Store memories in user's app data so they persist across updates
const MEMORY_FILE = path.join(app.getPath('userData'), 'jarvis-memory.json');

function loadMemoryFile() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = fs.readFileSync(MEMORY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load memory file:', e);
  }
  return {
    pinnedMemories: [],
    conversationHistory: [],
    userProfile: {},
    learnings: []
  };
}

function saveMemoryFile(data) {
  try {
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to save memory file:', e);
    return false;
  }
}

function addPinnedMemory(content, category = 'general') {
  const data = loadMemoryFile();
  const memory = {
    id: Date.now().toString(),
    content,
    category,
    createdAt: new Date().toISOString(),
    neverForget: true
  };
  data.pinnedMemories.push(memory);
  saveMemoryFile(data);
  return memory;
}

function addConversationSummary(summary) {
  const data = loadMemoryFile();
  const entry = {
    id: Date.now().toString(),
    summary,
    timestamp: new Date().toISOString()
  };
  data.conversationHistory.push(entry);
  if (data.conversationHistory.length > 50) {
    data.conversationHistory = data.conversationHistory.slice(-50);
  }
  saveMemoryFile(data);
  return entry;
}

function updateUserProfile(key, value) {
  const data = loadMemoryFile();
  data.userProfile[key] = value;
  saveMemoryFile(data);
}

function addLearning(context, lesson, source = 'user_correction') {
  const data = loadMemoryFile();
  if (!data.learnings) data.learnings = [];
  const learning = {
    id: Date.now().toString(),
    context,
    lesson,
    source,
    createdAt: new Date().toISOString()
  };
  data.learnings.push(learning);
  // Keep only last 100 learnings
  if (data.learnings.length > 100) {
    data.learnings = data.learnings.slice(-100);
  }
  saveMemoryFile(data);
  return learning;
}

function getAllMemories() {
  return loadMemoryFile();
}

function deletePinnedMemory(id) {
  const data = loadMemoryFile();
  data.pinnedMemories = data.pinnedMemories.filter(m => m.id !== id);
  saveMemoryFile(data);
}

function clearConversationHistory() {
  const data = loadMemoryFile();
  data.conversationHistory = [];
  saveMemoryFile(data);
}

function getMemoryFilePath() {
  return MEMORY_FILE;
}

module.exports = {
  loadMemoryFile,
  saveMemoryFile,
  addPinnedMemory,
  addConversationSummary,
  updateUserProfile,
  addLearning,
  getAllMemories,
  deletePinnedMemory,
  clearConversationHistory,
  getMemoryFilePath
};
