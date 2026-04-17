"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import type { ReactNode } from "react";
import styles from "./SplitScreen.module.css";
import { useSplitRatio } from "./useSplitRatio";
import { useSyncScroll } from "@/components/SyncScroll/useSyncScroll";

interface Props {
  left: ReactNode;
  right: ReactNode;
  leftLabel?: string;
  rightLabel?: string;
}

export interface SplitScreenHandle {
  resetScroll: () => void;
  suspendSync: () => void;
  resumeSync: () => void;
}

export const SplitScreen = forwardRef<SplitScreenHandle, Props>(function SplitScreen(
  { left, right, leftLabel = "도서 명부", rightLabel = "수감자 명부" },
  ref,
) {
  const { ratio, setRatio, dragging, handleRef } = useSplitRatio();
  const leftRef = useRef<HTMLElement>(null);
  const rightRef = useRef<HTMLElement>(null);
  const sync = useSyncScroll(leftRef, rightRef);

  useImperativeHandle(ref, () => ({
    resetScroll: () => {
      if (leftRef.current) leftRef.current.scrollTop = 0;
      if (rightRef.current) rightRef.current.scrollTop = 0;
      sync.reset();
    },
    suspendSync: sync.suspend,
    resumeSync: sync.resume,
  }));

  const onHandleKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 0.1 : 0.05;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setRatio((r) => r - step);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setRatio((r) => r + step);
    }
  };

  return (
    <div className={styles.root}>
      <section
        ref={leftRef as React.RefObject<HTMLElement>}
        className={styles.panel}
        aria-label={leftLabel}
        data-panel="left"
      >
        {left}
      </section>
      <section
        ref={rightRef as React.RefObject<HTMLElement>}
        className={styles.panel}
        aria-label={rightLabel}
        data-panel="right"
      >
        {right}
      </section>
      <div className={styles.splitLine} aria-hidden="true" />
      <button
        type="button"
        ref={handleRef}
        className={`${styles.handle} ${dragging ? styles.dragging : ""} allowSystemCursor`}
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={15}
        aria-valuemax={85}
        aria-label="분할 비율 조정"
        onKeyDown={onHandleKey}
      />
    </div>
  );
});
