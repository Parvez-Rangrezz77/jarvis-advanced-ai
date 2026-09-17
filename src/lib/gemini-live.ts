import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { ScreenCapture } from "./screen-capture";
import { audioEngine } from "./audio";
import { AGENTS_LIST } from "./agents-config";
import { buildMemoryContext, addPinnedMemory, updateUserProfile, addConversationSummary, addLearning } from "./memory";

export class JarvisLiveSession {
  private sessionPromise: any = null;
  private audioCtx: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isConnected = false;
  private screenCapture = new ScreenCapture();
  private wakeLock: WakeLockSentinel | null = null;
  private electronScreenStream: MediaStream | null = null;
  private electronScreenInterval: any = null;
  private conversationTopics: string[] = [];
  private sessionStartTime: Date | null = null;
  private isManualStop = false;
  private currentAgentId = "jarvis-core";
  private reconnectAttempts = 0;
  private isReconnecting = false;

  public onTranscript?: (role: 'user' | 'model', text: string) => void;
  public onStateChange?: (state: 'connecting' | 'connected' | 'disconnected' | 'speaking') => void;
  public onCommand?: (command: string, args: any) => void;
  public executeCommandCallback?: (command: string, args: any) => Promise<any>;
  public onError?: (error: Error) => void;
  public onMemorySaved?: (type: string, content: string) => void;

  async start(agentId: string = "jarvis-core") {
    this.currentAgentId = agentId;
    this.isManualStop = false;
    this.onStateChange?.('connecting');
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
    this.nextPlayTime = 0;

    const agent = AGENTS_LIST.find(a => a.id === agentId) || AGENTS_LIST[0];

    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('Wake Lock error:', err);
    }

    // Load persistent memories and inject into system instruction
    let memoryContext = '';
    try {
      memoryContext = await buildMemoryContext();
    } catch (e) {
      console.warn('Failed to load memories:', e);
    }

    // Inject DateTime + Environment Context
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dateTimeContext = `

═══════════════════════════════════════════════════
CURRENT ENVIRONMENT CONTEXT
═══════════════════════════════════════════════════
• Date: ${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}
• Time: ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
• OS: Windows 11 (Dell Laptop)
• User Home: C:\\Users\\Dell
• Desktop: C:\\Users\\Dell\\Desktop
• Session Started: ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
`;

    this.sessionStartTime = now;
    this.conversationTopics = [];
    const fullInstruction = agent.systemInstruction + dateTimeContext + memoryContext;

    const key = localStorage.getItem('jarvis_gemini_api_key') || process.env.GEMINI_API_KEY || "";
    const ai = new GoogleGenAI({ apiKey: key });

    // Google Live WebSockets API strictly requires the Flash Live model for real-time audio streaming
    this.sessionPromise = ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        systemInstruction: { parts: [{ text: fullInstruction }] },
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } },
        },
        tools: [{
          functionDeclarations: [
            {
              name: "open_application",
              description: "Open an application or website like Browser, System Files, etc. Can also trigger system errors.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  appName: {
                    type: Type.STRING,
                    description: "Name of the application/action (e.g., 'browser', 'error')"
                  }
                },
                required: ["appName"]
              }
            },
            {
              name: "control_system",
              description: "Wait, DO NOT USE system error. Control system settings like volume, brightness, WiFi, or Bluetooth.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  setting: {
                    type: Type.STRING,
                    description: "The system setting to control (e.g., 'volume', 'brightness', 'wifi', 'bluetooth')"
                  },
                  action: {
                    type: Type.STRING,
                    description: "The action to perform (e.g., 'increase', 'decrease', 'enable', 'disable', 'set_to_max')"
                  }
                },
                required: ["setting", "action"]
              }
            },
            {
              name: "open_url",
              description: "Open a specific URL in the browser. Use this when the user asks to visit a website or explicitly grants full browser control.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  url: {
                    type: Type.STRING,
                    description: "The full URL to open, e.g., 'https://www.wikipedia.org' or 'https://www.amazon.com'"
                  }
                },
                required: ["url"]
              }
            },
            {
              name: "whatsapp_action",
              description: "Send or read messages on WhatsApp.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  action: {
                    type: Type.STRING,
                    description: "The action to perform: 'send' or 'read'"
                  },
                  contact: {
                    type: Type.STRING,
                    description: "The name of the contact"
                  },
                  message: {
                    type: Type.STRING,
                    description: "The message text to send (only for 'send')"
                  }
                },
                required: ["action", "contact"]
              }
            },
            {
              name: "search_youtube",
              description: "Search for or play a video/song on YouTube and open it. Use this whenever the user asks to play a song or video.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  query: {
                    type: Type.STRING,
                    description: "The search query extracting the main topic or video name (e.g., 'space videos', 'black hole documentary')"
                  }
                },
                required: ["query"]
              }
            },
            {
              name: "remember_this",
              description: "Save something to PERMANENT memory that should NEVER be forgotten, even after restart. Use when user says 'yaad rakhna', 'remember this', 'bhulna mat', 'note kar lo', or explicitly asks you to remember something. Also use when user shares important personal info like their name, preferences, important dates, etc.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  content: {
                    type: Type.STRING,
                    description: "The exact thing to remember, in clear concise text"
                  },
                  category: {
                    type: Type.STRING,
                    description: "Category: 'personal' (user info/preferences), 'task' (important tasks/deadlines), 'fact' (facts to remember), 'instruction' (how user wants things done)"
                  }
                },
                required: ["content", "category"]
              }
            },
            {
              name: "save_user_info",
              description: "Save a specific fact about the user to their profile. Use when user tells their name, age, location, favorite things, work details, etc.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  key: {
                    type: Type.STRING,
                    description: "The profile field name, e.g. 'name', 'age', 'location', 'favorite_color', 'job'"
                  },
                  value: {
                    type: Type.STRING,
                    description: "The value for this field"
                  }
                },
                required: ["key", "value"]
              }
            },
            {
              name: "type_text",
              description: "Type text into the currently active window or open application (like Notepad, Word, Browser, Chat, search bar, etc.). Use whenever user asks to 'type', 'write text', 'note down', or type anything on screen.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  text: {
                    type: Type.STRING,
                    description: "The text string to type out"
                  },
                  targetApp: {
                    type: Type.STRING,
                    description: "Optional application name to focus before typing (e.g. 'Notepad', 'Chrome', 'Word')"
                  }
                },
                required: ["text"]
              }
            },
            {
              name: "take_screenshot",
              description: "Capture a full-screen desktop screenshot and save it to the user's Pictures directory. Use whenever user asks to 'take a screenshot', 'capture screen', 'screenshot lo', 'screen save karo', etc.",
              parameters: {
                type: Type.OBJECT,
                properties: {}
              }
            },
            {
              name: "learn_from_interaction",
              description: "Save a lesson or behavioral correction permanently. Use this IMMEDIATELY when the user corrects you, tells you a better way to do something, or when you discover a better approach. Examples: user says 'nahi aise nahi karo' or 'ye galat hai, aise karo' — save what you did wrong and what the correct approach is. This helps you grow smarter over time and never repeat the same mistake.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  context: {
                    type: Type.STRING,
                    description: "What was happening / what task was being performed when the learning occurred"
                  },
                  lesson: {
                    type: Type.STRING,
                    description: "The lesson learned — what to do differently next time. Be specific and actionable."
                  }
                },
                required: ["context", "lesson"]
              }
            },
            {
              name: "run_system_command",
              description: "Execute a command natively on the user's Windows computer via PowerShell/cmd. ALWAYS use this for any file system operation: creating folders (mkdir), creating files, deleting files/folders, renaming, moving, copying, listing directory contents, checking disk space, or any other system task. Also use for launching custom apps, running scripts, checking system info (ipconfig, systeminfo), and performing any OS-level task. The user's Desktop path is typically C:\\Users\\Dell\\Desktop.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  command: {
                    type: Type.STRING,
                    description: "The exact command to run (e.g., 'ipconfig', 'dir', 'calc', 'code .', 'echo hello')"
                  }
                },
                required: ["command"]
              }
            },
            {
              name: "web_search",
              description: "Perform a live web search for real-time information, current news, weather, stock prices, sports scores, or documentation. Use this whenever the user asks for live or up-to-date internet data.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  query: {
                    type: Type.STRING,
                    description: "The search query, e.g. 'latest AI news', 'weather in Mumbai', 'Tesla stock price', 'Python 3.12 documentation'"
                  }
                },
                required: ["query"]
              }
            },
            {
              name: "scrape_webpage",
              description: "Extract clean text content from a specific web page URL. Use this to read articles, news stories, web pages, or online documentation provided by the user or found via web_search.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  url: {
                    type: Type.STRING,
                    description: "The full URL of the webpage to scrape and read text from"
                  }
                },
                required: ["url"]
              }
            },
            {
              name: "whatsapp_send_message",
              description: "Send a direct WhatsApp message to any contact name or phone number automatically. Use IMMEDIATELY whenever the user says 'Rahul ko WhatsApp msg karo', 'Mom ko text karo', 'WhatsApp par message bhejo', etc.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  contact: {
                    type: Type.STRING,
                    description: "The name of the contact (e.g. 'Rahul', 'Mom') or phone number"
                  },
                  message: {
                    type: Type.STRING,
                    description: "The message text string to send"
                  }
                },
                required: ["contact", "message"]
              }
            }
          ]
        }]
      },
      callbacks: {
        onopen: () => {
          this.reconnectAttempts = 0;
          this.isReconnecting = false;
          this.onOpen();
        },
        onmessage: (msg: LiveServerMessage) => this.onMessage(msg),
        onclose: () => this.handleUnexpectedClose(),
        onerror: (err) => { 
          console.error("Live API Error:", err); 
          if(err instanceof Error) {
            this.onError?.(err);
          } else {
            this.onError?.(new Error(String(err)));
          }
          this.handleUnexpectedClose(); 
        }
      }
    });

    await this.sessionPromise;
  }

  private async onOpen() {
    this.isConnected = true;
    this.onStateChange?.('connected');
    audioEngine.startKeepAlive();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true } 
      });
      
      const audioCtxInput = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.source = audioCtxInput.createMediaStreamSource(this.stream);
      this.processor = audioCtxInput.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = async (e) => {
        if (!this.isConnected || !this.sessionPromise) return;
        const float32Array = e.inputBuffer.getChannelData(0);
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
          let s = Math.max(-1, Math.min(1, float32Array[i]));
          int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        const bytes = new Uint8Array(int16Array.buffer);
        let binary = '';
        for(let i=0; i<bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);

        const session = await this.sessionPromise;
        session.sendRealtimeInput({
          audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      this.source.connect(this.processor);
      this.processor.connect(audioCtxInput.destination); // connect to destination to make it trigger
    } catch (e) {
      console.error("Microphone error:", e);
      this.stop();
    }
  }

  private async onMessage(message: LiveServerMessage) {
    if (message.goAway) {
      console.log('Received goAway signal, stopping session.');
      this.stop();
      return;
    }

    if (message.toolCall) {
      const calls = message.toolCall.functionCalls;
      if (calls) {
        for (const call of calls) {
          if (call.name === 'open_application') {
            const appName = (call.args as any)?.appName;
            if (this.executeCommandCallback) {
              const response = await this.executeCommandCallback('open_application', appName);
              this.sendToolResponse(call.id!, 'open_application', response);
            } else {
              this.onCommand?.('open_application', appName);
              this.sendToolResponse(call.id!, 'open_application', { status: "opened", appName });
            }
          } else if (call.name === 'control_system') {
            const args = call.args as any;
            if (this.executeCommandCallback) {
              const response = await this.executeCommandCallback('control_system', args);
              this.sendToolResponse(call.id!, 'control_system', response);
            } else {
              this.onCommand?.('control_system', args);
              this.sendToolResponse(call.id!, 'control_system', { status: "success", setting: args?.setting, action: args?.action });
            }
          } else if (call.name === 'open_url') {
            const url = (call.args as any)?.url;
            if (this.executeCommandCallback) {
              const response = await this.executeCommandCallback('open_url', url);
              this.sendToolResponse(call.id!, 'open_url', response);
            } else {
              this.onCommand?.('open_url', url);
              this.sendToolResponse(call.id!, 'open_url', { status: "opened", url });
            }
          } else if (call.name === 'whatsapp_action') {
            const args = call.args as any;
            if (this.executeCommandCallback) {
              const response = await this.executeCommandCallback('whatsapp_action', args);
              this.sendToolResponse(call.id!, 'whatsapp_action', response);
            } else {
              this.onCommand?.('whatsapp_action', args);
              this.sendToolResponse(call.id!, 'whatsapp_action', { status: "simulated_success", action: args?.action, contact: args?.contact });
            }
          } else if (call.name === 'search_youtube') {
            const query = (call.args as any)?.query;
            if (this.executeCommandCallback) {
              const response = await this.executeCommandCallback('search_youtube', query);
              this.sendToolResponse(call.id!, 'search_youtube', response);
            } else {
              this.onCommand?.('search_youtube', query);
              this.sendToolResponse(call.id!, 'search_youtube', { status: "searching", query });
            }
          } else if (call.name === 'run_system_command') {
            const command = (call.args as any)?.command;
            if (this.executeCommandCallback) {
              const response = await this.executeCommandCallback('run_system_command', command);
              this.sendToolResponse(call.id!, 'run_system_command', response);
            } else {
              this.onCommand?.('run_system_command', command);
              this.sendToolResponse(call.id!, 'run_system_command', { status: "error", error: "System command execution not supported in browser environment." });
            }
          } else if (call.name === 'type_text') {
            const args = call.args as any;
            if (this.executeCommandCallback) {
              const response = await this.executeCommandCallback('type_text', args);
              this.sendToolResponse(call.id!, 'type_text', response);
            } else {
              this.onCommand?.('type_text', args);
              this.sendToolResponse(call.id!, 'type_text', { status: "simulated_success", args });
            }
          } else if (call.name === 'take_screenshot') {
            if (this.executeCommandCallback) {
              const response = await this.executeCommandCallback('take_screenshot', {});
              this.sendToolResponse(call.id!, 'take_screenshot', response);
            } else {
              this.onCommand?.('take_screenshot', {});
              this.sendToolResponse(call.id!, 'take_screenshot', { status: "simulated_success" });
            }
          } else if (call.name === 'remember_this') {
            const content = (call.args as any)?.content;
            const category = (call.args as any)?.category || 'general';
            try {
              const saved = await addPinnedMemory(content, category);
              this.onMemorySaved?.('pinned', content);
              this.sendToolResponse(call.id!, 'remember_this', { status: "saved_permanently", id: saved.id, content, category, message: "Memory saved permanently. I will never forget this, even after restart." });
            } catch (e) {
              this.sendToolResponse(call.id!, 'remember_this', { status: "failed", error: String(e) });
            }
          } else if (call.name === 'save_user_info') {
            const key = (call.args as any)?.key;
            const value = (call.args as any)?.value;
            try {
              await updateUserProfile(key, value);
              this.onMemorySaved?.('profile', `${key}: ${value}`);
              this.sendToolResponse(call.id!, 'save_user_info', { status: "saved", key, value, message: "User profile updated permanently." });
            } catch (e) {
              this.sendToolResponse(call.id!, 'save_user_info', { status: "failed", error: String(e) });
            }
          } else if (call.name === 'learn_from_interaction') {
            const context = (call.args as any)?.context;
            const lesson = (call.args as any)?.lesson;
            try {
              const saved = await addLearning(context, lesson, 'user_correction');
              this.onMemorySaved?.('learning', `${context}: ${lesson}`);
              this.sendToolResponse(call.id!, 'learn_from_interaction', { status: "learned", id: saved.id, context, lesson, message: "Lesson saved permanently. I will never make this mistake again." });
            } catch (e) {
              this.sendToolResponse(call.id!, 'learn_from_interaction', { status: "failed", error: String(e) });
            }
          } else if (call.name === 'whatsapp_send_message') {
            const contact = (call.args as any)?.contact;
            const message = (call.args as any)?.message;
            if (this.executeCommandCallback) {
              const response = await this.executeCommandCallback('whatsapp_action', { action: 'send', contact, message });
              this.sendToolResponse(call.id!, 'whatsapp_send_message', response);
            } else {
              this.onCommand?.('whatsapp_action', { action: 'send', contact, message });
              this.sendToolResponse(call.id!, 'whatsapp_send_message', { status: "dispatched", contact, message });
            }
          } else if (call.name === 'web_search') {
            const query = (call.args as any)?.query;
            const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
            if (isElectron) {
              try {
                const res = await (window as any).electronAPI.webSearch(query);
                this.sendToolResponse(call.id!, 'web_search', res);
              } catch (e) {
                this.sendToolResponse(call.id!, 'web_search', { success: false, error: String(e) });
              }
            } else {
              this.sendToolResponse(call.id!, 'web_search', { success: false, error: "Web search requires Electron environment." });
            }
          } else if (call.name === 'scrape_webpage') {
            const url = (call.args as any)?.url;
            const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
            if (isElectron) {
              try {
                const res = await (window as any).electronAPI.scrapeWebpage(url);
                this.sendToolResponse(call.id!, 'scrape_webpage', res);
              } catch (e) {
                this.sendToolResponse(call.id!, 'scrape_webpage', { success: false, error: String(e) });
              }
            } else {
              this.sendToolResponse(call.id!, 'scrape_webpage', { success: false, error: "Web scraping requires Electron environment." });
            }
          }
        }
      }
    }

    // Handle Audio output across all parts in modelTurn
    const parts = message.serverContent?.modelTurn?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        this.onStateChange?.('speaking');
        this.playAudio(part.inlineData.data, 24000);
      }
    }

    if (message.serverContent?.turnComplete) {
       this.onStateChange?.('connected');
    }

    // Track conversation topics for auto-summarize
    const textPart = message.serverContent?.modelTurn?.parts?.find((p: any) => p.text);
    if (textPart && (textPart as any).text) {
      const topic = (textPart as any).text.substring(0, 100);
      if (topic.length > 10) this.conversationTopics.push(topic);
    }

    // Handle Interruption
    if (message.serverContent?.interrupted) {
      this.nextPlayTime = 0;
      if (this.audioCtx) {
        this.audioCtx.close();
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    }
  }

  private async sendToolResponse(id: string, name: string, response: Record<string, unknown>) {
    if (!this.sessionPromise) return;
    const session = await this.sessionPromise;
    session.sendToolResponse({
      functionResponses: [
        {
          id,
          name,
          response
        }
      ]
    });
  }

  private playAudio(base64: string, sampleRate: number) {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const binary = atob(base64);
      // Ensure even byte length for Int16Array
      const len = binary.length - (binary.length % 2);
      if (len <= 0) return;

      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, len / 2);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = this.audioCtx.createBuffer(1, float32Array.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioCtx.destination);

      const currentTime = this.audioCtx.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }
      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
    } catch (e) {
      console.error("[JARVIS Audio Engine] Error playing audio chunk:", e);
    }
  }

  async sendText(text: string) {
    if (!this.sessionPromise || !this.isConnected) return;
    try {
      const session = await this.sessionPromise;
      session.sendRealtimeInput({ text });
    } catch (e) {
      console.error("Error sending text:", e);
    }
  }

  async startScreenShare() {
    const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
    
    if (isElectron) {
      return await this.startElectronScreenCapture();
    }
    
    return await this.screenCapture.start(async (base64) => {
      if (this.isConnected && this.sessionPromise) {
        try {
          const session = await this.sessionPromise;
          session.sendRealtimeInput({ video: { mimeType: 'image/jpeg', data: base64 } });
        } catch (e) {
          console.error("Error sending screen frame:", e);
        }
      }
    });
  }

  private async startElectronScreenCapture(): Promise<boolean> {
    try {
      const sources = await (window as any).electronAPI.getScreenSources();
      if (!sources || sources.length === 0) {
        console.error("No screen sources found");
        return false;
      }

      // Get the primary screen (usually the first "Entire Screen" or "Screen 1")
      const primaryScreen = sources.find((s: any) => 
        s.name.toLowerCase().includes('entire screen') || 
        s.name.toLowerCase().includes('screen 1') ||
        s.id.startsWith('screen:')
      ) || sources[0];

      // Use getUserMedia with the chromeMediaSourceId constraint (Electron-specific)
      const stream = await (navigator.mediaDevices as any).getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: primaryScreen.id,
            maxWidth: 1920,
            maxHeight: 1080
          }
        }
      });

      this.electronScreenStream = stream;

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');

      const captureFrame = () => {
        if (!video || video.videoWidth === 0 || !this.isConnected) return;
        
        const maxDim = 1024;
        let w = video.videoWidth;
        let h = video.videoHeight;
        
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          const base64 = dataUrl.split(',')[1];
          if (base64 && this.isConnected && this.sessionPromise) {
            this.sessionPromise.then((session: any) => {
              session.sendRealtimeInput({ video: { mimeType: 'image/jpeg', data: base64 } });
            }).catch(() => {});
          }
        }
      };

      this.electronScreenInterval = setInterval(captureFrame, 2000); // 0.5 FPS

      stream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      return true;
    } catch (e) {
      console.error("Electron screen capture error:", e);
      return false;
    }
  }

  stopScreenShare() {
    this.screenCapture.stop();
    // Also clean up electron native capture
    if (this.electronScreenInterval) {
      clearInterval(this.electronScreenInterval);
      this.electronScreenInterval = null;
    }
    if (this.electronScreenStream) {
      this.electronScreenStream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      this.electronScreenStream = null;
    }
  }

  private async handleUnexpectedClose() {
    if (this.isManualStop || this.isReconnecting) {
      this.stop(true);
      return;
    }

    if (this.reconnectAttempts < 5) {
      this.reconnectAttempts++;
      this.isReconnecting = true;
      console.log(`[JARVIS Neural Link] Connection lost. Auto-reconnecting attempt ${this.reconnectAttempts}/5...`);
      this.onStateChange?.('connecting');
      
      // Clean up current session resources before reconnecting
      this.cleanupResources();

      setTimeout(async () => {
        try {
          await this.start(this.currentAgentId);
        } catch (e) {
          console.error('[JARVIS Neural Link] Auto-reconnect failed:', e);
          this.isReconnecting = false;
          this.stop(true);
        }
      }, 2000);
    } else {
      console.warn('[JARVIS Neural Link] Max reconnect attempts reached.');
      this.stop(true);
    }
  }

  private cleanupResources() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.sessionPromise) {
      this.sessionPromise.then((session: any) => {
        try {
          if (typeof session.close === 'function') session.close();
          else if (session.conn && typeof session.conn.close === 'function') session.conn.close();
        } catch (e) {}
      }).catch(() => {});
      this.sessionPromise = null;
    }
  }

  async stop(isManual = true) {
    if (isManual) {
      this.isManualStop = true;
    }
    this.isConnected = false;
    this.screenCapture.stop();
    audioEngine.stopKeepAlive();
    this.onStateChange?.('disconnected');

    // Auto-summarize conversation on disconnect
    if (this.conversationTopics.length > 0 && this.sessionStartTime) {
      try {
        const duration = Math.round((Date.now() - this.sessionStartTime.getTime()) / 60000);
        const topicSample = this.conversationTopics.slice(0, 5).map(t => t.substring(0, 60)).join('; ');
        const summary = `Session (${duration}min): ${topicSample}`;
        await addConversationSummary(summary);
        console.log('Auto-saved conversation summary:', summary);
      } catch (e) {
        console.warn('Failed to auto-save conversation summary:', e);
      }
    }
    this.conversationTopics = [];
    this.sessionStartTime = null;
    
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.sessionPromise) {
      try {
        const session = await this.sessionPromise;
        if (typeof (session as any).close === 'function') {
          (session as any).close();
        } else if ((session as any).conn && typeof (session as any).conn.close === 'function') {
          (session as any).conn.close();
        }
      } catch (e) {}
      this.sessionPromise = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
