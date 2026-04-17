"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { BookPanel } from "@/components/BookPanel/BookPanel";
import { PrisonerPanel } from "@/components/PrisonerPanel/PrisonerPanel";
import { Header } from "@/components/Header/Header";
import { SearchBar } from "@/components/SearchBar/SearchBar";
import { SplitScreen } from "@/components/SplitScreen/SplitScreen";
import { Pagination } from "@/components/Pagination/Pagination";
import type { SearchResponse } from "@/lib/types";

const DualCursor = dynamic(
  () => import("@/components/DualCursor/DualCursor").then((m) => m.DualCursor),
  { ssr: false },
);

interface Props {
  data: SearchResponse;
}

const SWAP_STORAGE_KEY = "overdue.swapped";

export function LandingShell({ data }: Props) {
  const [swapped, setSwapped] = useState(false);

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

  // "S" 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "s" || e.key === "S") && document.activeElement?.tagName !== "INPUT") {
        toggleSwap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSwap]);

  const showCursor = process.env.NEXT_PUBLIC_ENABLE_DUAL_CURSOR !== "false";

  return (
    <>
      <Header swapped={swapped} onToggleSwap={toggleSwap} searchSlot={<SearchBar />} />
      <SplitScreen
        swapped={swapped}
        left={
          <BookPanel
            items={data.items}
            isFallback={data.isFallback}
            fallbackReason={data.fallbackReason}
          />
        }
        right={
          <PrisonerPanel
            items={data.items}
            isFallback={data.isFallback}
            fallbackReason={data.fallbackReason}
          />
        }
      />
      <div aria-live="polite" style={{ position: "absolute", left: -9999, top: -9999 }}>
        {data.items.length}건 조회 완료
      </div>
      <Pagination page={data.page} totalPages={data.totalPages} />
      {showCursor && <DualCursor />}
    </>
  );
}
