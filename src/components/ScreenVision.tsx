import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Eye, Monitor, Search, Play, RefreshCw, Layers, Terminal, 
  MessageSquare, Cpu, MousePointer, Sparkles, HelpCircle, FileText, Check, AlertTriangle
} from "lucide-react";
import { 
  analyzeScreen, askAboutScreen, ScreenAnalysis, VisibleElement, VisionMemoryItem 
} from "../lib/screen-vision";
import { audioEngine } from "../lib/audio";

interface ScreenVisionProps {
  onMemoryUpdate?: (memory: VisionMemoryItem) => void;
  onCoordinatesAction?: (actionText: string, coords: [number, number]) => void;
}

export const ScreenVision: React.FC<ScreenVisionProps> = ({ 
  onMemoryUpdate, 
  onCoordinatesAction 
}) => {
  // Capture states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanInterval, setScanInterval] = useState<number>(3); // seconds
  const [autoScan, setAutoScan] = useState(false);
  
  // Analysis states
  const [analysis, setAnalysis] = useState<ScreenAnalysis | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [hoveredElementIdx, setHoveredElementIdx] = useState<number | null>(null);

  // Vision Tabs: 'elements' | 'qa' | 'ocr' | 'memory'
  const [activeTab, setActiveTab] = useState<'elements' | 'qa' | 'ocr' | 'memory'>('elements');

  // Vision Q&A
  const [question, setQuestion] = useState("");
  const [qaHistory, setQaHistory] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [isAnswering, setIsAnswering] = useState(false);

  // Automation Simulator
  const [automationCommand, setAutomationCommand] = useState("");
  const [automationLogs, setAutomationLogs] = useState<string[]>([]);
  const [simulationCursor, setSimulationCursor] = useState<[number, number] | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showRipple, setShowRipple] = useState<[number, number] | null>(null);

  // Vision memory log
  const [memoryList, setMemoryList] = useState<VisionMemoryItem[]>([]);

  // Refs for element elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoScanTimerRef = useRef<any>(null);
  const screenshotRef = useRef<string | null>(null);

  // Auto-track the screenshot ref so setInterval callbacks always have access to the latest state
  useEffect(() => {
    screenshotRef.current = screenshot;
  }, [screenshot]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCapture();
      if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
    };
  }, []);

  // Handle Auto-Scan Toggling
  useEffect(() => {
    if (autoScanTimerRef.current) {
      clearInterval(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }

    if (autoScan && isCapturing) {
      autoScanTimerRef.current = setInterval(() => {
        triggerScan();
      }, scanInterval * 1000);
    }
  }, [autoScan, isCapturing, scanInterval]);

  // Media Capture Activation
  const startCapture = async () => {
    try {
      const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
      audioEngine.playBeep('startup');
      
      let captureStream: MediaStream;

      if (isElectron) {
        setAutomationLogs(prev => [...prev, "[SYSTEM] Requesting native desktop sources..."]);
        const sources = await (window as any).electronAPI.getScreenSources();
        if (!sources || sources.length === 0) {
          throw new Error("No native screen capture sources available.");
        }
        
        // Find the primary screen source, or default to the first one
        const primarySource = sources.find((s: any) => s.name.toLowerCase().includes('screen 1') || s.id.startsWith('screen:')) || sources[0];
        
        captureStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: primarySource.id,
              minFrameRate: 10,
              maxFrameRate: 15
            }
          }
        } as any);
      } else {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          alert("Screen capture (getDisplayMedia) is not fully supported in this environment.");
          return;
        }

        captureStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: { frameRate: 15 }, 
          audio: false 
        });
      }

      setStream(captureStream);
      setIsCapturing(true);
      setAutomationLogs(prev => [...prev, "[SYSTEM] Vision stream initialized successfully."]);

      // Create video element to pipeline frames
      const videoEl = document.createElement("video");
      videoEl.srcObject = captureStream;
      videoEl.autoplay = true;
      videoEl.playsInline = true;
      videoRef.current = videoEl;

      // Handle stream termination (e.g., user clicks "Stop Sharing")
      captureStream.getVideoTracks()[0].onended = () => {
        stopCapture();
      };

      // Take initial screenshot after a brief delay for rendering
      setTimeout(() => {
        takeScreenshotAndScan();
      }, 1000);

    } catch (err) {
      console.error("Screen capture activation failed:", err);
      setAutomationLogs(prev => [...prev, `[ERROR] Display capture rejected: ${err instanceof Error ? err.message : 'Unknown'}`]);
    }
  };

  const stopCapture = () => {
    if (autoScanTimerRef.current) {
      clearInterval(autoScanTimerRef.current);
      autoScanTimerRef.current = null;
    }
    setAutoScan(false);

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsCapturing(false);
    setScreenshot(null);
    setAnalysis(null);
    setAutomationLogs(prev => [...prev, "[SYSTEM] Screen Vision capture stopped."]);
  };

  const takeScreenshotAndScan = async () => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    // Create canvas
    const canvas = document.createElement("canvas");
    const maxDim = 1024; // Keep size low-latency
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
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    const base64 = dataUrl.split(",")[1];
    
    setScreenshot(dataUrl);
    await performAnalysis(base64);
  };

  const triggerScan = async () => {
    if (!videoRef.current || isScanning) return;
    await takeScreenshotAndScan();
  };

  // Perform Gemini Multimodal Frame Scan
  const performAnalysis = async (base64String: string) => {
    setIsScanning(true);
    setAutomationLogs(prev => [...prev, "[VISION] Analyzing new desktop frame..."]);
    audioEngine.playBeep('scan');

    try {
      const result = await analyzeScreen(base64String);
      setAnalysis(result);
      setIsScanning(false);
      setAutomationLogs(prev => [
        ...prev, 
        `[VISION] Frame processed. App: "${result.application}", visible elements: ${result.visible_elements.length}.`
      ]);

      // Add to vision memory
      const newItem: VisionMemoryItem = {
        timestamp: new Date(),
        application: result.application || "Unknown Feed",
        current_page: result.current_page || "Active Screen",
        elementsCount: result.visible_elements.length
      };

      setMemoryList(prev => [newItem, ...prev].slice(0, 30));
      onMemoryUpdate?.(newItem);

    } catch (err: any) {
      console.error(err);
      setIsScanning(false);
      audioEngine.playBeep('error');
      setAutomationLogs(prev => [...prev, `[ERROR] Vision analysis failed: ${err.message || err}`]);
    }
  };

  // Ask Question about the active Frame
  const sendQuestion = async () => {
    if (!question.trim() || !screenshotRef.current || isAnswering) return;

    const currentQuestion = question;
    const base64 = screenshotRef.current.split(",")[1];
    
    setQuestion("");
    setQaHistory(prev => [...prev, { role: 'user', text: currentQuestion }]);
    setIsAnswering(true);
    setAutomationLogs(prev => [...prev, `[Q&A] User querying frame: "${currentQuestion}"`]);

    try {
      const answer = await askAboutScreen(base64, currentQuestion, qaHistory);
      setQaHistory(prev => [...prev, { role: 'model', text: answer }]);
      setAutomationLogs(prev => [...prev, "[Q&A] Answer received from Vision Cortex."]);
      audioEngine.playBeep('click');
    } catch (err: any) {
      setQaHistory(prev => [...prev, { role: 'model', text: `Failed to answer: ${err.message || err}` }]);
      audioEngine.playBeep('error');
    } finally {
      setIsAnswering(false);
    }
  };

  // Automation Action Simulator Execution Engine
  const executeAutomationCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!automationCommand.trim() || !analysis || isSimulating) return;

    const cmd = automationCommand.trim().toLowerCase();
    setAutomationCommand("");
    setAutomationLogs(prev => [...prev, `[EXEC] Parsing manual command: "${cmd}"`]);
    setIsSimulating(true);

    // Regex parsing
    // Match click command: e.g. "click 'sign in'" or "click button 'search'" or "click link"
    const clickMatch = cmd.match(/click\s+(?:(?:button|link|icon|input|input_field)?\s*['"]?([^'"]+)['"]?|['"]?([^'"]+)['"]?)/);
    
    if (clickMatch) {
      const targetLabel = clickMatch[1] || clickMatch[2];
      if (!targetLabel) {
        setAutomationLogs(prev => [...prev, "[ERROR] Missing target descriptor for click action."]);
        setIsSimulating(false);
        return;
      }

      setAutomationLogs(prev => [...prev, `[EXEC] Searching elements for descriptor: "${targetLabel}"`]);

      // Fuzzy lookup on elements
      const targetElement = analysis.visible_elements.find(el => 
        el.text.toLowerCase().includes(targetLabel.toLowerCase()) ||
        el.type.toLowerCase().includes(targetLabel.toLowerCase())
      );

      if (targetElement) {
        const [x, y] = targetElement.position;
        setAutomationLogs(prev => [...prev, `[EXEC] Highlighted control matching "${targetLabel}" of type "${targetElement.type}" at [${x}%, ${y}%]`]);
        
        // 1. Move virtual cursor
        setSimulationCursor([x, y]);
        audioEngine.playBeep('click');
        
        await new Promise(resolve => setTimeout(resolve, 1200));

        // 2. Trigger ripple animation
        setShowRipple([x, y]);
        setAutomationLogs(prev => [...prev, `[EXEC] Simulated click dispatched successfully at viewport center coordinates [${x}%, ${y}%].`]);
        onCoordinatesAction?.(`Simulated click on ${targetElement.type} "${targetElement.text}"`, [x, y]);

        setTimeout(() => setShowRipple(null), 1000);

        // 3. Auto-re-scan after action as required
        await new Promise(resolve => setTimeout(resolve, 1500));
        setAutomationLogs(prev => [...prev, "[EXEC] Autoscan triggered following element manipulation..."]);
        
        // Set cursor null
        setSimulationCursor(null);
        await triggerScan();
      } else {
        setAutomationLogs(prev => [...prev, `[WARN] Action failed. No element matched description: "${targetLabel}"`]);
        audioEngine.playBeep('error');
      }
    } else if (cmd.includes("scan") || cmd.includes("ref") || cmd.includes("reload")) {
      await triggerScan();
    } else {
      setAutomationLogs(prev => [...prev, `[EXEC] Command category not fully mapped: "${cmd}". Attempting fuzzy target search...`]);
      // Attempt general target finding
      const matched = analysis.visible_elements.find(el => cmd.includes(el.text.toLowerCase()));
      if (matched) {
        const [x, y] = matched.position;
        setSimulationCursor([x, y]);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setShowRipple([x, y]);
        onCoordinatesAction?.(`Simulated fuzzy click at element "${matched.text}"`, [x, y]);
        setTimeout(() => setShowRipple(null), 1000);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setSimulationCursor(null);
        await triggerScan();
      } else {
        setAutomationLogs(prev => [...prev, "[WARN] Could not parse action. Format: 'click [element name]', or 'scan'"]);
        audioEngine.playBeep('error');
      }
    }

    setIsSimulating(false);
  };

  // Click direct target on screen representation
  const handleTargetClick = async (el: VisibleElement) => {
    if (isSimulating) return;
    setIsSimulating(true);
    const [x, y] = el.position;
    
    setAutomationLogs(prev => [...prev, `[SYSTEM] Manual target chosen: type "${el.type}" at [${x}%, ${y}%]`]);
    
    // Move cursor and animation
    setSimulationCursor([x, y]);
    await new Promise(resolve => setTimeout(resolve, 800));
    setShowRipple([x, y]);
    audioEngine.playBeep('click');
    onCoordinatesAction?.(`Direct user cursor simulated at [${x}%, ${y}%] on "${el.text}"`, [x, y]);

    setTimeout(() => setShowRipple(null), 1000);

    // Auto re-scan
    await new Promise(resolve => setTimeout(resolve, 1500));
    setAutomationLogs(prev => [...prev, "[SYSTEM] Re-scanning screen state..."]);
    setSimulationCursor(null);
    await triggerScan();
    setIsSimulating(false);
  };

  // Filters elements based on text query and type
  const sortedAndFilteredElements = analysis?.visible_elements.filter(el => {
    const matchesQuery = searchQuery.trim() === "" || 
      el.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      el.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (el.description && el.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = selectedTypeFilter === "all" || el.type === selectedTypeFilter;
    
    return matchesQuery && matchesFilter;
  }) || [];

  // Icon parser
  const getElementIcon = (type: string) => {
    switch(type) {
      case 'button': return <Sparkles size={12} className="text-amber-400" />;
      case 'input_field': return <FileText size={12} className="text-cyan-400" />;
      case 'search_box': return <Search size={12} className="text-violet-400" />;
      case 'menu': return <Layers size={12} className="text-emerald-400" />;
      case 'icon': return <Sparkles size={12} className="text-yellow-400" />;
      case 'error_message': return <AlertTriangle size={12} className="text-red-400" />;
      default: return <Eye size={12} className="text-gray-400" />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-5 text-gray-200">
      
      {/* Top Controller Panel */}
      <div className="glass-panel p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 border border-[var(--glass-border)] shrink-0 bg-black/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.15)] animate-pulse">
            <Eye size={20} />
          </div>
          <div className="flex flex-col">
            <div className="font-display font-bold tracking-wider text-sm flex items-center gap-2">
              <span>V.I.S.I.O.N. SCREEN MONITOR</span>
              {isScanning && (
                <span className="text-[10px] bg-violet-500/20 text-violet-300 font-mono px-2 py-0.5 rounded-full animate-pulse border border-violet-500/30">
                  SCANNING...
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400 font-mono">Autonomous layout detection & element routing cortex</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Scan interval state controls */}
          {isCapturing && (
            <div className="flex items-center gap-2 border border-[var(--glass-border)] self-stretch rounded-xl px-3 bg-black/30 font-mono text-xs">
              <span className="text-gray-400">INTERVAL:</span>
              <select 
                value={scanInterval}
                onChange={(e) => setScanInterval(Number(e.target.value))}
                className="bg-transparent text-[var(--core-gold)] outline-none cursor-pointer p-1 font-bold"
              >
                <option value={1} className="bg-neutral-900">1s</option>
                <option value={2} className="bg-neutral-900">2s</option>
                <option value={3} className="bg-neutral-900">3s</option>
                <option value={5} className="bg-neutral-900">5s</option>
                <option value={10} className="bg-neutral-900">10s</option>
              </select>
            </div>
          )}

          {isCapturing && (
            <button
              onClick={() => setAutoScan(prev => !prev)}
              className={`px-3 py-2 rounded-xl text-xs font-mono font-bold tracking-wider flex items-center gap-1.5 transition-all border ${
                autoScan 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                  : 'bg-black/30 border-[var(--glass-border)] text-gray-400 hover:text-white'
              }`}
            >
              <RefreshCw size={13} className={autoScan ? "animate-spin" : ""} />
              <span>{autoScan ? "AUTOSCAN ON" : "AUTOSCAN OFF"}</span>
            </button>
          )}

          {isCapturing ? (
            <div className="flex gap-2">
              <button
                onClick={triggerScan}
                disabled={isScanning}
                className="bg-[var(--glass-bg)] border border-[var(--core-gold)]/40 hover:bg-[var(--core-gold)]/10 text-[var(--core-gold)] px-4 py-2 rounded-xl text-xs font-mono font-bold hover:shadow-[0_0_15px_var(--glass-border)] transition-all cursor-pointer disabled:opacity-50"
              >
                RE-SCAN NOW
              </button>
              <button
                onClick={stopCapture}
                className="bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 text-red-400 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
              >
                DISCONNECT FEED
              </button>
            </div>
          ) : (
            <button
              onClick={startCapture}
              className="bg-violet-500 hover:bg-violet-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] px-5 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 cursor-pointer transition-all hover:scale-102"
            >
              <Monitor size={14} />
              ENGAGE SYSTEM BROADCAST
            </button>
          )}
        </div>
      </div>

      {/* Main Structural Wrapper Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-y-auto lg:overflow-hidden scrollbar-hide pb-10 lg:pb-0">
        
        {/* Left Side: Interative Screenshot Visualizer */}
        <div className="lg:col-span-7 flex flex-col gap-4 min-h-[400px] lg:min-h-0">
          <div className="glass-panel p-4 rounded-2xl border border-[var(--glass-border)] flex-1 flex flex-col bg-black/30 relative min-h-0 overflow-hidden">
            <h3 className="font-display uppercase text-xs tracking-widest border-b border-[var(--glass-border)] pb-2 flex items-center justify-between gap-2 shrink-0">
              <span className="flex items-center gap-2"><Monitor size={13} className="text-violet-400" /> Active Optical Stream View</span>
              {analysis && (
                <span className="font-mono text-[10px] text-gray-400 lowercase">
                  App: <strong className="text-[var(--core-gold)] font-mono">{analysis.application}</strong> | Area: <strong className="text-violet-300 font-mono">{analysis.current_page}</strong>
                </span>
              )}
            </h3>

            {/* Stream View Body */}
            <div className="flex-1 flex items-center justify-center p-2 relative min-h-0">
              {screenshot ? (
                <div className="relative border border-[var(--glass-border)]/70 rounded-xl overflow-hidden aspect-video bg-black/60 max-h-full shadow-2xl max-w-full">
                  
                  {/* The Screenshot frame */}
                  <img 
                    src={screenshot} 
                    alt="Current Screen Scan" 
                    className="max-h-full w-full h-auto object-contain select-none"
                    referrerPolicy="no-referrer"
                  />

                  {/* Absolute Target Coordinate Overlays */}
                  {analysis?.visible_elements.map((el, i) => {
                    const isFilteredOut = !sortedAndFilteredElements.includes(el);
                    const isHovered = hoveredElementIdx === i;
                    
                    return (
                      <button
                        key={i}
                        onClick={() => handleTargetClick(el)}
                        onMouseEnter={() => setHoveredElementIdx(i)}
                        onMouseLeave={() => setHoveredElementIdx(null)}
                        style={{ left: `${el.position[0]}%`, top: `${el.position[1]}%` }}
                        disabled={isSimulating}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none transition-all cursor-pointer z-20 ${
                          isFilteredOut ? 'opacity-20 scale-75 pointer-events-none' : 'opacity-100 scale-100'
                        }`}
                      >
                        {/* Ping pulse core */}
                        <span className={`absolute inline-flex h-8 w-8 rounded-full bg-violet-400/20 -translate-x-2.5 -translate-y-2.5 ${
                          isHovered ? "animate-ping" : "animate-[pulse_2s_infinite]"
                        }`} />
                        <span className={`relative inline-flex rounded-full h-3.5 w-3.5 border border-black shadow-[0_0_10px_black] transition-all ${
                          isHovered 
                            ? 'bg-amber-400 ring-2 ring-amber-300 ring-offset-1 ring-offset-black scale-125' 
                            : 'bg-violet-400 hover:bg-amber-400'
                        }`} />
                        
                        {/* Hover Tooltip card */}
                        {isHovered && (
                          <div className="absolute left-1/2 bottom-full mb-2.5 -translate-x-1/2 bg-black/95 border border-violet-400/50 text-gray-200 text-[10px] font-mono p-2 rounded-lg shadow-[0_4px_25px_rgba(0,0,0,0.8)] whitespace-nowrap z-30 pointer-events-none flex flex-col gap-0.5">
                            <span className="text-[9px] uppercase tracking-wider text-violet-400 font-bold font-display">{el.type}</span>
                            <span className="font-bold text-gray-100 font-mono">"{el.text}"</span>
                            {el.description && <span className="text-[9px] text-gray-400 truncate max-w-[130px] font-mono">{el.description}</span>}
                            <span className="text-[9px] text-gray-500 font-mono mt-0.5">Pos Cent: <strong className="font-mono text-amber-500 font-bold">{el.position[0]}%, {el.position[1]}%</strong></span>
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {/* Virtual automation cursor animation */}
                  {simulationCursor && (
                    <motion.div
                      animate={{ 
                        left: `${simulationCursor[0]}%`, 
                        top: `${simulationCursor[1]}%` 
                      }}
                      transition={{ duration: 1.0, ease: "easeInOut" }}
                      className="absolute z-40 pointer-events-none -translate-x-1.5 -translate-y-1.5"
                      style={{ position: 'absolute' }}
                    >
                      <MousePointer size={22} className="text-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] scale-110" />
                    </motion.div>
                  )}

                  {/* Click ripples */}
                  {showRipple && (
                    <div 
                      style={{ left: `${showRipple[0]}%`, top: `${showRipple[1]}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-35 pointer-events-none"
                    >
                      <div className="w-14 h-14 rounded-full border-2 border-amber-400 animate-ping opacity-80" />
                      <div className="w-8 h-8 rounded-full bg-amber-400/40 animate-pulse absolute top-1/2 left-1/2 -translate-x-2.5 -translate-y-2.5" />
                    </div>
                  )}

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 gap-3 text-center grow border border-dashed border-[var(--glass-border)] rounded-xl bg-black/20 m-4 min-h-[250px]">
                  <Monitor className="text-gray-600 animate-pulse" size={40} />
                  <div className="font-family font-bold tracking-wider text-sm">OPTICAL STREAM OFFLINE</div>
                  <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
                    Capture the screen to feed visible UI components and layout structures into the J.A.R.V.I.S. neural cortex.
                  </p>
                  <button
                    onClick={startCapture}
                    className="bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/20 text-violet-300 px-4 py-2 mt-2 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all"
                  >
                    Start Capture Stream
                  </button>
                </div>
              )}
            </div>

            {/* Simulated Action Module Command Bar (Fulfills browser automation coordinates task) */}
            <form onSubmit={executeAutomationCommand} className="mt-2 flex gap-2 border-t border-[var(--glass-border)] pt-3 shrink-0">
              <input 
                type="text" 
                placeholder={analysis ? "Type action, e.g., click 'sign in', click 'search'..." : "Feed must be active to trigger automation actions..."}
                disabled={!analysis || isSimulating}
                value={automationCommand}
                onChange={(e) => setAutomationCommand(e.target.value)}
                className="flex-1 bg-black/40 border border-[var(--glass-border)]/65 rounded-xl px-4 py-2.5 font-mono text-xs text-[var(--core-gold)] placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-40"
              />
              <button 
                type="submit"
                disabled={!analysis || isSimulating || !automationCommand.trim()}
                className="bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/25 font-bold hover:text-white px-5 rounded-xl text-xs font-mono transition-all disabled:opacity-35 disabled:hover:bg-violet-500/15 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <Play size={12} /> EXECUTE
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Tab Switcher (Matrix, Q&A, OCR, Timeline) */}
        <div className="lg:col-span-5 flex flex-col gap-4 min-h-[450px] lg:min-h-0 font-mono">
          <div className="glass-panel p-4 rounded-2xl border border-[var(--glass-border)] flex-1 flex flex-col bg-black/40 min-h-0">
            
            {/* Tab selection triggers */}
            <div className="flex border-b border-[var(--glass-border)] pb-2 mb-3 shrink-0 scrollbar-hide overflow-x-auto gap-1">
              <button
                onClick={() => { setActiveTab('elements'); audioEngine.playBeep('click'); }}
                className={`flex-1 py-1 px-2.5 rounded-lg text-[10px] sm:text-xs font-bold tracking-wider font-display transition-all focus:outline-none flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                  activeTab === 'elements' 
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <Layers size={11} /> MATRIX ({sortedAndFilteredElements.length})
              </button>
              
              <button
                onClick={() => { setActiveTab('qa'); audioEngine.playBeep('click'); }}
                className={`flex-1 py-1 px-2.5 rounded-lg text-[10px] sm:text-xs font-bold tracking-wider font-display transition-all focus:outline-none flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                  activeTab === 'qa' 
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <MessageSquare size={11} /> VISION Q&A
              </button>

              <button
                onClick={() => { setActiveTab('ocr'); audioEngine.playBeep('click'); }}
                className={`flex-1 py-1 px-2.5 rounded-lg text-[10px] sm:text-xs font-bold tracking-wider font-display transition-all focus:outline-none flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                  activeTab === 'ocr' 
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <Terminal size={11} /> OCR EXTRACT
              </button>

              <button
                onClick={() => { setActiveTab('memory'); audioEngine.playBeep('click'); }}
                className={`flex-1 py-1 px-2.5 rounded-lg text-[10px] sm:text-xs font-bold tracking-wider font-display transition-all focus:outline-none flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
                  activeTab === 'memory' 
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <Cpu size={11} /> MEMORY ({memoryList.length})
              </button>
            </div>

            {/* ACTIVE TAB VIEWS */}
            <div className="flex-1 flex flex-col min-h-0 relative">
              
              {/* TAB 1: ELEMENTS MATRIX (Interactive element tree with descriptor fuzzy finders) */}
              {activeTab === 'elements' && (
                <div className="flex-1 flex flex-col min-h-0">
                  {analysis ? (
                    <div className="flex-1 flex flex-col min-h-0 gap-3">
                      {/* Search & Type filter */}
                      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                        <div className="flex-1 relative">
                          <input 
                            type="text" 
                            placeholder="Find layout elements (e.g., 'play button')..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/40 border border-[var(--glass-border)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-violet-300 placeholder-gray-500 font-mono focus:outline-none focus:border-violet-500"
                          />
                          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                        </div>
                        <select
                          value={selectedTypeFilter}
                          onChange={(e) => { setSelectedTypeFilter(e.target.value); audioEngine.playBeep('click'); }}
                          className="bg-black/40 border border-[var(--glass-border)] rounded-lg text-xs font-mono p-1.5 outline-none text-violet-300 cursor-pointer"
                        >
                          <option value="all" className="bg-neutral-900 font-mono">All types</option>
                          <option value="button" className="bg-neutral-900 font-mono">Buttons</option>
                          <option value="input_field" className="bg-neutral-900 font-mono">Inputs</option>
                          <option value="search_box" className="bg-neutral-900 font-mono">Search Box</option>
                          <option value="link" className="bg-neutral-900 font-mono">Links</option>
                          <option value="menu" className="bg-neutral-900 font-mono">Menu items</option>
                          <option value="icon" className="bg-neutral-900 font-mono">Icons</option>
                          <option value="error_message" className="bg-neutral-900 font-mono">Errors</option>
                          <option value="dialog_box" className="bg-neutral-900 font-mono">Dialogs</option>
                        </select>
                      </div>

                      {/* Elements List */}
                      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-1.5 max-h-[280px] lg:max-h-none p-0.5">
                        {sortedAndFilteredElements.length > 0 ? (
                          sortedAndFilteredElements.map((el, i) => {
                            const originalIdx = analysis.visible_elements.indexOf(el);
                            const isHovered = hoveredElementIdx === originalIdx;
                            return (
                              <button
                                key={i}
                                onClick={() => handleTargetClick(el)}
                                onMouseEnter={() => setHoveredElementIdx(originalIdx)}
                                onMouseLeave={() => setHoveredElementIdx(null)}
                                className={`text-left p-2.5 rounded-xl border transition-all duration-300 flex items-center justify-between gap-3 focus:outline-none relative group cursor-pointer ${
                                  isHovered 
                                    ? 'bg-violet-500/10 border-violet-500/50 shadow-[0_0_10px_rgba(139,92,246,0.15)]'
                                    : 'bg-black/15 border-[var(--glass-border)]/50 hover:bg-white/5 hover:border-violet-500/20'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="p-1 rounded-lg bg-black/40 border border-white/5 flex-shrink-0">
                                    {getElementIcon(el.type)}
                                  </span>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[11px] font-bold text-gray-200 group-hover:text-violet-300 truncate font-mono">
                                      "{el.text}"
                                    </span>
                                    <span className="text-[9px] text-gray-500 lowercase truncate font-mono">
                                      {el.type} {el.description && `• ${el.description}`}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[9px] font-bold bg-neutral-900/80 border border-violet-500/15 text-amber-500 font-mono px-1.5 py-0.5 rounded">
                                    [{el.position[0]}%, {el.position[1]}%]
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="flex flex-col items-center justify-center py-6 gap-2 opacity-50 font-mono text-xs">
                            <AlertTriangle size={14} className="text-amber-500" />
                            <span>No layout elements match criteria.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 font-mono text-xs gap-1 py-12">
                      <Layers size={20} />
                      <span>Standby. Scan results will display element matrix tree...</span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: VISION Q&A (Natural language questions asked about active frame layout) */}
              {activeTab === 'qa' && (
                <div className="flex-1 flex flex-col min-h-0 gap-3">
                  <div className="flex-1 overflow-y-auto scrollbar-hide max-h-[220px] lg:max-h-none flex flex-col gap-2 p-1.5 bg-black/20 border border-[var(--glass-border)] rounded-xl min-h-[150px]">
                    {qaHistory.length > 0 ? (
                      qaHistory.map((h, i) => (
                        <div key={i} className={`flex flex-col gap-1 text-xs max-w-[90%] ${h.role === 'user' ? 'self-end bg-violet-500/10 border border-violet-500/20 text-violet-300' : 'self-start bg-black/40 border border-[var(--glass-border)] text-gray-200'} px-3 py-2 rounded-xl`}>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-[#fbbf24]/90 font-display">
                            {h.role === 'user' ? 'INTELLIGENT COMMAND' : 'VISION CORTEX'}
                          </span>
                          <p className="leading-relaxed whitespace-pre-wrap font-mono select-text">{h.text}</p>
                        </div>
                      ))
                    ) : (
                      <div className="flex-grow flex flex-col items-center justify-center p-4 text-center opacity-40 text-xs gap-1.5">
                        <HelpCircle size={20} />
                        <span>Query any graphical layout features on the screen. Try: "Where is the subscribe button?" or "List visible form labels."</span>
                      </div>
                    )}
                    {isAnswering && (
                      <div className="bg-black/30 border border-dashed border-[var(--glass-border)] p-3 rounded-xl flex items-center gap-2 self-start max-w-[80%] animate-pulse">
                        <div className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-ping" />
                        <span className="text-xs text-gray-400 font-mono">Modulating semantic responses...</span>
                      </div>
                    )}
                  </div>

                  <form 
                    onSubmit={(e) => { e.preventDefault(); sendQuestion(); }}
                    className="flex gap-1.5 shrink-0"
                  >
                    <input
                      type="text"
                      placeholder={screenshot ? "Ask about current screen..." : "optical link offline"}
                      disabled={!screenshot || isAnswering}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      className="flex-1 bg-black/40 border border-[var(--glass-border)] rounded-xl px-4 py-2 text-xs text-[var(--core-gold)] placeholder-gray-500 font-mono focus:outline-none focus:border-violet-500 disabled:opacity-40"
                    />
                    <button
                      type="submit"
                      disabled={!screenshot || isAnswering || !question.trim()}
                      className="bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/35 hover:text-white px-4 rounded-xl text-xs font-mono transition-all disabled:opacity-35 cursor-pointer"
                    >
                      SEND
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 3: OCR RAW TEXT (High-fidelity direct reading text terminal) */}
              {activeTab === 'ocr' && (
                <div className="flex-1 flex flex-col min-h-0 bg-black/30 border border-[var(--glass-border)] rounded-xl p-3">
                  <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-2 mb-2 shrink-0">
                    <span className="text-[10px] tracking-widest text-violet-400 font-bold uppercase">OCR DATASTREAM</span>
                    {analysis?.ocr_text && (
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(analysis.ocr_text);
                          audioEngine.playBeep('click');
                          setAutomationLogs(prev => [...prev, "[SYSTEM] OCR text copied to clipboard successfully."]);
                        }}
                        className="text-[10px] text-gray-400 hover:text-violet-300 hover:underline cursor-pointer"
                      >
                        Copy All
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto max-h-[220px] lg:max-h-none scrollbar-hide text-xs leading-relaxed text-gray-300 select-text whitespace-pre-wrap font-mono bg-black/10 p-2 rounded">
                    {analysis?.ocr_text ? (
                      analysis.ocr_text
                    ) : (
                      <span className="opacity-30 italic">No OCR data available. Perform screen scan to record textual streams.</span>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: VISION MEMORY TIMELINE */}
              {activeTab === 'memory' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto scrollbar-hide max-h-[300px] lg:max-h-none flex flex-col gap-2.5 p-0.5">
                    {memoryList.length > 0 ? (
                      memoryList.map((m, idx) => (
                        <div 
                          key={idx}
                          className="bg-black/15 border border-[var(--glass-border)] p-3 rounded-xl flex items-start gap-3 transition-colors hover:bg-black/30"
                        >
                          <div className="w-2.5 h-2.5 rounded-full bg-violet-400 border border-black shadow-[0_0_8px_rgba(139,92,246,0.8)] mt-1.5 flex-shrink-0 animate-pulse" />
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-baseline justify-between gap-2 border-b border-white/5 pb-1 mb-1 font-mono">
                              <span className="text-[11px] font-bold text-gray-200">
                                STATE UPDATE #{memoryList.length - idx}
                              </span>
                              <span className="text-[9px] text-gray-500">
                                {m.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                            <span className="text-[10.5px] text-gray-300 font-mono">
                              Application changed or focused: <strong className="text-[var(--core-gold)]">"{m.application}"</strong>
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              Context page: <em className="text-violet-300">"{m.current_page}"</em>
                            </span>
                            <span className="text-[9px] text-gray-500 block font-mono mt-0.5">
                              Extracted layout coordinates: {m.elementsCount} controls synced.
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex-grow flex flex-col items-center justify-center p-4 text-center opacity-40 text-xs gap-1.5">
                        <Cpu size={20} />
                        <span>Optical memory history empty. Coordinates, pages, and active application indexes records automatically log here.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Core Vision logs console output */}
          <div className="glass-panel p-3 rounded-2xl border border-[var(--glass-border)] flex flex-col bg-black/50 overflow-hidden h-36 shrink-0 font-mono">
            <h4 className="font-display uppercase text-[10px] tracking-widest text-violet-400 border-b border-[var(--glass-border)] pb-1 mb-1.5 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1.5"><Terminal size={11} /> Optical Console Terminal Feedback</span>
              <button 
                onClick={() => setAutomationLogs([])}
                className="text-[9px] text-gray-500 hover:text-white uppercase font-mono cursor-pointer"
              >
                Clear
              </button>
            </h4>
            <div className="flex-1 overflow-y-auto scrollbar-hide text-[10px] text-gray-400 flex flex-col gap-1 font-mono select-text bg-black/10 p-1.5 rounded">
              {automationLogs.map((log, i) => {
                let colorClass = "text-gray-400";
                if (log.includes("[ERROR]")) colorClass = "text-red-400 font-bold";
                else if (log.includes("[WARN]")) colorClass = "text-amber-400";
                else if (log.includes("[SYSTEM]")) colorClass = "text-cyan-400";
                else if (log.includes("[VISION]")) colorClass = "text-violet-400";
                else if (log.includes("[EXEC]")) colorClass = "text-amber-300";
                else if (log.includes("[Q&A]")) colorClass = "text-emerald-400";
                
                return (
                  <div key={i} className={`font-mono border-l-2 border-white/5 pl-1.5 ${colorClass}`}>
                    {log}
                  </div>
                );
              })}
              {automationLogs.length === 0 && (
                <span className="font-mono text-gray-600 italic">Terminal active. Waiting for system inputs...</span>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
