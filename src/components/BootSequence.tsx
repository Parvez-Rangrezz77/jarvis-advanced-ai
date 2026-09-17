import { motion } from "motion/react";
import React, { useEffect, useState } from "react";
import { audioEngine } from "../lib/audio";

const bootLogs = [
  "INITIALIZING KERNEL...",
  "LOADING NEURAL NETWORKS...",
  "ESTABLISHING SECURE CONNECTION...",
  "CALIBRATING SENSORS...",
  "BOOT SEQUENCE COMPLETE."
];

export const BootSequence: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    audioEngine.playBeep('startup');
    let delay = 0;
    bootLogs.forEach((log, index) => {
      delay += Math.random() * 400 + 200;
      setTimeout(() => {
        setLogs((prev) => [...prev, log]);
        audioEngine.playBeep('scan');
        if (index === bootLogs.length - 1) {
          setTimeout(onComplete, 800);
        }
      }, delay);
    });
  }, [onComplete]);

  return (
    <div className="flex flex-col items-start justify-center h-screen w-screen p-10 font-mono text-sm">
      <div className="flex flex-col gap-2">
        {logs.map((log, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`glow-text ${i === bootLogs.length - 1 ? 'text-[var(--core-blue)]' : 'text-gray-400'}`}
          >
            {log}
          </motion.div>
        ))}
        {logs.length < bootLogs.length && (
          <motion.div
            animate={{ opacity: [1, 0, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className="w-3 h-4 bg-[var(--core-blue)] mt-2"
          />
        )}
      </div>
    </div>
  );
};
