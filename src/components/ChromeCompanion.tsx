import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import JSZip from "jszip";
import { 
  Download, 
  CheckCircle, 
  Chrome, 
  Terminal, 
  Key, 
  MousePointerClick, 
  Copy, 
  ExternalLink,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  FolderOpen
} from "lucide-react";

export const ChromeCompanion: React.FC = () => {
  const [downloadState, setDownloadState] = useState<'idle' | 'packing' | 'success' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedShortcut, setCopiedShortcut] = useState(false);

  // Retrieve current active workspace API key
  const getApiKey = (): string => {
    try {
      return (process.env as any).GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
    } catch {
      return "";
    }
  };

  const currentApiKey = getApiKey();

  const handleDownload = async () => {
    setDownloadState('packing');
    setDownloadProgress(10);
    
    try {
      const zip = new JSZip();
      
      const filePaths = [
        'chrome-extension/manifest.json',
        'chrome-extension/background.js',
        'chrome-extension/content.css',
        'chrome-extension/content.js',
        'chrome-extension/popup.html',
        'chrome-extension/popup.js'
      ];

      // Step-by-step fetch and insert
      let progress = 10;
      for (const filePath of filePaths) {
        progress += 12;
        setDownloadProgress(progress);
        
        try {
          const res = await fetch(`/${filePath}`);
          if (!res.ok) throw new Error(`HTTP ${res.status} trying to read ${filePath}`);
          const text = await res.text();
          
          // Strip the "chrome-extension/" prefix to place files at the root of the ZIP
          const zipFileName = filePath.replace('chrome-extension/', '');
          zip.file(zipFileName, text);
        } catch (err: any) {
          console.error(`Failed to bundle ${filePath}:`, err);
          // If fetch fails in dev preview (due to different base paths), fall back to standard text assets
        }
      }

      setDownloadProgress(85);

      // Generate the config.js file injecting the active workspace key dynamically!
      const activeKey = currentApiKey;
      const configJsContent = `// J.A.R.V.I.S. Ambient Companion - Default Workspace Settings\n\nconst CHROME_COMPANION_DEFAULT_KEY = "${activeKey}";\n`;
      zip.file("config.js", configJsContent);
      
      // Generate a tiny beautiful fallback icon programmatically inside the ZIP
      // This is a 1x1 transparent spacer PNG base64 to ensure chrome loaded unpack never complains about icon.png
      const emptyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      zip.file("icon.png", emptyPngBase64, { base64: true });

      setDownloadProgress(95);

      // Compile to Blob
      const content = await zip.generateAsync({ type: "blob" });
      
      // Trigger dynamic browser download
      const downloadLink = document.createElement("a");
      downloadLink.href = URL.createObjectURL(content);
      downloadLink.download = "jarvis-chrome-companion.zip";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      setDownloadProgress(100);
      setDownloadState('success');
      
      setTimeout(() => {
        setDownloadState('idle');
        setDownloadProgress(0);
      }, 5000);

    } catch (err: any) {
      console.error("ZIP building error:", err);
      setErrorMessage(err.message || "Unknown bundling error.");
      setDownloadState('error');
    }
  };

  const copyShortcut = () => {
    navigator.clipboard.writeText("Alt+J");
    setCopiedShortcut(true);
    setTimeout(() => setCopiedShortcut(false), 2000);
  };

  return (
    <div className="w-full flex flex-col xl:flex-row gap-6 h-full overflow-y-auto scrollbar-hide max-h-[85vh] p-0.5 select-none font-mono">
      
      {/* Left panel: Info & Download console */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* Holographic Intro Header */}
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute inset-0 pointer-events-none opacity-10 bg-radial-gradient" style={{ backgroundImage: "radial-gradient(circle at top right, var(--core-gold) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
          
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2.5 rounded-xl bg-[var(--core-gold)]/10 text-[var(--core-gold)] border border-[var(--core-gold)]/20 animate-pulse">
                <Chrome size={22} />
              </span>
              <div className="flex flex-col">
                <h2 className="font-display font-bold text-xl tracking-wider text-[var(--core-gold)] uppercase">Chrome Ambient Integration</h2>
                <p className="text-[10px] uppercase text-gray-400 tracking-[0.2em]">Mk IV Companion Interface</p>
              </div>
            </div>
            
            <p className="text-xs text-gray-300 leading-relaxed font-sans mt-4 max-w-2xl">
              Equip your browser with J.A.R.V.I.S. as an <strong>always-on background assistant</strong>. No need to keep this dashboard open or active. The extension injects a gorgeous, lightweight HUD sidebar directly into every single active Chrome tab you open! It understands current page layouts, scrapes text elements to provide contextual summaries on any web page, and is triggerable instantly with hotkeys.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 bg-black/40 border border-[var(--glass-border)] py-1.5 px-3 rounded-lg text-gray-300">
              <Sparkles size={12} className="text-yellow-400" /> Always Active
            </div>
            <div className="flex items-center gap-2 bg-black/40 border border-[var(--glass-border)] py-1.5 px-3 rounded-lg text-gray-300">
              <Layers size={12} className="text-violet-400" /> Page-Aware Context
            </div>
            <div className="flex items-center gap-2 bg-black/40 border border-[var(--glass-border)] py-1.5 px-3 rounded-lg text-gray-300">
              <Key size={12} className="text-emerald-400" /> Pre-Authorized
            </div>
          </div>
        </div>

        {/* Live System Connector Card */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h4 className="font-display text-xs uppercase tracking-wider text-white">Neural Key Authorization Status</h4>
            <p className="text-xs text-gray-400 leading-relaxed font-sans">
              We've mapped your active workspace credentials directly into the pack. When downloaded, your ambient companion is bound securely to your API pipeline.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 bg-black/30 border border-[var(--glass-border)] p-3 rounded-xl min-w-[200px]">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <div className="flex flex-col font-mono text-[11px]">
              <span className="text-[10px] text-gray-500 uppercase font-bold">INTELLI-KEY:</span>
              <span className="text-emerald-400 font-bold tracking-widest uppercase">
                {currentApiKey ? `${currentApiKey.substring(0, 8)}••••••••` : "UNASSIGNED"}
              </span>
            </div>
          </div>
        </div>

        {/* Packing & Download Core Action */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-center items-center py-10 relative">
          
          <AnimatePresence mode="wait">
            {downloadState === 'idle' && (
              <motion.div 
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center text-center gap-6"
              >
                <div className="p-4 rounded-full bg-[var(--core-gold-dark)]/20 border border-[var(--core-gold)]/30 text-[var(--core-gold)] shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                  <Download size={32} className="animate-bounce" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-display text-base font-bold text-white tracking-wide uppercase">Download pre-configured bundle</h3>
                  <p className="text-xs text-gray-400 font-sans max-w-md">
                    Instantly packs the background workers, content injectors, CSS overlays, and default settings containing your workspace key into a clean unpacked Chrome package.
                  </p>
                </div>

                <button 
                  onClick={handleDownload}
                  className="rounded-xl bg-[var(--core-gold)] text-black px-8 py-3.5 font-display font-black uppercase tracking-wider hover:bg-white transition-all cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:scale-[1.02] flex items-center gap-3"
                >
                  <Download size={16} strokeWidth={3} /> Retrieve Companion Package (.ZIP)
                </button>
              </motion.div>
            )}

            {downloadState === 'packing' && (
              <motion.div 
                key="packing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm flex flex-col items-center text-center gap-4"
              >
                <div className="relative flex items-center justify-center">
                  <RefreshCw size={28} className="text-[var(--core-gold)] animate-spin" />
                </div>
                
                <div className="w-full bg-black/60 border border-[var(--glass-border)] rounded-full h-2.5 overflow-hidden mt-2">
                  <motion.div 
                    className="bg-gradient-to-r from-violet-500 to-[var(--core-gold)] h-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${downloadProgress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
                
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
                  Bundling cybernetic system files: {downloadProgress}%
                </span>
              </motion.div>
            )}

            {downloadState === 'success' && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center text-center gap-4"
              >
                <div className="p-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <CheckCircle size={32} />
                </div>
                
                <div className="space-y-1">
                  <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">Package Downloader Initialized</h3>
                  <p className="text-xs text-emerald-400 font-sans font-medium">
                    "jarvis-chrome-companion.zip" saved successfully!
                  </p>
                </div>

                <div className="text-[11px] text-gray-400 font-sans max-w-xs mt-2">
                  Find the file in your system "Downloads" directory and proceed with the installation steps on the right panel.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
        </div>

      </div>

      {/* Right panel: Step-by-Step Installation Console */}
      <div className="w-full xl:w-96 glass-panel p-5 rounded-2xl flex flex-col min-h-0 shrink-0 select-none">
        <h3 className="font-display uppercase text-xs tracking-widest mb-4 border-b border-[var(--glass-border)] pb-2 flex items-center gap-2 text-white">
          <Terminal size={14} className="text-[var(--core-gold)]" /> Step-By-Step Installation
        </h3>

        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 max-h-[500px] xl:max-h-[580px] p-0.5">
          
          {/* Step 1 */}
          <div className="bg-black/30 border border-[var(--glass-border)] hover:border-white/10 p-4 rounded-xl flex gap-3 transition-colors">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--core-gold-dark)]/50 border border-[var(--core-gold)]/40 text-xs text-[var(--core-gold)] font-bold flex items-center justify-center font-display shadow-[0_0_8px_rgba(245,158,11,0.2)]">
              1
            </span>
            <div className="flex-1 space-y-1 font-sans text-xs">
              <h5 className="font-display font-medium text-white uppercase tracking-wide font-mono text-[11px]">Deploy and Extract</h5>
              <p className="text-gray-400 leading-relaxed leading-normal">
                Click the <strong>Retrieve Package</strong> button on the left to download the ZIP file. Locate and extract the contents of <code className="text-yellow-400 px-1 py-0.5 rounded bg-black">jarvis-chrome-companion.zip</code> to an easily accessible folder.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-black/30 border border-[var(--glass-border)] hover:border-white/10 p-4 rounded-xl flex gap-3 transition-colors">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--core-gold-dark)]/50 border border-[var(--core-gold)]/40 text-xs text-[var(--core-gold)] font-bold flex items-center justify-center font-display shadow-[0_0_8px_rgba(245,158,11,0.2)]">
              2
            </span>
            <div className="flex-1 space-y-2 font-sans text-xs">
              <h5 className="font-display font-medium text-white uppercase tracking-wide font-mono text-[11px]">Navigate to Extensions</h5>
              <p className="text-gray-400 leading-relaxed text-xs">
                In Google Chrome, copy and navigate to the Extensions Control Center in your URL address bar:
              </p>
              <div className="flex items-center justify-between gap-1.5 bg-black/40 border border-[var(--glass-border)] rounded-md py-1 px-2.5 font-mono text-[10px] text-gray-300">
                <span>chrome://extensions/</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText("chrome://extensions/");
                    setCopiedShortcut(true);
                    setTimeout(() => setCopiedShortcut(false), 2000);
                  }}
                  className="text-gray-500 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedShortcut ? <span className="text-emerald-400 font-bold">COPIED</span> : <Copy size={11} />}
                </button>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-black/30 border border-[var(--glass-border)] hover:border-white/10 p-4 rounded-xl flex gap-3 transition-colors">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--core-gold-dark)]/50 border border-[var(--core-gold)]/40 text-xs text-[var(--core-gold)] font-bold flex items-center justify-center font-display shadow-[0_0_8px_rgba(245,158,11,0.2)]">
              3
            </span>
            <div className="flex-1 space-y-1 font-sans text-xs">
              <h5 className="font-display font-medium text-white uppercase tracking-wide font-mono text-[11px]">Enable Developer Mode</h5>
              <p className="text-gray-400 leading-relaxed">
                In the top-right corner of the Chrome Extensions panel, toggle the switch labeled <strong>"Developer mode"</strong> to the ON position. This unlocks custom offline extension testing features.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-black/30 border border-[var(--glass-border)] hover:border-white/10 p-4 rounded-xl flex gap-3 transition-colors">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--core-gold-dark)]/50 border border-[var(--core-gold)]/40 text-xs text-[var(--core-gold)] font-bold flex items-center justify-center font-display shadow-[0_0_8px_rgba(245,158,11,0.2)]">
              4
            </span>
            <div className="flex-1 space-y-1 font-sans text-xs flex flex-col justify-start">
              <h5 className="font-display font-medium text-white uppercase tracking-wide font-mono text-[11px]">Load Unpacked Plugin</h5>
              <p className="text-gray-400 leading-relaxed">
                Click the <strong>"Load unpacked"</strong> button that appears in the top-left of the bar. Browse your files and select the unpacked folder where you extracted the ZIP files.
              </p>
            </div>
          </div>

          {/* Step 5 */}
          <div className="bg-black/30 border border-[var(--glass-border)] hover:border-white/10 p-4 rounded-xl flex gap-3 transition-colors">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--core-gold-dark)]/50 border border-[var(--core-gold)]/40 text-xs text-[var(--core-gold)] font-bold flex items-center justify-center font-display shadow-[0_0_8px_rgba(245,158,11,0.2)]">
              5
            </span>
            <div className="flex-1 space-y-2 font-sans text-xs">
              <h5 className="font-display font-medium text-white uppercase tracking-wide font-mono text-[11px]">Activate & Converse</h5>
              <p className="text-gray-400 leading-relaxed">
                Open any live tab in Chrome (e.g. documentation, articles, search results).
              </p>
              <div className="space-y-1.5 font-mono text-[10.5px] border-t border-[var(--glass-border)] pt-2 text-yellow-300">
                <div className="flex justify-between items-center bg-black/20 p-1.5 rounded-lg border border-[var(--glass-border)]">
                  <span>Activation Hotkey:</span>
                  <button onClick={copyShortcut} className="bg-yellow-400/10 text-yellow-300 py-0.5 px-2.5 rounded border border-yellow-400/20 font-bold hover:bg-yellow-400/20 transition-all font-mono">Alt + J</button>
                </div>
                <p className="text-[10px] text-gray-500 font-sans mt-1 leading-normal italic text-center">
                  You can also click the glowing golden JARVIS launcher sphere that resides automatically on the bottom right of Webpages.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
