"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MIN = 0.15;
const MAX = 0.85;

export function useSplitRatio(initial = 0.5) {
  const [ratio, setRatioState] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const handleRef = useRef<HTMLButtonElement>(null);
  const draggingRef = useRef(false);

  const setRatio = useCallback((next: number | ((r: number) => number)) => {
    setRatioState((prev) => {
      const raw = typeof next === "function" ? next(prev) : next;
      return Math.max(MIN, Math.min(MAX, raw));
    });
  }, []);

  // CSS 변수 동기화
  useEffect(() => {
    document.documentElement.style.setProperty("--left-ratio", String(ratio));
  }, [ratio]);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;

    const onPointerDown = (e: PointerEvent) => {
      draggingRef.current = true;
      setDragging(true);
      handle.setPointerCapture(e.pointerId);
      document.body.style.userSelect = "none";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      setRatio(e.clientX / window.innerWidth);
    };
    const onPointerUp = () => {
      draggingRef.current = false;
      setDragging(false);
      document.body.style.userSelect = "";
    };

    handle.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      handle.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [setRatio]);

  return { ratio, setRatio, dragging, handleRef };
}
