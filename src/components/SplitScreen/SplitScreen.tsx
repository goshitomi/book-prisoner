"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { ReactNode } from "react";
import styles from "./SplitScreen.module.css";
import { useSplitRatio } from "./useSplitRatio";
import { useSyncScroll } from "@/components/SyncScroll/useSyncScroll";

interface Props {
  left: ReactNode;
  right: ReactNode;
  swapped: boolean;
  leftLabel?: string;
  rightLabel?: string;
}

export interface SplitScreenHandle {
  resetScroll: () => void;
  suspendSync: () => void;
  resumeSync: () => void;
}

export const SplitScreen = forwardRef<SplitScreenHandle, Props>(function SplitScreen(
  { left, right, swapped, leftLabel = "도서 명부", rightLabel = "수감자 명부" },
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

  // 스왑 직후 스크롤 리셋
  useEffect(() => {
    if (leftRef.current) leftRef.current.scrollTop = 0;
    if (rightRef.current) rightRef.current.scrollTop = 0;
    sync.reset();
    // sync 메서드는 항상 동일 참조
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapped]);

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

  const bookPanel = (
    <section
      ref={leftRef as React.RefObject<HTMLElement>}
      className={`${styles.panel} ${styles.panelBook}`}
      aria-label={leftLabel}
      data-panel="book"
    >
      {left}
    </section>
  );
  const prisonerPanel = (
    <section
      ref={rightRef as React.RefObject<HTMLElement>}
      className={`${styles.panel} ${styles.panelPrisoner}`}
      aria-label={rightLabel}
      data-panel="prisoner"
    >
      {right}
    </section>
  );

  return (
    <div className={`${styles.root} ${swapped ? styles.swapped : ""}`}>
      {swapped ? prisonerPanel : bookPanel}
      {swapped ? bookPanel : prisonerPanel}
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
