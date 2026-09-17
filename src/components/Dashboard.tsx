import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AiCore } from "./AiCore";
import { ScreenVision } from "./ScreenVision";
import { ChromeCompanion } from "./ChromeCompanion";
import { audioEngine } from "../lib/audio";
import { JarvisLiveSession } from "../lib/gemini-live";
import { AGENTS_LIST, AgentConfig } from "../lib/agents-config";
import { 
  Mic, Activity, Zap, HardDrive, Wifi, Settings, PlusSquare, 
  PlaySquare, Search, Video, VideoOff, Calendar, PhoneOff, Send,
  Brain, Eye, MessageSquare, Cpu, RefreshCw, Chrome
} from "lucide-react";

export const Dashboard: React.FC = () => {
  const [liveSession, setLiveSession] = useState<JarvisLiveSession | null>(null);
  const [liveState, setLiveState] = useState<'disconnected' | 'connecting' | 'connected' | 'speaking'>('disconnected');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [time, setTime] = useState(new Date());
  const [activeAgentId, setActiveAgentId] = useState<string>("jarvis-core");
  const [activeMainTab, setActiveMainTab] = useState<'voice' | 'vision' | 'chrome'>('voice');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem('jarvis_gemini_api_key') || "");
  const [customSoundInput, setCustomSoundInput] = useState(localStorage.getItem('jarvis_custom_task_sound') || "/sounds/whatsapp_audio.mp3");
  
  // Simulated stats
  const [cpu, setCpu] = useState(12);
  const [ram, setRam] = useState(34);
  const [network, setNetwork] = useState(120);
  const [systemError, setSystemError] = useState(false);
  const [systemAction, setSystemAction] = useState<string | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [extensionInstalled, setExtensionInstalled] = useState(false);

  useEffect(() => {
    // Check if attribute is already parsed on load
    if (document.documentElement.getAttribute("data-jarvis-extension-installed") === "true") {
      setExtensionInstalled(true);
    }

    // Set up handshake event listener from Chrome Companion script run
    const handleHandshake = () => {
      setExtensionInstalled(true);
    };
    window.addEventListener("jarvis-extension-handshake", handleHandshake);
    return () => {
      window.removeEventListener("jarvis-extension-handshake", handleHandshake);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    let unsubscribeStats: (() => void) | undefined;
    let statsTimer: any;
    const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

    if (isElectron) {
      unsubscribeStats = (window as any).electronAPI.onSystemStatsUpdate((stats: { cpu: number; ram: number }) => {
        setCpu(stats.cpu);
        setRam(stats.ram);
        setNetwork(prev => Math.min(500, Math.max(0, prev + Math.floor(Math.random() * 20 - 10))));
      });
    } else {
      statsTimer = setInterval(() => {
        setCpu(prev => Math.min(100, Math.max(0, prev + (Math.random() * 10 - 5))));
        setRam(prev => Math.min(100, Math.max(0, prev + (Math.random() * 4 - 2))));
        setNetwork(Math.floor(Math.random() * 500));
      }, 2000);
    }
    
    return () => {
      clearInterval(timer);
      if (unsubscribeStats) unsubscribeStats();
      if (statsTimer) clearInterval(statsTimer);
      if (liveSession) {
        liveSession.stop();
      }
    };
  }, [liveSession]);

  const activeAgent = AGENTS_LIST.find(a => a.id === activeAgentId) || AGENTS_LIST[0];

  const handleAgentCommand = async (cmd: string, arg: any) => {
    const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
    
    if (cmd === 'run_system_command') {
      const command = String(arg);
      setSystemAction(`RUNNING: ${command.substring(0, 30)}...`);
      audioEngine.playBeep('scan');
      if (isElectron) {
        const res = await (window as any).electronAPI.executeCommand(command);
        if (res.success) {
          setSystemAction(`EXECUTED: SUCCESS`);
        } else {
          setSystemAction(`EXECUTED: FAILED`);
        }
      } else {
        setSystemAction(`SYSTEM RUN: [SIMULATED]`);
      }
      setTimeout(() => setSystemAction(null), 4000);
      return;
    }

    if (cmd === 'control_system') {
      const setting = arg?.setting || 'system';
      const action = arg?.action || 'adjust';
      
      if (isElectron) {
        setSystemAction(`${action.toUpperCase()} ${setting.toUpperCase()} [NATIVE]`);
        audioEngine.playBeep('scan');
        
        let psCmd = '';
        if (setting === 'volume') {
          if (action === 'increase') {
            psCmd = "(New-Object -ComObject WScript.Shell).SendKeys([char]175)";
          } else if (action === 'decrease') {
            psCmd = "(New-Object -ComObject WScript.Shell).SendKeys([char]174)";
          } else if (action === 'mute' || action === 'disable') {
            psCmd = "(New-Object -ComObject WScript.Shell).SendKeys([char]173)";
          }
        }
        if (psCmd) {
          await (window as any).electronAPI.executeCommand(psCmd);
        }
      } else {
        const actionText = `${action.toUpperCase()} ${setting.toUpperCase()} [SIMULATED]`;
        setSystemAction(actionText);
        audioEngine.playBeep('scan');
      }
      setTimeout(() => setSystemAction(null), 4000);
    } else if (cmd === 'open_url') {
      let url = String(arg);
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      
      if (isElectron) {
        setSystemAction(`OPENING URL`);
        audioEngine.playBeep('startup');
        await (window as any).electronAPI.openUrl(url);
        setTimeout(() => setSystemAction(null), 4000);
      } else {
        window.postMessage({ source: 'jarvis-web-panel', action: 'open_url', url }, '*');
        const isExtInstalled = document.documentElement.getAttribute("data-jarvis-extension-installed") === "true" || extensionInstalled;
        if (isExtInstalled) {
          setSystemAction(`COMPANION UPLINK ROUTED`);
          audioEngine.playBeep('startup');
          setTimeout(() => setSystemAction(null), 4000);
        } else {
          const newWindow = window.open(url, '_blank');
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            setPendingUrl(url);
            audioEngine.playBeep('scan');
          }
        }
      }
    } else if (cmd === 'search_youtube') {
      const query = String(arg);
      const targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      
      if (isElectron) {
        setSystemAction(`SEARCHING YOUTUBE`);
        audioEngine.playBeep('startup');
        await (window as any).electronAPI.openUrl(targetUrl);
        setTimeout(() => setSystemAction(null), 4000);
      } else {
        window.postMessage({ source: 'jarvis-web-panel', action: 'open_url', url: targetUrl }, '*');
        const isExtInstalled = document.documentElement.getAttribute("data-jarvis-extension-installed") === "true" || extensionInstalled;
        if (isExtInstalled) {
          setSystemAction(`YOUTUBE ASSIST ROUTED`);
          audioEngine.playBeep('startup');
          setTimeout(() => setSystemAction(null), 4000);
        } else {
          const newWindow = window.open(targetUrl, '_blank');
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            setPendingUrl(targetUrl);
            audioEngine.playBeep('scan');
          }
        }
      }
    } else if (cmd === 'whatsapp_action') {
      const { action, contact, message } = arg as any;
      let url = '';
      if (action === 'send') {
        url = `https://web.whatsapp.com/send?text=${encodeURIComponent(message || '')}`;
        setSystemAction(`SENDING WHATSAPP TO ${contact?.toUpperCase()} [SIMULATED]`);
      } else {
        url = 'https://web.whatsapp.com/';
        setSystemAction(`READING WHATSAPP FROM ${contact?.toUpperCase()} [SIMULATED]`);
      }
      
      if (isElectron) {
        audioEngine.playBeep('startup');
        await (window as any).electronAPI.openUrl(url);
        setTimeout(() => setSystemAction(null), 4000);
      } else {
        window.postMessage({ source: 'jarvis-web-panel', action: 'open_url', url }, '*');
        const isExtInstalled = document.documentElement.getAttribute("data-jarvis-extension-installed") === "true" || extensionInstalled;
        if (isExtInstalled) {
          audioEngine.playBeep('startup');
          setTimeout(() => setSystemAction(null), 4000);
        } else {
          setPendingUrl(url);
          audioEngine.playBeep('scan');
          setTimeout(() => setSystemAction(null), 4000);
        }
      }
    } else if (cmd === 'open_application') {
      const app = String(arg).toLowerCase();
      
      if (isElectron) {
        setSystemAction(`OPENING ${app.toUpperCase()} [NATIVE]`);
        audioEngine.playBeep('scan');
        const res = await (window as any).electronAPI.openApp(app);
        if (!res.success) {
          setSystemAction(`FAILED TO OPEN ${app.toUpperCase()}`);
        }
        setTimeout(() => setSystemAction(null), 4000);
        return;
      }

      let targetUrl = '';
      if (app.includes('youtube')) {
        targetUrl = 'https://youtube.com';
      } else if (app.includes('browser') || app.includes('search') || app.includes('chrome')) {
        targetUrl = 'https://google.com';
      } else if (app.includes('files') || app.includes('folder')) {
        setSystemAction(`OPENING ${app.toUpperCase()} [SIMULATED]`);
        audioEngine.playBeep('scan');
        setTimeout(() => setSystemAction(null), 4000);
        return;
      } else if (app.includes('error')) {
        audioEngine.playBeep('error');
        setSystemError(true);
        setTimeout(() => setSystemError(false), 3000);
        return;
      } else {
        setSystemAction(`OPENING ${app.toUpperCase()} [SIMULATED]`);
        audioEngine.playBeep('scan');
        setTimeout(() => setSystemAction(null), 4000);
        return;
      }

      if (targetUrl) {
        window.postMessage({ source: 'jarvis-web-panel', action: 'open_url', url: targetUrl }, '*');
        const isExtInstalled = document.documentElement.getAttribute("data-jarvis-extension-installed") === "true" || extensionInstalled;
        if (isExtInstalled) {
          setSystemAction(`APPLICATION ROUTED`);
          audioEngine.playBeep('startup');
          setTimeout(() => setSystemAction(null), 4000);
        } else {
          const newWindow = window.open(targetUrl, '_blank');
          if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
            setPendingUrl(targetUrl);
            audioEngine.playBeep('scan');
          }
        }
      }
    }
  };

  const setupSessionCallbacks = (session: JarvisLiveSession) => {
    const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

    session.onStateChange = (state) => {
      setLiveState(state);
    };

    session.onError = (e) => {
      if (e.message.includes('Network error')) {
        setSystemError(true);
        setSystemAction("NETWORK ERROR: SERVER OR QUOTA LIMIT. RETRY IN A FEW SECONDS.");
        setTimeout(() => setSystemAction(null), 5000);
        setTimeout(() => setSystemError(false), 3000);
      }
    };

    session.onCommand = handleAgentCommand;

    session.onMemorySaved = (type: string, content: string) => {
      const label = type === 'profile' ? 'PROFILE UPDATED' : 'MEMORY LOCKED';
      setSystemAction(`🧠 ${label}: ${content.substring(0, 40)}...`);
      audioEngine.playBeep('startup');
      setTimeout(() => setSystemAction(null), 4000);
    };

    session.executeCommandCallback = async (cmd: string, arg: any) => {
      if (!isElectron) {
        // In browser mode, onCommand handles everything via handleAgentCommand
        // This callback is just a fallback
        if (cmd === 'open_url') {
          window.open(String(arg), '_blank');
          return { status: "opened", url: arg };
        }
        return { status: "simulated_success", cmd, arg };
      }

      const api = (window as any).electronAPI;
      
      if (cmd === 'open_application') {
        const app = String(arg).toLowerCase();
        setSystemAction(`OPENING ${app.toUpperCase()} [NATIVE]`);
        audioEngine.playTaskSound();
        const res = await api.openApp(app);
        if (!res.success) {
          setSystemAction(`FAILED TO OPEN ${app.toUpperCase()}`);
        }
        setTimeout(() => setSystemAction(null), 4000);
        return res.success ? { status: "opened", appName: arg } : { status: "failed", error: res.error };
      } else if (cmd === 'open_url') {
        setSystemAction(`OPENING URL`);
        audioEngine.playTaskSound();
        const res = await api.openUrl(String(arg));
        setTimeout(() => setSystemAction(null), 4000);
        return res.success ? { status: "opened", url: arg } : { status: "failed", error: res.error };
      } else if (cmd === 'run_system_command') {
        const command = String(arg);
        setSystemAction(`RUNNING: ${command.substring(0, 30)}...`);
        audioEngine.playTaskSound();
        const res = await api.executeCommand(command);
        if (res.success) {
          setSystemAction(`EXECUTED: SUCCESS`);
        } else {
          setSystemAction(`EXECUTED: FAILED`);
        }
        setTimeout(() => setSystemAction(null), 4000);
        return res.success 
          ? { status: "executed", stdout: res.stdout, stderr: res.stderr }
          : { status: "failed", error: res.error, stdout: res.stdout, stderr: res.stderr };
      } else if (cmd === 'type_text') {
        const text = typeof arg === 'string' ? arg : (arg?.text || '');
        const targetApp = typeof arg === 'object' ? arg?.targetApp : undefined;
        setSystemAction(`TYPING: "${text.substring(0, 25)}..."`);
        audioEngine.playTaskSound();
        const res = await api.typeText({ text, targetApp });
        setTimeout(() => setSystemAction(null), 4000);
        return res.success ? { status: "typed", text } : { status: "failed", error: res.error };
      } else if (cmd === 'take_screenshot') {
        setSystemAction(`CAPTURING SCREENSHOT...`);
        audioEngine.playTaskSound();
        const res = await api.takeScreenshot();
        if (res.success) {
          setSystemAction(`SCREENSHOT SAVED: ${res.filename}`);
        } else {
          setSystemAction(`SCREENSHOT FAILED`);
        }
        setTimeout(() => setSystemAction(null), 4000);
        return res;
      } else if (cmd === 'control_system') {
        const setting = arg?.setting;
        const action = arg?.action;
        setSystemAction(`${(action || 'ADJUST').toUpperCase()} ${(setting || 'SYSTEM').toUpperCase()} [NATIVE]`);
        audioEngine.playTaskSound();
        let psCmd = '';
        if (setting === 'volume') {
          if (action === 'increase') {
            psCmd = "(New-Object -ComObject WScript.Shell).SendKeys([char]175)";
          } else if (action === 'decrease') {
            psCmd = "(New-Object -ComObject WScript.Shell).SendKeys([char]174)";
          } else if (action === 'mute' || action === 'disable') {
            psCmd = "(New-Object -ComObject WScript.Shell).SendKeys([char]173)";
          }
        }
        
        if (psCmd) {
          const res = await api.executeCommand(psCmd);
          setTimeout(() => setSystemAction(null), 4000);
          return { status: "success", setting, action, nativeExecuted: res.success };
        }
        setTimeout(() => setSystemAction(null), 4000);
        return { status: "success", setting, action };
      } else if (cmd === 'search_youtube') {
        const query = String(arg);
        const targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        setSystemAction(`SEARCHING YOUTUBE`);
        audioEngine.playTaskSound();
        await api.openUrl(targetUrl);
        setTimeout(() => setSystemAction(null), 4000);
        return { status: "searching", query };
      } else if (cmd === 'whatsapp_action') {
        const { action: waAction, contact, message } = arg as any;
        setSystemAction(`WHATSAPP: ${waAction?.toUpperCase() || 'SEND'} TO ${contact?.toUpperCase() || 'CHAT'}`);
        audioEngine.playTaskSound();
        const res = await api.sendWhatsApp({ contact, message, action: waAction });
        setTimeout(() => setSystemAction(null), 4000);
        return res.success ? { status: "success", action: waAction, contact } : { status: "failed", error: res.error };
      }
      return { status: "unknown_command" };
    };
  };

  const toggleLiveVoice = async () => {
    if (liveState !== 'disconnected') {
      audioEngine.playBeep('scan');
      if (isScreenSharing) {
        liveSession?.stopScreenShare();
        setIsScreenSharing(false);
      }
      liveSession?.stop(true);
      setLiveSession(null);
      return;
    }

    try {
      const targetAgent = AGENTS_LIST.find(a => a.id === activeAgentId) || AGENTS_LIST[0];
      audioEngine.playBeep(targetAgent.audioBeep);
      const session = new JarvisLiveSession();
      setLiveSession(session);
      
      setupSessionCallbacks(session);

      await session.start(activeAgentId);

      // Auto-start screen capture in Electron mode so JARVIS can always see the screen
      const isElectronEnv = typeof window !== 'undefined' && 'electronAPI' in window;
      if (isElectronEnv) {
        // Small delay to ensure session is fully established
        setTimeout(async () => {
          try {
            const started = await session.startScreenShare();
            if (started) {
              setIsScreenSharing(true);
              setSystemAction("SCREEN VISION AUTO-ENGAGED");
              setTimeout(() => setSystemAction(null), 3000);
            }
          } catch (err) {
            console.warn("Auto screen capture failed:", err);
          }
        }, 1500);
      }
    } catch (e: any) {
      console.error(e);
      setLiveState('disconnected');
      setSystemError(true);
      if (e instanceof Error && e.message.includes('Network error')) {
        setSystemAction("NETWORK ERROR: SERVER OR QUOTA LIMIT. RETRY IN A FEW SECONDS.");
        setTimeout(() => setSystemAction(null), 5000);
      }
      setTimeout(() => setSystemError(false), 3000);
    }
  };

  const switchAgent = async (agentId: string) => {
    if (agentId === activeAgentId) return;
    
    // Play sound beep of target agent
    const targetAgent = AGENTS_LIST.find(a => a.id === agentId) || AGENTS_LIST[0];
    audioEngine.playBeep(targetAgent.audioBeep);
    
    setActiveAgentId(agentId);
    if (agentId === "vision-sentinel") {
      setActiveMainTab("vision");
    } else {
      setActiveMainTab("voice");
    }
    
    if (liveState !== 'disconnected') {
      try {
        setSystemAction(`REALIGNING COGNITIVE SYNAPSE TO ${targetAgent.codename}...`);
        
        // Stop current
        if (liveSession) {
          liveSession.stop();
        }
        
        await new Promise(resolve => setTimeout(resolve, 600));
        
        const session = new JarvisLiveSession();
        setLiveSession(session);
        
        setupSessionCallbacks(session);
        
        await session.start(agentId);
        setSystemAction(`${targetAgent.codename} OVERRIDE ENGAGED.`);
        setTimeout(() => setSystemAction(null), 3000);

        // Re-engage screen capture after agent switch
        const isElectronEnv = typeof window !== 'undefined' && 'electronAPI' in window;
        if (isElectronEnv) {
          setTimeout(async () => {
            try {
              const started = await session.startScreenShare();
              if (started) setIsScreenSharing(true);
            } catch (err) {
              console.warn("Screen re-capture failed after agent switch:", err);
            }
          }, 1500);
        }
      } catch (err) {
        console.error("Hot-swap error:", err);
        setLiveState('disconnected');
        setSystemError(true);
        setTimeout(() => setSystemError(false), 3000);
      }
    } else {
      setSystemAction(`${targetAgent.codename} SYTEM PRE-SELECTED.`);
      setTimeout(() => setSystemAction(null), 3000);
    }
  };

  const toggleScreenShare = async () => {
    if (!liveSession) return;
    if (isScreenSharing) {
      liveSession.stopScreenShare();
      setIsScreenSharing(false);
    } else {
      try {
        const started = await liveSession.startScreenShare();
        if (!started) {
          setSystemAction("VISION CAPTURE NOT SUPPORTED.");
          setTimeout(() => setSystemAction(null), 3000);
        }
        setIsScreenSharing(started);
      } catch (err: any) {
        if (err.message === "PERMISSION DENIED") {
          setSystemAction("CAMERA PERMISSION DENIED.");
        } else {
          setSystemAction("VISION CAPTURE FAILED.");
        }
        setTimeout(() => setSystemAction(null), 3000);
        setIsScreenSharing(false);
      }
    }
  };

  const getAgentIcon = (id: string, size = 16) => {
    switch (id) {
      case 'jarvis-core': return <Brain size={size} />;
      case 'vision-sentinel': return <Eye size={size} />;
      case 'cyber-search': return <Search size={size} />;
      case 'hardware-syscon': return <Settings size={size} />;
      case 'comms-link': return <MessageSquare size={size} />;
      default: return <Cpu size={size} />;
    }
  };

  const themeStyles = {
    '--core-gold': activeAgentId === 'jarvis-core' ? '#fbbf24' : activeAgentId === 'vision-sentinel' ? '#a78bfa' : activeAgentId === 'cyber-search' ? '#22d3ee' : activeAgentId === 'hardware-syscon' ? '#fca5a5' : '#34d399',
    '--core-gold-dark': activeAgent.accentHex,
    '--glass-bg': `${activeAgent.accentHex}0d`, 
    '--glass-border': `${activeAgent.accentHex}33`, 
    '--bg-dark': activeAgentId === 'jarvis-core' ? '#0c0400' : activeAgentId === 'vision-sentinel' ? '#05020c' : activeAgentId === 'cyber-search' ? '#000609' : activeAgentId === 'hardware-syscon' ? '#0a0101' : '#010a04'
  } as React.CSSProperties;

  const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden relative transition-all duration-700" style={themeStyles}>
      {isElectron && (
        <div className="w-full flex justify-between items-center px-4 py-2 bg-black/60 border-b border-[var(--glass-border)] text-xs font-mono shrink-0 select-none z-50 animate-fade-in" style={{ WebkitAppRegion: 'drag' } as any}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--core-gold)] animate-pulse" />
            <span className="tracking-widest uppercase opacity-75 font-bold">J.A.R.V.I.S. NATIVE SHELL</span>
          </div>
          <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <button onClick={() => (window as any).electronAPI.windowMinimize()} className="hover:text-[var(--core-gold)] transition-colors cursor-pointer px-1 font-bold text-[10px]">
              🗕
            </button>
            <button onClick={() => (window as any).electronAPI.windowMaximize()} className="hover:text-[var(--core-gold)] transition-colors cursor-pointer px-1 font-bold text-[10px]">
              🗖
            </button>
            <button onClick={() => (window as any).electronAPI.windowClose()} className="hover:text-red-500 transition-colors cursor-pointer px-1 font-bold text-[10px]">
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="w-full h-full flex flex-col p-4 sm:p-6 flex-1 min-h-0 overflow-hidden relative">
        <AnimatePresence>
          {systemError && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute z-50 inset-0 bg-red-900/50 flex flex-col items-center justify-center backdrop-blur-sm"
            >
              <div className="text-7xl font-display font-bold glitch uppercase">Terminal Error</div>
              <div className="text-xl font-mono mt-4 text-[var(--core-red)]">NEURAL CORTEX DISRUPTION DETECTED</div>
            </motion.div>
          )}
          
          {systemAction && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute z-50 top-24 left-1/2 -translate-x-1/2 bg-[var(--glass-bg)] border border-[var(--core-gold)] px-6 py-3 rounded-full flex items-center gap-3 shadow-[0_0_20px_var(--glass-border)]"
            >
              <Settings size={18} className="text-[var(--core-gold)] animate-[spin_3s_linear_infinite]" />
              <span className="font-mono text-sm tracking-widest uppercase text-[var(--core-gold)]">{systemAction}</span>
            </motion.div>
          )}
          
          {pendingUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute z-50 top-40 left-1/2 -translate-x-1/2 bg-[var(--glass-bg)] border-2 border-[var(--core-gold)] px-6 py-4 rounded-xl flex flex-col items-center gap-3 shadow-[0_0_30px_rgba(245,158,11,0.5)]"
            >
              <div className="font-mono text-sm tracking-widest uppercase text-[var(--core-gold)]">External Link Requested</div>
              <a 
                href={pendingUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={() => setPendingUrl(null)}
                className="bg-[var(--core-gold)] text-black font-bold uppercase tracking-wider px-6 py-2 rounded shadow-[0_0_15px_rgba(245,158,11,0.8)] hover:bg-white hover:text-black transition-colors focus:outline-none"
              >
                Open Link
              </a>
              <button 
                onClick={() => setPendingUrl(null)}
                className="text-xs text-[var(--core-gold)] font-mono opacity-70 hover:opacity-100 uppercase focus:outline-none"
              >
                Dismiss
              </button>
            </motion.div>
          )}
          {showSettingsModal && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 z-50 bg-black/85 flex items-center justify-center backdrop-blur-md"
            >
              <div className="glass-panel p-8 rounded-2xl border border-[var(--core-gold)]/30 max-w-md w-full flex flex-col gap-5 relative font-mono text-xs text-left" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <button 
                  onClick={() => setShowSettingsModal(false)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-white cursor-pointer focus:outline-none font-bold text-sm"
                >
                  ✕
                </button>
                
                <div className="flex items-center gap-2 border-b border-[var(--glass-border)] pb-3">
                  <Settings size={18} className="text-[var(--core-gold)]" />
                  <h3 className="font-display uppercase text-sm tracking-wider font-bold text-white">System Configuration</h3>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Gemini API Key</label>
                  <input 
                    type="password" 
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="AI Studio key: AIzaSy..."
                    className="w-full bg-black/60 border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-[var(--core-gold)] placeholder-gray-600 focus:outline-none focus:border-[var(--core-gold)] transition-colors font-mono"
                  />
                  <p className="text-[10px] text-gray-500 leading-normal font-sans">
                    Get a free key from <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-[var(--core-gold)] hover:underline">Google AI Studio</a>. This key authorizes the live audio and automation cortex of J.A.R.V.I.S.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Custom Task Sound Effect (Audio Path / URL)</label>
                  <input 
                    type="text" 
                    value={customSoundInput}
                    onChange={(e) => setCustomSoundInput(e.target.value)}
                    placeholder="e.g. /sounds/task.mp3 or C:/path/to/sound.mp3"
                    className="w-full bg-black/60 border border-[var(--glass-border)] rounded-xl px-4 py-2.5 text-[var(--core-gold)] placeholder-gray-600 focus:outline-none focus:border-[var(--core-gold)] transition-colors font-mono text-[11px]"
                  />
                  <p className="text-[10px] text-gray-500 leading-normal font-sans">
                    Sound plays whenever JARVIS carries out any task. Place audio file in <code className="text-[var(--core-gold)]">public/sounds/task.mp3</code> or enter any custom sound URL/path above.
                  </p>
                </div>
                
                <button 
                  onClick={() => {
                    localStorage.setItem('jarvis_gemini_api_key', apiKeyInput.trim());
                    localStorage.setItem('jarvis_custom_task_sound', customSoundInput.trim());
                    setShowSettingsModal(false);
                    setSystemAction("SETTINGS & SOUND SAVED");
                    audioEngine.playTaskSound();
                    setTimeout(() => setSystemAction(null), 3000);
                  }}
                  className="w-full bg-[var(--core-gold)] text-black py-3 rounded-xl font-bold uppercase tracking-wider hover:bg-white hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all cursor-pointer text-center"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Background grids */}
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: "radial-gradient(var(--core-gold) 0.5px, transparent 0.5px)", backgroundSize: "24px 24px" }} />
      
      {/* Header */}
      <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 mb-6 z-10 glass-panel p-4 rounded-2xl shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="font-display text-3xl tracking-widest font-bold glow-text">J.A.R.V.I.S.</span>
            <span className="text-xs uppercase tracking-[0.3em] opacity-60">Mk L. Intelligent System</span>
          </div>
          <button 
            onClick={() => setShowSettingsModal(true)} 
            className="text-[10px] font-mono border border-[var(--glass-border)] hover:border-[var(--core-gold)] bg-black/40 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-[var(--core-gold)]/10 text-[var(--core-gold)] transition-colors focus:outline-none flex items-center gap-1.5"
            title="Configure System Settings"
          >
            <Settings size={11} className="animate-[spin_6s_linear_infinite]" /> SETTINGS
          </button>
        </div>

        {/* Humbler Mode Switcher */}
        <div className="flex items-center gap-2 border border-[var(--glass-border)] bg-black/40 p-1 rounded-xl font-mono mx-auto md:mx-0">
          <button
            onClick={() => { setActiveMainTab('voice'); switchAgent('jarvis-core'); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold font-display tracking-wider transition-all cursor-pointer ${
              activeMainTab === 'voice'
                ? 'bg-[var(--core-gold-dark)]/50 text-[var(--core-gold)] border border-[var(--core-gold)]/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            VOICE ASSISTANT
          </button>
          <button
            onClick={() => { setActiveMainTab('vision'); switchAgent('vision-sentinel'); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold font-display tracking-wider transition-all cursor-pointer ${
              activeMainTab === 'vision'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            SCREEN VISION
          </button>
          <button
            onClick={() => { setActiveMainTab('chrome'); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold font-display tracking-wider transition-all cursor-pointer ${
              activeMainTab === 'chrome'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            CHROME EXTENSION
          </button>
        </div>

        <div className="flex flex-col items-end hidden md:flex">
          <span className="font-mono text-xl leading-none">{time.toLocaleTimeString()}</span>
          <span className="font-mono text-[10px] opacity-70 uppercase mt-1">{time.toLocaleDateString()} | {time.getTimezoneOffset() / -60} UTC</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 relative z-10 overflow-y-auto lg:overflow-hidden pb-12 lg:pb-0 scrollbar-hide">
        
        {/* Left Panel: System Stats */}
        <div className="w-full lg:w-64 flex flex-col gap-4 shrink-0 lg:shrink order-2 lg:order-1">
          <div className="glass-panel p-4 rounded-2xl">
            <h3 className="font-display uppercase text-xs tracking-wider mb-4 border-b border-[var(--glass-border)] pb-2 flex items-center gap-2">
              <Activity size={14} /> System Core
            </h3>
            <div className="flex flex-col gap-4">
              <StatBar label="CPU Load" value={Math.round(cpu)} color="var(--core-gold)" icon={<Zap size={14}/>} />
              <StatBar label="Memory" value={Math.round(ram)} color="var(--core-gold)" icon={<HardDrive size={14}/>} />
              <StatBar label="Network" value={network / 10} color={network > 400 ? 'var(--core-red)' : 'var(--core-gold)'} icon={<Wifi size={14}/>} suffix=" MB/s" />
            </div>

            {/* Subsystem Telemetry */}
            <div className="mt-6 border-t border-[var(--glass-border)] pt-4 flex flex-col gap-2 font-mono text-xs text-[var(--core-gold)]/85">
              <div className="text-[10px] font-display tracking-widest text-[var(--core-gold)] mb-1 uppercase">Subsystem Telemetry</div>
              <div className="flex justify-between"><span>ACTIVE ID:</span> <span className="font-bold text-[var(--core-gold)]">{activeAgent.codename}</span></div>
              <div className="flex justify-between"><span>PROCESSORS:</span> <span>{activeAgent.stats.cores}-Cortex</span></div>
              <div className="flex justify-between"><span>CLOCK SPEED:</span> <span>{activeAgent.stats.clockSpeed}</span></div>
              <div className="flex justify-between font-mono"><span>INTERFACE:</span> <span className="opacity-95 truncate max-w-[120px]">{activeAgent.stats.subsystem}</span></div>
            </div>
          </div>

          {/* Direct Access Quick Launch Hub */}
          <div className="glass-panel p-4 rounded-2xl flex flex-col relative overflow-hidden border border-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.02)]">
            <h3 className="font-display uppercase text-[10px] tracking-widest mb-3 border-b border-[var(--glass-border)] pb-2 flex items-center gap-1.5 text-amber-300">
              <PlusSquare size={13} className="animate-pulse" /> Direct Access Core
            </h3>
            <p className="text-[10px] text-gray-400 font-mono mb-3 leading-normal">
              Direct-action shortcuts to bypass browser popup and iframe blockers:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a 
                href="https://youtube.com" 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={() => setPendingUrl(null)}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-red-950/20 border border-red-500/20 hover:border-red-500/60 hover:bg-red-500/10 transition-all text-center group font-mono cursor-pointer"
              >
                <Video size={14} className="text-red-500 group-hover:scale-110 transition-transform duration-300 mb-0.5" />
                <span className="text-[10px] text-red-200 uppercase font-bold tracking-wider">YouTube</span>
                <span className="text-[7.5px] text-red-400/70 uppercase">Uplink</span>
              </a>
              <a 
                href="https://web.whatsapp.com" 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={() => setPendingUrl(null)}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-950/20 border border-emerald-500/20 hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-all text-center group font-mono cursor-pointer"
              >
                <MessageSquare size={14} className="text-emerald-500 group-hover:scale-110 transition-transform duration-300 mb-0.5" />
                <span className="text-[10px] text-emerald-200 uppercase font-bold tracking-wider">WhatsApp</span>
                <span className="text-[7.5px] text-emerald-400/70 uppercase">Uplink</span>
              </a>
              <a 
                href="https://google.com" 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={() => setPendingUrl(null)}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-blue-950/20 border border-blue-500/20 hover:border-blue-500/60 hover:bg-blue-500/10 transition-all text-center group font-mono cursor-pointer"
              >
                <Search size={14} className="text-blue-400 group-hover:scale-110 transition-transform duration-300 mb-0.5" />
                <span className="text-[10px] text-blue-200 uppercase font-bold tracking-wider">Search</span>
                <span className="text-[7.5px] text-blue-400/70 uppercase">Core</span>
              </a>
              <button 
                onClick={() => setActiveMainTab('chrome')}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-amber-950/20 border border-amber-500/20 hover:border-amber-500/60 hover:bg-amber-500/10 transition-all text-center group font-mono cursor-pointer focus:outline-none"
              >
                <Chrome size={14} className="text-amber-400 group-hover:scale-110 transition-transform duration-300 mb-0.5" />
                <span className="text-[10px] text-amber-200 uppercase font-bold tracking-wider">Extension</span>
                <span className="text-[7.5px] text-amber-400/70 uppercase">Companion</span>
              </button>
            </div>
          </div>

          <div className="glass-panel p-4 rounded-2xl flex-1 hidden md:flex flex-col relative overflow-hidden">
            <h3 className="font-display uppercase text-xs tracking-wider mb-4 border-b border-[var(--glass-border)] pb-2 flex items-center gap-2">
              <Settings size={14} /> Radar Sweep
            </h3>
            <div className="flex-1 rounded-full border border-[var(--glass-border)] relative flex items-center justify-center">
              {/* Radar spin */}
              <motion.div 
                className="absolute w-1/2 h-[2px] bg-gradient-to-r from-transparent to-[var(--core-gold)] origin-left"
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />
              {[25, 50, 75, 100].map(p => (
                <div key={p} className="absolute rounded-full border border-[var(--glass-border)]" style={{ width: `${p}%`, height: `${p}%` }} />
              ))}
            </div>
          </div>
        </div>

        {activeMainTab === "voice" ? (
          <>
            {/* Center Panel: AI Core & Voice Controls */}
            <div className="flex-1 flex flex-col relative items-center justify-start lg:justify-center min-h-[500px] lg:min-h-0 py-8 lg:py-0 shrink-0 lg:shrink order-1 lg:order-2">
              
              <div className="mb-12">
                <AiCore 
                  isListening={liveState === 'connected'} 
                  isThinking={liveState === 'connecting'} 
                  isSpeaking={liveState === 'speaking'} 
                  agentId={activeAgentId}
                />
              </div>

              <div className="text-center font-display tracking-widest text-lg glow-text mb-8 uppercase">
                {liveState === 'disconnected' && "SYSTEM STANDBY"}
                {liveState === 'connecting' && `MODULATING COGNITIVE CORTEX [${activeAgent.codename}]...`}
                {liveState === 'connected' && `LISTENING... [${activeAgent.codename}]`}
                {liveState === 'speaking' && `${activeAgent.codename} TRANSMITTING`}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-4">
                <button 
                  onClick={toggleLiveVoice}
                  className={`px-6 sm:px-8 py-3 sm:py-4 rounded-full flex items-center gap-3 sm:gap-4 transition-all uppercase tracking-wider sm:tracking-widest font-bold border text-xs sm:text-sm ${
                    liveState !== 'disconnected' 
                      ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                      : 'bg-[var(--glass-bg)] border-[var(--core-gold)]/30 text-[var(--core-gold)] hover:bg-[var(--core-gold)]/10 shadow-[0_0_20px_var(--glass-border)]'
                  }`}
                >
                  {liveState !== 'disconnected' ? (
                    <><PhoneOff size={20} className="sm:w-6 sm:h-6" /> <span>Close Override</span></>
                  ) : (
                    <><Mic size={20} className="sm:w-6 sm:h-6" /> <span>Engage Link</span></>
                  )}
                </button>

                <button 
                  onClick={toggleScreenShare}
                  disabled={liveState === 'disconnected'}
                  title="Toggle Vision (Screen/Camera)"
                  className={`p-4 rounded-full transition-all border disabled:opacity-30 disabled:cursor-not-allowed ${
                    isScreenSharing 
                      ? 'bg-[var(--core-gold)]/20 border-[var(--core-gold)]/50 text-[var(--core-gold)] shadow-[0_0_15px_var(--glass-border)]'
                      : 'bg-[var(--glass-bg)] border-[var(--core-gold)]/30 text-[var(--core-gold)]/70 hover:bg-[var(--core-gold)]/10'
                  }`}
                >
                  {isScreenSharing ? <Video size={24} /> : <VideoOff size={24} />}
                </button>
              </div>
              
              {/* Text Input */}
              <div className="mt-8 w-full max-w-md relative">
                <input 
                  type="text" 
                  placeholder={liveState !== 'disconnected' ? "Override system key..." : "Initialize link to override..."}
                  disabled={liveState === 'disconnected'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim() && liveSession) {
                      liveSession.sendText(e.currentTarget.value.trim());
                      e.currentTarget.value = '';
                    }
                  }}
                  className="w-full bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-full px-6 py-3 pr-12 font-mono text-sm text-[var(--core-gold)] placeholder-[var(--core-gold)]/30 focus:outline-none focus:border-[var(--core-gold)] transition-colors disabled:opacity-50"
                />
                <button 
                  disabled={liveState === 'disconnected'}
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    if (input.value.trim() && liveSession) {
                      liveSession.sendText(input.value.trim());
                      input.value = '';
                    }
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--core-gold)]/50 hover:text-[var(--core-gold)] transition-colors disabled:opacity-50 disabled:hover:text-[var(--core-gold)]/50"
                >
                  <Send size={18} />
                </button>
              </div>

              <div className="mt-6 max-w-md text-center text-xs font-mono opacity-50">
                Note: Lock-screen or browser backgrounding may suspend connection. Leave open in foreground.
              </div>

            </div>

            {/* Right Panel: Specialist Agent Selector Matrix */}
            <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0 lg:shrink mt-4 lg:mt-0 order-3 font-mono">
              <div className="glass-panel p-4 rounded-2xl flex-1 flex flex-col min-h-0">
                <h3 className="font-display uppercase text-xs tracking-widest mb-4 border-b border-[var(--glass-border)] pb-2 flex items-center gap-2">
                  <RefreshCw size={14} className={liveState !== 'disconnected' ? "animate-spin" : ""} /> Cybernetic Agents
                </h3>
                
                <div className="flex flex-col gap-2 flex-1 overflow-y-auto scrollbar-hide max-h-[340px] lg:max-h-[380px] p-0.5">
                  {AGENTS_LIST.map((agentItem) => {
                    const isActive = activeAgentId === agentItem.id;
                    return (
                      <button
                        key={agentItem.id}
                        onClick={() => switchAgent(agentItem.id)}
                        className={`text-left p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1 focus:outline-none relative group overflow-hidden ${
                          isActive 
                            ? 'bg-[var(--glass-bg)] border-[var(--core-gold)] shadow-[0_0_15px_var(--glass-border)]'
                            : 'bg-black/20 border-[var(--glass-border)] hover:bg-white/5 hover:border-[var(--core-gold)]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full uppercase">
                          <div className="flex items-center gap-2.5 font-display text-sm tracking-widest font-bold">
                            <span className={isActive ? "text-[var(--core-gold)]" : "text-gray-400 group-hover:text-white"}>
                              {getAgentIcon(agentItem.id, 16)}
                            </span>
                            <span className={isActive ? "text-[var(--core-gold)]" : "text-gray-300 group-hover:text-white"}>
                              {agentItem.codename}
                            </span>
                          </div>
                          <span className={`text-[10px] ${isActive ? 'text-[var(--core-gold)] border-[var(--core-gold)]' : 'text-gray-500 border-[var(--glass-border)]'} font-bold px-1.5 py-0.5 rounded border`}>
                            {isActive ? 'ENGAGED' : 'READY'}
                          </span>
                        </div>
                        <span className="text-[10px] opacity-70 leading-normal normal-case text-gray-300 line-clamp-2 mt-1">
                          {agentItem.description}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* active agent brief controller info */}
                <div className="mt-4 border-t border-[var(--glass-border)] pt-4 flex flex-col justify-end">
                  <div className="bg-black/30 border border-[var(--glass-border)] p-3 rounded-xl text-xs gap-1.5 flex flex-col">
                    <div className="flex items-center gap-1.5 font-display text-xs tracking-wider text-[var(--core-gold)] uppercase">
                      <span>OVERRIDE STATUS:</span>
                      <span>{activeAgent.codename}</span>
                    </div>
                    <div className="text-[10.5px] text-gray-400 normal-case leading-relaxed font-mono">
                      All systems operating within bounds. Select an agent to instantly modulate neural frequencies and change assistant behaviors.
                    </div>
                    <button 
                      onClick={() => setSystemError(true)} 
                      className="mt-3 w-full bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:border-[var(--core-gold)] hover:bg-[var(--core-gold)]/15 text-center text-xs tracking-wider py-2 rounded-lg font-display text-[var(--core-gold)] cursor-pointer transition-all flex items-center justify-center gap-1.5"
                    >
                      <PlaySquare size={12} /> Force Diagnostic Sweep
                    </button>
                  </div>
                </div>
                
              </div>
            </div>
          </>
        ) : activeMainTab === "vision" ? (
          <div className="flex-1 flex lg:order-2 overflow-hidden min-h-0">
            <ScreenVision 
              onMemoryUpdate={(mem) => {
                setSystemAction(`VISION DETECTED: "${mem.application.toUpperCase()}"`);
                setTimeout(() => setSystemAction(null), 3000);
              }}
              onCoordinatesAction={(actionText, coords) => {
                setSystemAction(`ACTION AT [${coords[0]}%, ${coords[1]}%]: ${actionText.toUpperCase()}`);
                setTimeout(() => setSystemAction(null), 4000);
              }}
            />
          </div>
        ) : (
          <div className="flex-1 flex lg:order-2 overflow-hidden min-h-0">
            <ChromeCompanion />
          </div>
        )}

      </div>
      </div>
    </div>
  );
};

const StatBar = ({ label, value, color, icon, suffix = "%" }: { label: string, value: number, color: string, icon: React.ReactNode, suffix?: string }) => (
  <div className="flex flex-col gap-1 font-mono text-xs">
    <div className="flex justify-between items-center opacity-80">
      <span className="flex items-center gap-1 uppercase">{icon} {label}</span>
      <span>{value}{suffix}</span>
    </div>
    <div className="h-1.5 w-full bg-[var(--glass-border)] overflow-hidden">
      <motion.div 
        className="h-full" 
        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
        animate={{ width: `${value}%` }}
        transition={{ type: 'tween' }}
      />
    </div>
  </div>
);
