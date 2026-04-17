"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookPanel } from "@/components/BookPanel/BookPanel";
import { PrisonerPanel } from "@/components/PrisonerPanel/PrisonerPanel";
import { Header } from "@/components/Header/Header";
import { SearchBar } from "@/components/SearchBar/SearchBar";
import { SplitScreen, SplitScreenHandle } from "@/components/SplitScreen/SplitScreen";
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
  const splitRef = useRef<SplitScreenHandle>(null);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "s" || e.key === "S") && document.activeElement?.tagName !== "INPUT") {
        toggleSwap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSwap]);

  // 스왑/페이지 전환 시 스크롤 리셋
  useEffect(() => {
    splitRef.current?.resetScroll();
  }, [swapped, data.page]);

  // 탭 타이틀 타이프라이터
  useEffect(() => {
    const FULL = "Book as Prisoner";
    let pos = 0;
    let tid: ReturnType<typeof setTimeout>;
    const step = () => {
      pos++;
      if (pos > FULL.length) {
        pos = 0;
        document.title = FULL;
        tid = setTimeout(step, 1200);
      } else {
        document.title = FULL.slice(0, pos);
        tid = setTimeout(step, 110);
      }
    };
    document.title = FULL;
    tid = setTimeout(step, 1200);
    return () => clearTimeout(tid);
  }, []);

  const showCursor = process.env.NEXT_PUBLIC_ENABLE_DUAL_CURSOR !== "false";

  const bookPanel = (
    <BookPanel
      items={data.items}
      isFallback={data.isFallback}
      fallbackReason={data.fallbackReason}
      query={data.query}
    />
  );
  const prisonerPanel = (
    <PrisonerPanel
      items={data.items}
      isFallback={data.isFallback}
      fallbackReason={data.fallbackReason}
      query={data.query}
    />
  );

  return (
    <>
      <Header swapped={swapped} onToggleSwap={toggleSwap} searchSlot={<SearchBar />} />
      <SplitScreen
        ref={splitRef}
        left={swapped ? prisonerPanel : bookPanel}
        right={swapped ? bookPanel : prisonerPanel}
      />
      <div aria-live="polite" style={{ position: "absolute", left: -9999, top: -9999 }}>
        {data.items.length}건 조회 완료
      </div>
      <Pagination page={data.page} totalPages={data.totalPages} />
      {showCursor && <DualCursor />}
    </>
  );
}
