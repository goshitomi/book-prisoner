"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { SplitScreen } from "@/components/SplitScreen/SplitScreen";
import { ReverseButton } from "@/components/ReverseButton/ReverseButton";
import { LoanCompleteOverlay } from "@/components/LoanCompleteOverlay/LoanCompleteOverlay";
import { DetailBookSide } from "./DetailBookSide";
import { DetailPrisonerSide } from "./DetailPrisonerSide";
import type { BookPrisonerPair } from "@/lib/types";
import styles from "./Detail.module.css";

const DualCursor = dynamic(
  () => import("@/components/DualCursor/DualCursor").then((m) => m.DualCursor),
  { ssr: false },
);

const SWAP_STORAGE_KEY = "overdue.swapped";

function readInitialSwapped(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-swapped") === "1";
}

export function DetailShell({ pair }: { pair: BookPrisonerPair }) {
  const [swapped, setSwapped] = useState<boolean>(readInitialSwapped);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const toggleSwap = useCallback(() => {
    setSwapped((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SWAP_STORAGE_KEY, next ? "1" : "0");
        if (next) document.documentElement.setAttribute("data-swapped", "1");
        else document.documentElement.removeAttribute("data-swapped");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const onRequest = () => setOverlayOpen(true);
  const onClose = () => setOverlayOpen(false);

  const showCursor = process.env.NEXT_PUBLIC_ENABLE_DUAL_CURSOR === "true";

  const bookSide = <DetailBookSide pair={pair} onRequest={onRequest} />;
  const prisonerSide = <DetailPrisonerSide pair={pair} onRequest={onRequest} />;

  return (
    <>
      <SplitScreen
        leftLabel="도서 상세 정보"
        rightLabel="수감자 상세 정보"
        left={swapped ? prisonerSide : bookSide}
        right={swapped ? bookSide : prisonerSide}
      />
      <div className={styles.reverseFloat}>
        <ReverseButton swapped={swapped} onToggle={toggleSwap} />
      </div>
      {overlayOpen && (
        <LoanCompleteOverlay pair={pair} swapped={swapped} onClose={onClose} />
      )}
      {showCursor && !overlayOpen && <DualCursor />}
    </>
  );
}
