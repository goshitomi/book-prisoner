"use client";

import { useEffect, useRef } from "react";
import styles from "./DualCursor.module.css";

// 듀얼 미러링 커서. mirrorX = 2 * splitLineX - mouseX 공식.
// DOM 직접 조작 + RAF로 60fps 보장. React state 금지.
export function DualCursor() {
  const realRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const overInteractive = useRef(false);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    document.documentElement.classList.add("cursorHidden");

    const onMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      const target = e.target as HTMLElement | null;
      overInteractive.current = !!target?.closest(
        "button, a, input, [role='separator'], .allowSystemCursor",
      );
    };

    const onLeave = () => {
      if (realRef.current) realRef.current.style.opacity = "0";
      if (mirrorRef.current) mirrorRef.current.style.opacity = "0";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseleave", onLeave);

    const tick = () => {
      const real = realRef.current;
      const mirror = mirrorRef.current;
      if (!real || !mirror) {
        rafId.current = requestAnimationFrame(tick);
        return;
      }
      const { x, y } = mouse.current;
      if (x < 0) {
        real.style.opacity = "0";
        mirror.style.opacity = "0";
      } else if (overInteractive.current) {
        real.style.opacity = "0";
        mirror.style.opacity = "0";
      } else {
        real.style.opacity = "1";
        mirror.style.opacity = "1";
        const ratio =
          parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--left-ratio"),
          ) || 0.5;
        const splitX = window.innerWidth * ratio;
        const mirrorX = 2 * splitX - x;
        real.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        mirror.style.transform = `translate3d(${mirrorX}px, ${y}px, 0)`;
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);

    return () => {
      document.documentElement.classList.remove("cursorHidden");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseleave", onLeave);
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <>
      <div ref={realRef} className={styles.cursor} aria-hidden="true" />
      <div ref={mirrorRef} className={styles.cursor} aria-hidden="true" />
    </>
  );
}
