"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { BookPrisonerPair } from "@/lib/types";
import { useHoverSync } from "@/components/HoverSync/HoverSyncContext";
import styles from "./BookPanel.module.css";

export type BookSortKey =
  | "title"
  | "publicationYear"
  | "isbn13"
  | "form"
  | "registrationDate"
  | "callNo";

const COLUMNS: { key: BookSortKey; label: string }[] = [
  { key: "title", label: "표제" },
  { key: "publicationYear", label: "발행일" },
  { key: "isbn13", label: "ISBN" },
  { key: "form", label: "판형" },
  { key: "registrationDate", label: "입고날짜" },
  { key: "callNo", label: "청구기호" },
];

interface Props {
  items: BookPrisonerPair[];
  isFallback: boolean;
  fallbackReason: string | null;
  query?: string | null;
  leading?: ReactNode;
  footer?: ReactNode;
  sortKey: string | null;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
}

export function BookPanel({
  items,
  isFallback,
  fallbackReason,
  query,
  leading,
  footer,
  sortKey,
  sortDir,
  onSort,
}: Props) {
  const router = useRouter();
  const { hoveredKey, setHovered } = useHoverSync();
  return (
    <div className={styles.root}>
      {leading}
      {isFallback && fallbackReason === "empty_result" && (
        <div className={styles.fallbackBadge} role="status">
          {query
            ? `※ “${query}”에 해당하는 도서 없음 — 신착 자료로 대체`
            : "※ 해당 도서 없음 — 신착 자료로 대체"}
        </div>
      )}
      {isFallback && fallbackReason === "api_down" && (
        <div className={styles.fallbackBadge} role="status">
          ※ 자료실 점검 중 — 보관 명단 표시
        </div>
      )}
      {items.length === 0 ? (
        <p className={styles.empty}>표시할 자료가 없습니다.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map(({ key, label }) => {
                const active = sortKey === key;
                return (
                  <th
                    key={key}
                    className={styles.th}
                    onClick={() => onSort(key)}
                    aria-sort={
                      active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
                    }
                  >
                    <span className={styles.thInner}>
                      <span className={styles.thLabel}>{label}</span>
                      <span className={styles.sortMark} aria-hidden="true">
                        {active ? (sortDir === "asc" ? "▲" : "▼") : "▾"}
                      </span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          {items.map(({ book }, idx) => {
            const rowKey = book.isbn13 || book.callNo || `${book.title}-${idx}`;
            const onActivate = () => book.isbn13 && router.push(`/book/${book.isbn13}`);
            const isHovered = hoveredKey === rowKey;
            return (
              <tbody
                key={rowKey}
                className={styles.group}
                data-hovered={isHovered ? "1" : "0"}
                onMouseEnter={() => setHovered(rowKey)}
                onMouseLeave={() => setHovered(null)}
              >
                <tr
                  className={styles.main}
                  onClick={onActivate}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onActivate();
                  }}
                >
                  <td>
                    <div className={styles.title}>{book.title}</div>
                  </td>
                  <td className={styles.num}>{book.publicationYear || "—"}</td>
                  <td className={styles.num}>{book.isbn13 || "—"}</td>
                  <td className={styles.num}>{book.form || "—"}</td>
                  <td className={styles.num}>{book.registrationDate ?? "—"}</td>
                  <td className={styles.num}>{book.callNo ?? "—"}</td>
                </tr>
                <tr className={styles.detail} aria-hidden="true">
                  <td colSpan={6}>
                    <div className={styles.fold}>
                      <div className={styles.foldTop}>
                        <dl>
                          <dt>표제</dt>
                          <dd>{book.title || "—"}</dd>
                          <dt>저자</dt>
                          <dd>{book.authors || "—"}</dd>
                          <dt>출판사</dt>
                          <dd>{book.publisher || "—"}</dd>
                          <dt>발행일</dt>
                          <dd>{book.publicationYear || "—"}</dd>
                          <dt>발행지</dt>
                          <dd>{book.publishPlace || "—"}</dd>
                          <dt>청구기호</dt>
                          <dd>{book.callNo || "—"}</dd>
                        </dl>
                      </div>
                      <div className={styles.foldBottom}>
                        <dl>
                          <dt>ISBN</dt>
                          <dd>{book.isbn13 || "—"}</dd>
                          <dt>판형</dt>
                          <dd>{book.form || "—"}</dd>
                          <dt>페이지</dt>
                          <dd>{book.pages ? `${book.pages} p.` : "—"}</dd>
                          <dt>입고날짜</dt>
                          <dd>{book.registrationDate || "—"}</dd>
                          <dt>언어</dt>
                          <dd>{book.language || "—"}</dd>
                        </dl>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            );
          })}
        </table>
      )}
      {footer}
    </div>
  );
}
