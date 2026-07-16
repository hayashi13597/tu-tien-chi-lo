"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import { RING_CHARS } from "@/lib/realm-constants";

gsap.registerPlugin(useGSAP);

export function DantianFormation() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const dantianRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const ring1Ref = useRef<HTMLDivElement>(null);
  const ring2Ref = useRef<HTMLDivElement>(null);
  const ring3Ref = useRef<HTMLDivElement>(null);
  const ring4Ref = useRef<HTMLDivElement>(null);

  // Place each ring's Hanzi evenly around its circle (once, on mount).
  useEffect(() => {
    const placeHanzi = (
      ringEl: HTMLDivElement,
      chars: string[],
      radius: number,
      fontSize: number,
      color: string,
    ) => {
      const count = chars.length;
      for (let i = 0; i < count; i++) {
        // Distribute around the circle, starting at the top (-90deg).
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const span = document.createElement("span");
        span.className = "hanzi";
        span.textContent = chars[i];
        span.style.fontSize = `${fontSize}rem`;
        span.style.color = color;
        span.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        ringEl.appendChild(span);
      }
    };

    if (ring1Ref.current)
      placeHanzi(ring1Ref.current, RING_CHARS[1], 70, 1.8, "#fbbf24");
    if (ring2Ref.current)
      placeHanzi(ring2Ref.current, RING_CHARS[2], 120, 1.5, "#5dd9b1");
    if (ring3Ref.current)
      placeHanzi(ring3Ref.current, RING_CHARS[3], 170, 1.3, "#a855f7");
    if (ring4Ref.current)
      placeHanzi(ring4Ref.current, RING_CHARS[4], 220, 1.1, "#d4af37");
  }, []);

  // Continuous ring rotations (different axes/speeds create a 3D orbit),
  // core pulse, and floating-symbol drift. Scoped + auto-cleaned by useGSAP.
  useGSAP(
    () => {
      // Respect the user's reduced-motion preference: skip the perpetual
      // orbit/pulse/drift loops entirely (the formation still renders, static).
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }
      gsap.to(ring1Ref.current, {
        rotateY: 360,
        duration: 8,
        repeat: -1,
        ease: "none",
        transformOrigin: "center center",
      });
      gsap.to(ring2Ref.current, {
        rotateY: -360,
        rotateX: 360,
        duration: 14,
        repeat: -1,
        ease: "none",
        transformOrigin: "center center",
      });
      gsap.to(ring3Ref.current, {
        rotateY: 360,
        rotateX: -360,
        rotateZ: 360,
        duration: 22,
        repeat: -1,
        ease: "none",
        transformOrigin: "center center",
      });
      gsap.to(ring4Ref.current, {
        rotateY: -360,
        rotateZ: -360,
        duration: 30,
        repeat: -1,
        ease: "none",
        transformOrigin: "center center",
      });
      gsap.to(".core-orb", {
        scale: 1.2,
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        transformOrigin: "center",
      });
      gsap.utils.toArray<HTMLElement>(".floating-symbol").forEach((sym, i) => {
        gsap.to(sym, {
          y: -25,
          duration: 3 + i * 0.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
        gsap.to(sym, {
          opacity: 0.7,
          duration: 4 + i * 0.3,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
    },
    { scope: sceneRef },
  );

  // Mouse parallax: the whole scene eases toward a tilt tracking the cursor.
  useEffect(() => {
    // Skip the continuous rAF parallax loop under reduced-motion.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    let targetRotY = 0;
    let targetRotX = 0;
    let rafId: number;

    const onMouseMove = (e: MouseEvent) => {
      targetRotY = (e.clientX / window.innerWidth - 0.5) * 12;
      targetRotX = -(e.clientY / window.innerHeight - 0.5) * 8;
    };

    const smoothRotate = () => {
      const scene = sceneRef.current;
      if (scene) {
        // Lerp toward the target by 5% each frame for a smooth follow.
        const currentY = gsap.getProperty(scene, "rotationY") as number;
        const currentX = gsap.getProperty(scene, "rotationX") as number;
        const newY = currentY + (targetRotY - currentY) * 0.05;
        const newX = currentX + (targetRotX - currentX) * 0.05;
        gsap.set(scene, { rotationY: newY, rotationX: newX });
      }
      rafId = requestAnimationFrame(smoothRotate);
    };

    document.addEventListener("mousemove", onMouseMove);
    smoothRotate();

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="scene-3d" ref={sceneRef}>
      <div
        className="floating-symbol"
        style={{ top: "10%", left: "10%", fontSize: "1.5rem" }}
      >
        道
      </div>
      <div
        className="floating-symbol"
        style={{ top: "15%", right: "12%", fontSize: "1.2rem" }}
      >
        仙
      </div>
      <div
        className="floating-symbol"
        style={{ bottom: "20%", left: "15%", fontSize: "1.3rem" }}
      >
        气
      </div>
      <div
        className="floating-symbol"
        style={{ bottom: "25%", right: "10%", fontSize: "1.4rem" }}
      >
        元
      </div>

      <div className="dantian" ref={dantianRef}>
        <div className="aura-glow" />

        <div className="ring ring-4" ref={ring4Ref}>
          <div className="ring-outline" />
        </div>
        <div className="ring ring-3" ref={ring3Ref}>
          <div className="ring-outline" />
        </div>
        <div className="ring ring-2" ref={ring2Ref}>
          <div className="ring-outline" />
        </div>
        <div className="ring ring-1" ref={ring1Ref}>
          <div className="ring-outline" />
        </div>

        <div className="core" ref={coreRef}>
          <div className="core-orb" />
        </div>
      </div>
    </div>
  );
}
