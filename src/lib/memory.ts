// JARVIS Persistent Memory Manager (Frontend)
// Interfaces with Electron's memory IPC or falls back to localStorage

export interface PinnedMemory {
  id: string;
  content: string;
  category: string;
  createdAt: string;
  neverForget: boolean;
}

export interface ConversationEntry {
  id: string;
  summary: string;
  timestamp: string;
}

export interface MemoryStore {
  pinnedMemories: PinnedMemory[];
  conversationHistory: ConversationEntry[];
  userProfile: Record<string, string>;
  learnings: Learning[];
}

export interface Learning {
  id: string;
  context: string;
  lesson: string;
  source: string;
  createdAt: string;
}

const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

// LocalStorage fallback keys
const LS_KEY = 'jarvis_memory_store';

function getLocalStorageMemory(): MemoryStore {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { pinnedMemories: [], conversationHistory: [], userProfile: {}, learnings: [] };
}

function saveLocalStorageMemory(data: MemoryStore) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

export async function getAllMemories(): Promise<MemoryStore> {
  if (isElectron) {
    return await (window as any).electronAPI.memoryGetAll();
  }
  return getLocalStorageMemory();
}

export async function addPinnedMemory(content: string, category: string = 'general'): Promise<PinnedMemory> {
  if (isElectron) {
    return await (window as any).electronAPI.memoryAddPinned(content, category);
  }
  // LocalStorage fallback
  const data = getLocalStorageMemory();
  const memory: PinnedMemory = {
    id: Date.now().toString(),
    content,
    category,
    createdAt: new Date().toISOString(),
    neverForget: true
  };
  data.pinnedMemories.push(memory);
  saveLocalStorageMemory(data);
  return memory;
}

export async function addConversationSummary(summary: string): Promise<ConversationEntry> {
  if (isElectron) {
    return await (window as any).electronAPI.memoryAddConversation(summary);
  }
  const data = getLocalStorageMemory();
  const entry: ConversationEntry = {
    id: Date.now().toString(),
    summary,
    timestamp: new Date().toISOString()
  };
  data.conversationHistory.push(entry);
  if (data.conversationHistory.length > 50) {
    data.conversationHistory = data.conversationHistory.slice(-50);
  }
  saveLocalStorageMemory(data);
  return entry;
}

export async function updateUserProfile(key: string, value: string): Promise<void> {
  if (isElectron) {
    await (window as any).electronAPI.memoryUpdateProfile(key, value);
    return;
  }
  const data = getLocalStorageMemory();
  data.userProfile[key] = value;
  saveLocalStorageMemory(data);
}

export async function deletePinnedMemory(id: string): Promise<void> {
  if (isElectron) {
    await (window as any).electronAPI.memoryDeletePinned(id);
    return;
  }
  const data = getLocalStorageMemory();
  data.pinnedMemories = data.pinnedMemories.filter(m => m.id !== id);
  saveLocalStorageMemory(data);
}

export async function addLearning(context: string, lesson: string, source: string = 'user_correction'): Promise<Learning> {
  if (isElectron) {
    return await (window as any).electronAPI.memoryAddLearning(context, lesson, source);
  }
  // LocalStorage fallback
  const data = getLocalStorageMemory();
  if (!data.learnings) data.learnings = [];
  const learning: Learning = {
    id: Date.now().toString(),
    context,
    lesson,
    source,
    createdAt: new Date().toISOString()
  };
  data.learnings.push(learning);
  if (data.learnings.length > 100) {
    data.learnings = data.learnings.slice(-100);
  }
  saveLocalStorageMemory(data);
  return learning;
}

/**
 * Builds a memory context string to inject into the system prompt
 */
export async function buildMemoryContext(): Promise<string> {
  const mem = await getAllMemories();
  const parts: string[] = [];

  // Pinned memories (NEVER FORGET)
  if (mem.pinnedMemories.length > 0) {
    parts.push('=== PERMANENT MEMORIES (NEVER FORGET) ===');
    for (const m of mem.pinnedMemories) {
      parts.push(`• [${m.category.toUpperCase()}] ${m.content} (saved: ${new Date(m.createdAt).toLocaleDateString()})`);
    }
  }

  // User profile
  const profileKeys = Object.keys(mem.userProfile);
  if (profileKeys.length > 0) {
    parts.push('\n=== USER PROFILE ===');
    for (const key of profileKeys) {
      parts.push(`• ${key}: ${mem.userProfile[key]}`);
    }
  }

  // Recent conversations (last 10)
  if (mem.conversationHistory.length > 0) {
    const recent = mem.conversationHistory.slice(-10);
    parts.push('\n=== RECENT CONVERSATION HISTORY ===');
    for (const c of recent) {
      parts.push(`• [${new Date(c.timestamp).toLocaleDateString()}] ${c.summary}`);
    }
  }

  // Behavioral learnings (last 20)
  const learnings = mem.learnings || [];
  if (learnings.length > 0) {
    const recentLearnings = learnings.slice(-20);
    parts.push('\n=== BEHAVIORAL LEARNINGS (APPLY ALWAYS) ===');
    for (const l of recentLearnings) {
      parts.push(`• [${l.source}] Context: ${l.context} → Lesson: ${l.lesson}`);
    }
  }

  return parts.length > 0 ? '\n\n' + parts.join('\n') : '';
}
