import { motion } from "motion/react";
import { ScanFace, Fingerprint, LockOpen } from "lucide-react";
import React, { useEffect, useState } from "react";
import { audioEngine } from "../lib/audio";

export const AuthScreen: React.FC<{ onAuthSuccess: () => void }> = ({ onAuthSuccess }) => {
  const [status, setStatus] = useState<"scanning" | "verifying" | "success">("scanning");

  useEffect(() => {
    const scanTimer = setTimeout(() => {
      setStatus("verifying");
      audioEngine.playBeep('scan');
      
      const verifyTimer = setTimeout(() => {
        setStatus("success");
        audioEngine.playBeep('click');
        setTimeout(onAuthSuccess, 1000);
      }, 1500);
      
      return () => clearTimeout(verifyTimer);
    }, 2000);

    return () => clearTimeout(scanTimer);
  }, [onAuthSuccess]);

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.1)_0%,transparent_70%)]" />
      
      <motion.div 
        className="relative flex flex-col items-center gap-6 glass-panel p-12 rounded-3xl"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <div className="relative">
          {status === "success" ? (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-[var(--core-blue)]">
              <LockOpen size={80} strokeWidth={1} />
            </motion.div>
          ) : (
            <div className="relative text-[var(--core-blue)]">
              <ScanFace size={80} strokeWidth={1} className={status === "scanning" ? "opacity-50" : "opacity-100"} />
              {status === "scanning" && (
                <motion.div 
                  className="absolute top-0 left-0 w-full h-[2px] bg-[var(--core-blue)] shadow-[0_0_10px_var(--core-blue)]"
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
              )}
            </div>
          )}
        </div>

        <div className="text-center font-display uppercase tracking-widest text-xl glow-text">
          {status === "scanning" && "Awaiting Biometrics"}
          {status === "verifying" && "Verifying Identity"}
          {status === "success" && "Access Granted"}
        </div>
      </motion.div>
    </div>
  );
};
