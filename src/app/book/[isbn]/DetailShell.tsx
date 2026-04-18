"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
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

export function DetailShell({ pair }: { pair: BookPrisonerPair }) {
  const [swapped, setSwapped] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [imageHover, setImageHover] = useState<null | "book" | "prisoner">(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SWAP_STORAGE_KEY);
      if (saved === "1") setSwapped(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSwap = useCallback(() => {
    setSwapped((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SWAP_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const onRequest = () => setOverlayOpen(true);
  const onClose = () => setOverlayOpen(false);

  const showCursor = process.env.NEXT_PUBLIC_ENABLE_DUAL_CURSOR !== "false";

  const bookSide = (
    <DetailBookSide
      pair={pair}
      imageHover={imageHover}
      onImageEnter={() => setImageHover("book")}
      onImageLeave={() => setImageHover(null)}
      onRequest={onRequest}
    />
  );
  const prisonerSide = (
    <DetailPrisonerSide
      pair={pair}
      imageHover={imageHover}
      onImageEnter={() => setImageHover("prisoner")}
      onImageLeave={() => setImageHover(null)}
      onRequest={onRequest}
    />
  );

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
