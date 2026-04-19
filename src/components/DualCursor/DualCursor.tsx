"use client";

import { useEffect, useRef } from "react";
import styles from "./DualCursor.module.css";

// 상대 좌표 매핑 방식. 마우스가 속한 패널 내 상대 위치(%)를 반대 패널에 투영.
// 스크롤 오프셋 보정: y_ghost = mouseY + (other.scrollTop - active.scrollTop).
// 고스트 커서 모양은 실제 마우스 위치가 아닌 "고스트 위치"의 요소를 기준으로 결정.
export function DualCursor() {
  const ghostRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const pressed = useRef(false);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const isTextNode = (el: Element | null): boolean => {
      if (!el) return false;
      return !!el.closest("td, th, p, dd, dt, span, h1, h2, h3, h4, li, blockquote, label, figcaption");
    };
    const isInteractive = (el: Element | null): boolean => {
      if (!el) return false;
      return !!el.closest("button, a, input, [role='separator']");
    };

    const onMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };
    const onLeave = () => { mouse.current.x = -9999; };
    const onDown = () => { pressed.current = true; };
    const onUp = () => { pressed.current = false; };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseleave", onLeave);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    const tick = () => {
      const ghost = ghostRef.current;
      if (!ghost) { rafId.current = requestAnimationFrame(tick); return; }

      const { x, y } = mouse.current;
      if (x < 0) {
        ghost.style.opacity = "0";
        rafId.current = requestAnimationFrame(tick);
        return;
      }

      const ratio =
        parseFloat(document.documentElement.style.getPropertyValue("--left-ratio")) ||
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--left-ratio")) ||
        0.5;
      const W_left = window.innerWidth * ratio;
      const W_right = window.innerWidth - W_left;
      const inLeft = x < W_left;

      const leftPanel = document.querySelector('[data-panel="left"]') as HTMLElement | null;
      const rightPanel = document.querySelector('[data-panel="right"]') as HTMLElement | null;
      const scrollActive = (inLeft ? leftPanel : rightPanel)?.scrollTop ?? 0;
      const scrollOther = (inLeft ? rightPanel : leftPanel)?.scrollTop ?? 0;
      const yGhost = y + (scrollOther - scrollActive);

      const xGhost = inLeft
        ? W_left + (x / W_left) * W_right
        : ((x - W_left) / W_right) * W_left;

      const targetEl = document.elementFromPoint(xGhost, yGhost);
      const ghostInteractive = isInteractive(targetEl);
      const ghostText = !ghostInteractive && isTextNode(targetEl);

      if (ghostInteractive) {
        ghost.style.opacity = "0";
        rafId.current = requestAnimationFrame(tick);
        return;
      }

      ghost.style.opacity = "1";
      ghost.style.transform = `translate3d(${xGhost}px, ${yGhost}px, 0)`;
      ghost.dataset.pressed = pressed.current ? "1" : "0";
      ghost.dataset.text = ghostText ? "1" : "0";
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return <div ref={ghostRef} className={styles.ghost} aria-hidden="true" data-pressed="0" data-text="0" />;
}
