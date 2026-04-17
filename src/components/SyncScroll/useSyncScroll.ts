"use client";

import { RefObject, useEffect, useRef } from "react";

export function useSyncScroll(
  leftRef: RefObject<HTMLElement>,
  rightRef: RefObject<HTMLElement>,
) {
  const isProgrammatic = useRef<"left" | "right" | null>(null);
  const suspended = useRef(false);

  useEffect(() => {
    const L = leftRef.current;
    const R = rightRef.current;
    if (!L || !R) return;

    const syncFrom = (src: "left" | "right") => {
      if (suspended.current) return;
      const from = src === "left" ? L : R;
      const to = src === "left" ? R : L;
      const fromMax = from.scrollHeight - from.clientHeight;
      const toMax = to.scrollHeight - to.clientHeight;
      if (fromMax <= 0 || toMax <= 0) return;
      const pct = from.scrollTop / fromMax;
      const dest: "left" | "right" = src === "left" ? "right" : "left";
      isProgrammatic.current = dest;
      to.scrollTop = pct * toMax;
      requestAnimationFrame(() => {
        if (isProgrammatic.current === dest) isProgrammatic.current = null;
      });
    };

    const onLeft = () => { if (isProgrammatic.current !== "left") syncFrom("left"); };
    const onRight = () => { if (isProgrammatic.current !== "right") syncFrom("right"); };

    L.addEventListener("scroll", onLeft, { passive: true });
    R.addEventListener("scroll", onRight, { passive: true });
    return () => {
      L.removeEventListener("scroll", onLeft);
      R.removeEventListener("scroll", onRight);
    };
  }, [leftRef, rightRef]);

  return {
    suspend: () => { suspended.current = true; },
    resume: () => { suspended.current = false; },
    reset: () => { isProgrammatic.current = null; },
  };
}
