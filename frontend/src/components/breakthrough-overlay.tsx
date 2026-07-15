"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

export type BreakthroughPhase = "idle" | "tribulating" | "success" | "failure";

interface BreakthroughOverlayProps {
  phase: BreakthroughPhase;
  /** Color for the success particle burst / core recolor (from realm meta). */
  successColor: string;
  onComplete: () => void;
}

const TRIBULATION_DURATION = 3500; // ms — matches the parent's toast/timing

export function BreakthroughOverlay({
  phase,
  successColor,
  onComplete,
}: BreakthroughOverlayProps) {
  const tribCanvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef(0);
  const onCompleteRef = useRef(onComplete);

  // Keep the latest onComplete without re-triggering the animation effect.
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Tribulation: dark clouds + branching lightning on a full-screen canvas,
  // screen shake, and a dimmed background. Runs while phase === "tribulating".
  useEffect(() => {
    if (phase !== "tribulating") return;
    const canvas = tribCanvasRef.current;
    const flash = flashRef.current;
    if (!canvas || !flash) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    startTimeRef.current = Date.now();

    gsap.to(canvas, { opacity: 1, duration: 0.5 });
    gsap.to(".cosmic-bg", {
      filter: "brightness(0.3) hue-rotate(280deg)",
      duration: 1,
    });

    const clouds: { x: number; y: number; r: number; vx: number; a: number }[] =
      [];
    for (let i = 0; i < 35; i++) {
      clouds.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * 280 - 120,
        r: Math.random() * 90 + 70,
        vx: (Math.random() - 0.5) * 1.2,
        a: Math.random() * 0.35 + 0.25,
      });
    }

    const bolts: {
      points: { x: number; y: number }[];
      branches: { x: number; y: number }[][];
      life: number;
      width: number;
    }[] = [];
    let lastBolt = 0;
    let rafId: number;

    const draw = () => {
      const elapsed = Date.now() - startTimeRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const c of clouds) {
        c.x += c.vx;
        if (c.x < -c.r) c.x = canvas.width + c.r;
        if (c.x > canvas.width + c.r) c.x = -c.r;
        const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        grad.addColorStop(0, `rgba(100, 40, 150, ${c.a})`);
        grad.addColorStop(0.5, `rgba(50, 20, 80, ${c.a * 0.7})`);
        grad.addColorStop(1, "rgba(20, 5, 30, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Spawn a jagged bolt (with random branches) every ~0.5-0.85s.
      if (elapsed - lastBolt > 500 + Math.random() * 350) {
        lastBolt = elapsed;
        const targetX = window.innerWidth / 2 + (Math.random() - 0.5) * 250;
        const targetY = window.innerHeight / 2 + 50;
        const startX = targetX + (Math.random() - 0.5) * 150;
        const points = [{ x: startX, y: 30 }];
        let cx = startX;
        let cy = 30;
        while (cy < targetY) {
          cy += 18 + Math.random() * 28;
          cx += (Math.random() - 0.5) * 55;
          points.push({ x: cx, y: cy });
        }
        const branches: { x: number; y: number }[][] = [];
        for (let i = 1; i < points.length - 1; i++) {
          if (Math.random() > 0.55) {
            const branch = [points[i]];
            let bx = points[i].x;
            let by = points[i].y;
            const len = 3 + Math.floor(Math.random() * 5);
            for (let j = 0; j < len; j++) {
              bx += (Math.random() - 0.5) * 70;
              by += 15 + Math.random() * 25;
              branch.push({ x: bx, y: by });
            }
            branches.push(branch);
          }
        }
        bolts.push({
          points,
          life: 1,
          branches,
          width: Math.random() * 1.5 + 2,
        });

        gsap.to(".app-main", {
          x: (Math.random() - 0.5) * 18,
          y: (Math.random() - 0.5) * 18,
          duration: 0.05,
          yoyo: true,
          repeat: 5,
          onComplete: () => gsap.to(".app-main", { x: 0, y: 0, duration: 0.1 }),
        });
        gsap.fromTo(flash, { opacity: 0.5 }, { opacity: 0, duration: 0.35 });
      }

      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        b.life -= 0.045;
        if (b.life <= 0) {
          bolts.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(200, 150, 255, ${b.life})`;
        ctx.lineWidth = b.width;
        ctx.shadowBlur = 35;
        ctx.shadowColor = "#a855f7";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(b.points[0].x, b.points[0].y);
        for (let j = 1; j < b.points.length; j++) {
          ctx.lineTo(b.points[j].x, b.points[j].y);
        }
        ctx.stroke();
        ctx.strokeStyle = `rgba(255, 255, 255, ${b.life})`;
        ctx.lineWidth = b.width * 0.5;
        ctx.stroke();
        ctx.lineWidth = b.width * 0.7;
        ctx.strokeStyle = `rgba(180, 130, 240, ${b.life * 0.7})`;
        for (const branch of b.branches) {
          ctx.beginPath();
          ctx.moveTo(branch[0].x, branch[0].y);
          for (let j = 1; j < branch.length; j++) {
            ctx.lineTo(branch[j].x, branch[j].y);
          }
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }

      if (elapsed < TRIBULATION_DURATION) {
        rafId = requestAnimationFrame(draw);
      } else {
        gsap.to(canvas, { opacity: 0, duration: 1 });
        gsap.to(".cosmic-bg", {
          filter: "brightness(1) hue-rotate(0deg)",
          duration: 1,
        });
        // Hand control back to the parent to resolve success/failure.
        onCompleteRef.current();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [phase]);

  // Success: white flash fade + dantian spin/scale + realm-name swap + recolor.
  useEffect(() => {
    if (phase !== "success") return;
    const flash = flashRef.current;
    if (flash) {
      gsap.fromTo(
        flash,
        { opacity: 1 },
        { opacity: 0, duration: 1.8, ease: "power2.out" },
      );
    }
    const dantian = document.querySelector(".dantian");
    if (dantian) {
      const tl = gsap.timeline();
      tl.to(dantian, {
        scale: 1.3,
        rotateY: 720,
        duration: 1.2,
        ease: "power2.out",
        transformOrigin: "center center",
      }).to(dantian, {
        scale: 1,
        rotateY: 0,
        duration: 0.9,
        ease: "elastic.out(1, 0.5)",
      });
    }
    const realmName = document.querySelector(".realm-name");
    if (realmName) {
      gsap.to(realmName, {
        opacity: 0,
        y: -20,
        scale: 1.2,
        duration: 0.3,
        onComplete: () => {
          gsap.fromTo(
            realmName,
            { opacity: 0, y: 30, scale: 0.7 },
            { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: "back.out(2)" },
          );
        },
      });
    }
    gsap.to(".core-orb", {
      boxShadow: `0 0 40px ${successColor}, 0 0 80px ${successColor}, inset -8px -8px 20px rgba(0,0,0,0.4)`,
      duration: 1,
    });
  }, [phase, successColor]);

  // Failure: sharp horizontal shake of the dantian.
  useEffect(() => {
    if (phase !== "failure") return;
    const dantian = document.querySelector(".dantian");
    if (dantian) {
      gsap.fromTo(
        dantian,
        { x: 0 },
        {
          x: (Math.random() - 0.5) * 30,
          duration: 0.08,
          yoyo: true,
          repeat: 10,
          onComplete: () => gsap.set(dantian, { x: 0 }),
        },
      );
    }
  }, [phase]);

  return (
    <>
      <canvas ref={tribCanvasRef} id="tribulation-canvas" />
      <div ref={flashRef} className="breakthrough-flash" />
    </>
  );
}
