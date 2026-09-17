import React, { useEffect, useRef } from "react";
import { motion } from "motion/react";

export const AiCore: React.FC<{ isListening?: boolean; isThinking?: boolean; isSpeaking?: boolean; agentId?: string }> = ({ isListening, isThinking, isSpeaking, agentId = "jarvis-core" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ isListening, isThinking, isSpeaking });

  const colorThemes: Record<string, { rings: { color: string; rgb: string }[], bgGlow: string }> = {
    'jarvis-core': {
      bgGlow: 'radial-gradient(circle, rgba(245,158,11,0.2) 0%, rgba(0,0,0,0) 70%)',
      rings: [
        { color: '#fffbeb', rgb: '255, 251, 235' },
        { color: '#fde68a', rgb: '253, 230, 138' },
        { color: '#fbbf24', rgb: '251, 191, 36' },
        { color: '#f59e0b', rgb: '245, 158, 11' },
        { color: '#d97706', rgb: '217, 119, 6' },
      ]
    },
    'vision-sentinel': {
      bgGlow: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, rgba(0,0,0,0) 70%)',
      rings: [
        { color: '#f5f3ff', rgb: '245, 243, 255' },
        { color: '#ddd6fe', rgb: '221, 214, 254' },
        { color: '#c084fc', rgb: '192, 132, 252' },
        { color: '#a78bfa', rgb: '167, 139, 250' },
        { color: '#8b5cf6', rgb: '139, 92, 246' },
      ]
    },
    'cyber-search': {
      bgGlow: 'radial-gradient(circle, rgba(6,182,212,0.2) 0%, rgba(0,0,0,0) 70%)',
      rings: [
        { color: '#ecfeff', rgb: '236, 254, 255' },
        { color: '#cffafe', rgb: '207, 250, 254' },
        { color: '#67e8f9', rgb: '103, 232, 249' },
        { color: '#22d3ee', rgb: '34, 211, 238' },
        { color: '#06b6d4', rgb: '6, 182, 212' },
      ]
    },
    'hardware-syscon': {
      bgGlow: 'radial-gradient(circle, rgba(239,68,68,0.2) 0%, rgba(0,0,0,0) 70%)',
      rings: [
        { color: '#fef2f2', rgb: '254, 242, 242' },
        { color: '#fecaca', rgb: '254, 202, 202' },
        { color: '#fca5a5', rgb: '252, 165, 165' },
        { color: '#ef4444', rgb: '239, 68, 68' },
        { color: '#dc2626', rgb: '220, 38, 38' },
      ]
    },
    'comms-link': {
      bgGlow: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, rgba(0,0,0,0) 70%)',
      rings: [
        { color: '#f0fdf4', rgb: '240, 253, 244' },
        { color: '#d1fae5', rgb: '209, 250, 229' },
        { color: '#6ee7b7', rgb: '110, 231, 183' },
        { color: '#34d399', rgb: '52, 211, 153' },
        { color: '#10b981', rgb: '16, 185, 129' },
      ]
    }
  };

  const currentTheme = colorThemes[agentId] || colorThemes['jarvis-core'];

  // Update ref so animation loop can access latest without restarting
  useEffect(() => {
    stateRef.current = { isListening, isThinking, isSpeaking };
  }, [isListening, isThinking, isSpeaking]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = canvas.width = canvas.parentElement?.clientWidth || 400;
    let height = canvas.height = canvas.parentElement?.clientHeight || 400;
    const cx = width / 2;
    const cy = height / 2;

    // 3D Setup
    const focalLength = 300;
    const maxZ = 200;

    interface Particle {
      x: number;
      y: number;
      z: number;
      ox: number; 
      oy: number; 
      oz: number;
      color: string;
      rgb: string;
      size: number;
      ringIndex: number;
    }

    const particles: Particle[] = [];
    
    // Geometry generation - reduced counts drastically for performance
    const rings = [
      { radius: 40, count: 20, color: currentTheme.rings[0].color, rgb: currentTheme.rings[0].rgb, speed: 0.02 }, // Core
      { radius: 100, count: 40, color: currentTheme.rings[1].color, rgb: currentTheme.rings[1].rgb, speed: -0.01 }, // Inner Ring 1
      { radius: 150, count: 60, color: currentTheme.rings[2].color, rgb: currentTheme.rings[2].rgb, speed: 0.008 }, // Inner Ring 2
      { radius: 210, count: 80, color: currentTheme.rings[3].color, rgb: currentTheme.rings[3].rgb, speed: -0.005 }, // Mid Ring 
      { radius: 280, count: 120, color: currentTheme.rings[4].color, rgb: currentTheme.rings[4].rgb, speed: 0.003 }  // Outer Ring
    ];

    rings.forEach((ring, idx) => {
      for (let i = 0; i < ring.count; i++) {
        // Distribute points on a sphere band
        const theta = Math.random() * Math.PI * 2;
        // Concentrate points near the equator of the ring, but with some variation
        const phi = Math.acos(Math.random() * 0.4 - 0.2); 
        
        const x = ring.radius * Math.sin(phi) * Math.cos(theta);
        const y = ring.radius * Math.sin(phi) * Math.sin(theta);
        const z = ring.radius * Math.cos(phi);

        particles.push({
          x, y, z, 
          ox: x, oy: y, oz: z,
          color: ring.color,
          rgb: ring.rgb,
          size: Math.random() * 1.5 + 0.5,
          ringIndex: idx
        });
      }
    });

    let angleX = 0;
    let angleY = 0;
    let angleZ = 0;

    let time = 0;

    const render = () => {
      time += 0.01;
      const { isListening, isThinking, isSpeaking } = stateRef.current;
      const isActive = isListening || isThinking || isSpeaking;
      
      const speedMultiplier = isActive ? (isSpeaking ? 3.5 : 2.5) : 1;
      const pulse = isSpeaking ? Math.sin(time * 15) * 2.5 : (isActive ? Math.sin(time * 5) * 1.2 : 1);

      // Clear canvas with a transparent dark background to let glowing trails stay a bit (optional trail effect)
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(0, 0, width, height);
      
      ctx.globalCompositeOperation = "lighter";

      angleY += 0.005 * speedMultiplier;
      angleX += 0.002 * speedMultiplier;
      angleZ += 0.001 * speedMultiplier;

      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosZ = Math.cos(angleZ);
      const sinZ = Math.sin(angleZ);

      // Project and draw
      const projected: {x: number, y: number, z: number, p: Particle}[] = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const ring = rings[p.ringIndex];
        
        // Individual ring rotation
        const ringAngle = time * ring.speed * 60 * speedMultiplier;
        const cosR = Math.cos(ringAngle);
        const sinR = Math.sin(ringAngle);

        // Rotate point around Y axis for ring motion
        let rx = p.ox * cosR - p.oz * sinR;
        let rz = p.ox * sinR + p.oz * cosR;
        let ry = p.oy;

        // Add some noise / pulse
        const noise = pulse > 1 ? (Math.random() * 2 - 1) * (isSpeaking ? 4 : 2) : 0;
        rx += noise; ry += noise; rz += noise;

        // Speaking vibration on Y axis
        if (isSpeaking) {
           ry += Math.sin(time * 30 + p.ox) * 5;
        }

        // Global 3D Rotation
        // X
        let y1 = ry * cosX - rz * sinX;
        let z1 = ry * sinX + rz * cosX;
        // Y
        let x2 = rx * cosY - z1 * sinY;
        let z2 = rx * sinY + z1 * cosY;
        // Z
        let x3 = x2 * cosZ - y1 * sinZ;
        let y3 = x2 * sinZ + y1 * cosZ;

        // Project
        const scale = focalLength / (focalLength + z2 + maxZ);
        const px = cx + x3 * scale * (isActive ? 1.05 : 1);
        const py = cy + y3 * scale * (isActive ? 1.05 : 1);

        projected.push({ x: px, y: py, z: z2, p });

        // Draw particle
        ctx.beginPath();
        const drawSize = p.size * scale * (p.ringIndex === 0 && isActive ? 2 : 1);
        ctx.arc(px, py, drawSize, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        
        // Pseudo-glow without heavy shadowBlur
        if (p.ringIndex <= 1 && isActive) {
          ctx.beginPath();
          ctx.arc(px, py, drawSize * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${p.rgb}, 0.2)`;
          ctx.fill();
        }
      }

      // Draw connections (network)
      // Connect points in similar depth to save performance and look cool
      ctx.lineWidth = 0.5;
      
      for (let i = 0; i < projected.length; i++) { 
        const p1 = projected[i];
        for (let j = i + 1; j < projected.length; j+=2) {
          const p2 = projected[j];
          // Distance in 2D
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < 2500 && Math.abs(p1.z - p2.z) < 60) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            
            // Alpha based on distance
            const alpha = (1 - distSq / 2500) * 0.4;
            ctx.strokeStyle = `rgba(${p1.p.rgb}, ${alpha})`;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    const handleResize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 400;
      canvas.height = canvas.parentElement?.clientHeight || 400;
      width = canvas.width;
      height = canvas.height;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [agentId]); // re-run particle generation on agentId shift to load new color configurations instantly!

  return (
    <div className="relative w-full max-w-[280px] aspect-square md:max-w-none md:w-[600px] md:h-[600px] flex items-center justify-center">
      {/* Background glow and rings to compose with canvas */}
      <motion.div
          className="absolute w-[60%] h-[60%] rounded-full transition-all duration-700"
          style={{ background: currentTheme.bgGlow, filter: 'blur(30px)' }}
          animate={{ 
            scale: isSpeaking ? [1, 1.4, 1] : ((isListening || isThinking) ? [1, 1.2, 1] : [1, 1.05, 1]),
            opacity: isSpeaking ? [0.8, 1, 0.8] : ((isListening || isThinking) ? [0.6, 0.9, 0.6] : [0.3, 0.5, 0.3])
          }}
          transition={{ duration: isSpeaking ? 0.3 : 2, repeat: Infinity, ease: "easeInOut" }}
        />
        
        <canvas 
          ref={canvasRef} 
          className="absolute w-full h-full z-10"
          style={{ mixBlendMode: 'screen' }}
        />
      </div>
    );
  };
