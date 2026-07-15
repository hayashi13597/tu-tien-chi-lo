"use client";

import gsap from "gsap";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface ParticleCanvasHandle {
  spawnAbsorption: (count?: number) => void;
  spawnBurst: (color: string, count?: number) => void;
}

interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  size: number;
  color: string;
  life: number;
  speed: number;
  trail: { x: number; y: number; size: number }[];
  z: number;
}

export const ParticleCanvas = forwardRef<ParticleCanvasHandle>(
  function ParticleCanvas(_props, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);

    useImperativeHandle(ref, () => ({
      // Ambient inflow: particles spawn on a ring and drift into the dantian core.
      spawnAbsorption(count = 6) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dantian = document.querySelector(".dantian");
        let cx: number;
        let cy: number;
        if (dantian) {
          const dRect = dantian.getBoundingClientRect();
          const cRect = canvas.getBoundingClientRect();
          cx = dRect.left + dRect.width / 2 - cRect.left;
          cy = dRect.top + dRect.height / 2 - cRect.top;
        } else {
          cx = canvas.width / 2;
          cy = canvas.height / 2;
        }
        for (let i = 0; i < count; i++) {
          setTimeout(() => {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.max(canvas.width, canvas.height) * 0.55;
            const z = Math.random() * 0.7 + 0.3;
            particlesRef.current.push({
              x: cx + Math.cos(angle) * dist,
              y: cy + Math.sin(angle) * dist,
              targetX: cx,
              targetY: cy,
              size: (Math.random() * 2.5 + 1.5) * z,
              color: Math.random() > 0.5 ? "#5dd9b1" : "#fbbf24",
              life: 1,
              speed: Math.random() * 0.012 + 0.008,
              trail: [],
              z,
            });
          }, i * 60);
        }
      },
      // Outward burst on breakthrough success, in the new realm's color.
      spawnBurst(color: string, count = 80) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dantian = document.querySelector(".dantian");
        let cx: number;
        let cy: number;
        if (dantian) {
          const dRect = dantian.getBoundingClientRect();
          const cRect = canvas.getBoundingClientRect();
          cx = dRect.left + dRect.width / 2 - cRect.left;
          cy = dRect.top + dRect.height / 2 - cRect.top;
        } else {
          cx = canvas.width / 2;
          cy = canvas.height / 2;
        }
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2;
          particlesRef.current.push({
            x: cx,
            y: cy,
            targetX: cx + Math.cos(angle) * 500,
            targetY: cy + Math.sin(angle) * 500,
            size: Math.random() * 4 + 2,
            color,
            life: 1.2,
            speed: 0.02,
            trail: [],
            z: 1,
          });
        }
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      let rafId: number;

      const resize = () => {
        // The canvas has `inset: 0` with no explicit size, so measuring its own
        // rect is self-referential. Measure the positioned parent it fills.
        const rect = (canvas.parentElement ?? canvas).getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
      };
      resize();
      window.addEventListener("resize", resize);

      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const particles = particlesRef.current;

        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          // Ease toward target; grow slightly as it nears the center.
          p.x += (p.targetX - p.x) * p.speed;
          p.y += (p.targetY - p.y) * p.speed;
          const dist = Math.hypot(p.x - p.targetX, p.y - p.targetY);
          const sizeMult = 1 + (1 - Math.min(dist / 300, 1)) * 0.5;
          p.life -= 0.008;

          p.trail.push({ x: p.x, y: p.y, size: p.size * sizeMult });
          if (p.trail.length > 10) p.trail.shift();

          for (let j = 0; j < p.trail.length; j++) {
            const t = p.trail[j];
            const alpha = (j / p.trail.length) * p.life * 0.4;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.size * (j / p.trail.length), 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 15;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * sizeMult, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          if (dist < 15 || p.life <= 0) {
            // Pulse the core when a particle is absorbed.
            const core = document.querySelector(".core");
            if (core) {
              gsap.fromTo(
                core,
                { scale: 1 },
                {
                  scale: 1.2,
                  duration: 0.15,
                  yoyo: true,
                  repeat: 1,
                  transformOrigin: "center",
                },
              );
            }
            particles.splice(i, 1);
          }
        }

        ctx.globalAlpha = 1;
        rafId = requestAnimationFrame(animate);
      };

      animate();

      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("resize", resize);
      };
    }, []);

    return <canvas ref={canvasRef} id="particle-canvas" />;
  },
);
