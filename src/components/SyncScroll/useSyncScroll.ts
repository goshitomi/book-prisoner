"use client";

import { RefObject, useEffect, useRef } from "react";

// 퍼센트 기반 + 마지막 소스 추적 방식. 핑퐁 방지.
export function useSyncScroll(
  leftRef: RefObject<HTMLElement>,
  rightRef: RefObject<HTMLElement>,
) {
  const lastSource = useRef<"left" | "right" | null>(null);
  const suspended = useRef(false);

  useEffect(() => {
    const L = leftRef.current;
    const R = rightRef.current;
    if (!L || !R) return;

    const syncFrom = (src: "left" | "right") => {
      if (suspended.current) return;
      if (lastSource.current && lastSource.current !== src) return;
      lastSource.current = src;
      const from = src === "left" ? L : R;
      const to = src === "left" ? R : L;
      const fromMax = from.scrollHeight - from.clientHeight;
      const toMax = to.scrollHeight - to.clientHeight;
      if (fromMax <= 0 || toMax <= 0) {
        lastSource.current = null;
        return;
      }
      const pct = from.scrollTop / fromMax;
      to.scrollTop = pct * toMax;
      requestAnimationFrame(() => {
        lastSource.current = null;
      });
    };

    const onLeft = () => syncFrom("left");
    const onRight = () => syncFrom("right");
    L.addEventListener("scroll", onLeft, { passive: true });
    R.addEventListener("scroll", onRight, { passive: true });
    return () => {
      L.removeEventListener("scroll", onLeft);
      R.removeEventListener("scroll", onRight);
    };
  }, [leftRef, rightRef]);

  return {
    suspend: () => {
      suspended.current = true;
    },
    resume: () => {
      suspended.current = false;
    },
    reset: () => {
      lastSource.current = null;
    },
  };
}
