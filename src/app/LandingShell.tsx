"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookPanel } from "@/components/BookPanel/BookPanel";
import { PrisonerPanel } from "@/components/PrisonerPanel/PrisonerPanel";
import { SearchBar } from "@/components/SearchBar/SearchBar";
import { HoverSyncProvider } from "@/components/HoverSync/HoverSyncContext";
import { SplitScreen, SplitScreenHandle } from "@/components/SplitScreen/SplitScreen";
import { Pagination } from "@/components/Pagination/Pagination";
import { ReverseButton } from "@/components/ReverseButton/ReverseButton";
import bookStyles from "@/components/BookPanel/BookPanel.module.css";
import prisonerStyles from "@/components/PrisonerPanel/PrisonerPanel.module.css";
import type { BookPrisonerPair, SearchResponse } from "@/lib/types";

interface Props {
  data: SearchResponse;
}

const SWAP_STORAGE_KEY = "overdue.swapped";

type SortDir = "asc" | "desc";

const NUMERIC_KEYS = new Set([
  "publicationYear",
  "birthYear",
  "pages",
]);

function getField(pair: BookPrisonerPair, key: string): string | null {
  const b = pair.book as unknown as Record<string, unknown>;
  const p = pair.prisoner as unknown as Record<string, unknown>;
  const v = (b[key] ?? p[key]) as string | number | null | undefined;
  if (v == null) return null;
  return String(v);
}

function sortPairs(
  pairs: BookPrisonerPair[],
  key: string | null,
  dir: SortDir,
): BookPrisonerPair[] {
  if (!key) return pairs;
  const isNumeric = NUMERIC_KEYS.has(key);
  const mult = dir === "asc" ? 1 : -1;
  const decorated = pairs.map((p, i) => ({ p, i, v: getField(p, key) }));
  decorated.sort((a, b) => {
    const av = a.v;
    const bv = b.v;
    if (av == null && bv == null) return a.i - b.i;
    if (av == null) return 1;
    if (bv == null) return -1;
    let cmp: number;
    if (isNumeric) {
      const an = Number(av.replace(/[^0-9.-]/g, "")) || 0;
      const bn = Number(bv.replace(/[^0-9.-]/g, "")) || 0;
      cmp = an - bn;
    } else {
      cmp = av.localeCompare(bv, "ko");
    }
    return cmp !== 0 ? cmp * mult : a.i - b.i;
  });
  return decorated.map((d) => d.p);
}

function readInitialSwapped(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-swapped") === "1";
}

export function LandingShell({ data }: Props) {
  const [swapped, setSwapped] = useState<boolean>(readInitialSwapped);
  const splitRef = useRef<SplitScreenHandle>(null);
  const router = useRouter();
  const params = useSearchParams();
  const [searchValue, setSearchValue] = useState(params.get("q") ?? "");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    setSearchValue(params.get("q") ?? "");
  }, [params]);

  const submitSearch = useCallback(() => {
    const q = searchValue.trim();
    if (q) router.push(`/?q=${encodeURIComponent(q)}`);
    else router.push("/");
  }, [router, searchValue]);

  // 홈에 진입할 때마다 draw-in 인트로 애니메이션을 재실행.
  useEffect(() => {
    try {
      sessionStorage.removeItem("intro-played");
      document.documentElement.removeAttribute("data-intro-played");
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem("intro-played", "1");
        document.documentElement.setAttribute("data-intro-played", "1");
      } catch {
        /* ignore */
      }
    }, 1200);
    return () => clearTimeout(t);
  }, []);

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

  useEffect(() => {
    splitRef.current?.resetScroll();
  }, [data.page]);

  useEffect(() => {
    const FULL = "Book as Prisoner";
    const OVERDUE = "(⚠) Book as Prisoner — overdue";
    let tid: ReturnType<typeof setTimeout> | null = null;
    let toggled = false;

    const stop = () => {
      if (tid) clearTimeout(tid);
      tid = null;
      document.title = FULL;
    };

    const cycle = () => {
      if (document.visibilityState === "visible") {
        stop();
        return;
      }
      toggled = !toggled;
      document.title = toggled ? OVERDUE : FULL;
      tid = setTimeout(cycle, 3000);
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        if (!tid) {
          toggled = false;
          tid = setTimeout(cycle, 3000);
        }
      } else {
        stop();
      }
    };

    document.title = FULL;
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, []);

  const onSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const sortedItems = useMemo(
    () => sortPairs(data.items, sortKey, sortDir),
    [data.items, sortKey, sortDir],
  );

  const leftPagination = <Pagination page={data.page} totalPages={data.totalPages} />;
  const rightPagination = (
    <Pagination
      page={data.page}
      totalPages={data.totalPages}
      trailing={<ReverseButton swapped={swapped} onToggle={toggleSwap} />}
    />
  );

  const bookLeading = (
    <div className={bookStyles.leading}>
      <h1 className={bookStyles.titleBlock}>
        <Link href="/" className={bookStyles.titleLink} aria-label="홈으로">
          List of Books
        </Link>
      </h1>
      <SearchBar
        value={searchValue}
        onChange={setSearchValue}
        onSubmit={submitSearch}
        placeholder="Search a book"
        ariaLabel="도서 검색"
        examples={[
          "Search a book",
          "표제, 저자...",
          "ISBN",
          "청구기호",
          "판형",
        ]}
      />
    </div>
  );
  const prisonerLeading = (
    <div className={prisonerStyles.leading}>
      <h1 className={prisonerStyles.titleBlock}>
        <Link href="/" className={prisonerStyles.titleLink} aria-label="홈으로">
          List of Prisoners
        </Link>
      </h1>
      <SearchBar
        value={searchValue}
        onChange={setSearchValue}
        onSubmit={submitSearch}
        placeholder="Search an inmate"
        ariaLabel="수감자 검색"
        examples={[
          "Search an inmate",
          "이름, 공범...",
          "ID Number",
          "수인번호",
          "키/몸무게",
        ]}
      />
    </div>
  );

  const bookPanel = (
    <BookPanel
      items={sortedItems}
      isFallback={data.isFallback}
      fallbackReason={data.fallbackReason}
      query={data.query}
      leading={bookLeading}
      footer={swapped ? rightPagination : leftPagination}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={onSort}
    />
  );
  const prisonerPanel = (
    <PrisonerPanel
      items={sortedItems}
      isFallback={data.isFallback}
      fallbackReason={data.fallbackReason}
      query={data.query}
      leading={prisonerLeading}
      footer={swapped ? leftPagination : rightPagination}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={onSort}
    />
  );

  return (
    <HoverSyncProvider>
      <SplitScreen
        ref={splitRef}
        left={swapped ? prisonerPanel : bookPanel}
        right={swapped ? bookPanel : prisonerPanel}
      />
      <div aria-live="polite" style={{ position: "absolute", left: -9999, top: -9999 }}>
        {data.items.length}건 조회 완료
      </div>
    </HoverSyncProvider>
  );
}
