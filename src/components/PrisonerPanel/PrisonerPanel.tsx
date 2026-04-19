"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { BookPrisonerPair } from "@/lib/types";
import { useHoverSync } from "@/components/HoverSync/HoverSyncContext";
import styles from "./PrisonerPanel.module.css";

export type PrisonerSortKey =
  | "name"
  | "birthYear"
  | "residentId"
  | "height"
  | "incarcerationDate"
  | "inmateNumber";

const COLUMNS: { key: PrisonerSortKey; label: string }[] = [
  { key: "name", label: "수감자" },
  { key: "birthYear", label: "출생년도" },
  { key: "residentId", label: "ID Number" },
  { key: "height", label: "키/몸무게" },
  { key: "incarcerationDate", label: "수감일자" },
  { key: "inmateNumber", label: "수인번호" },
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

export function PrisonerPanel({
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
            ? `※ “${query}” 수감자 없음 — 유사 프로필 조회`
            : "※ 수감자 명부에 해당 인물 없음 — 유사 프로필 조회"}
        </div>
      )}
      {isFallback && fallbackReason === "api_down" && (
        <div className={styles.fallbackBadge} role="status">
          ※ 감독관 부재 — 보관 명단 표시
        </div>
      )}
      {items.length === 0 ? (
        <p className={styles.empty}>수감된 인물이 없습니다.</p>
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
          {items.map(({ book, prisoner }, idx) => {
            const rowKey = book.isbn13 || book.callNo || `${book.title}-${idx}`;
            const canOpen = Boolean(book.isbn13);
            const onActivate = () => {
              if (canOpen) router.push(`/book/${book.isbn13}`);
            };
            const isHovered = hoveredKey === rowKey;
            return (
              <tbody
                key={rowKey}
                className={styles.group}
                data-hovered={isHovered ? "1" : "0"}
                onMouseEnter={() => setHovered(rowKey)}
                onMouseLeave={() =>
                  setHovered((cur) => (cur === rowKey ? null : cur))
                }
              >
                <tr
                  className={styles.main}
                  onClick={canOpen ? onActivate : undefined}
                  tabIndex={canOpen ? 0 : -1}
                  role={canOpen ? "button" : undefined}
                  aria-disabled={!canOpen || undefined}
                  style={{ cursor: canOpen ? "pointer" : "default" }}
                  onKeyDown={(e) => {
                    if (!canOpen) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onActivate();
                    }
                  }}
                >
                  <td data-label="수감자">
                    <div className={styles.name}>{prisoner.name}</div>
                  </td>
                  <td className={styles.num} data-label="출생년도">{prisoner.birthYear || "—"}</td>
                  <td className={styles.num} data-label="ID Number">{prisoner.residentId || "—"}</td>
                  <td className={styles.num} data-label="키/몸무게">{prisoner.height || "—"}</td>
                  <td className={styles.num} data-label="수감일자">{prisoner.incarcerationDate ?? "—"}</td>
                  <td className={styles.num} data-label="수인번호">{prisoner.inmateNumber || "—"}</td>
                </tr>
                <tr className={styles.detail} aria-hidden="true">
                  <td colSpan={6}>
                    <div className={styles.fold}>
                      <div className={styles.foldTop}>
                        <dl>
                          <dt>수감자</dt>
                          <dd>{prisoner.name || "—"}</dd>
                          <dt>공범</dt>
                          <dd>{prisoner.coConspirators || "—"}</dd>
                          <dt>출생기관</dt>
                          <dd>{prisoner.birthInstitution || "—"}</dd>
                          <dt>출생년도</dt>
                          <dd>{prisoner.birthYear || "—"}</dd>
                          <dt>국적</dt>
                          <dd>{prisoner.nationality || "—"}</dd>
                          <dt>수인번호</dt>
                          <dd>{prisoner.inmateNumber || "—"}</dd>
                        </dl>
                      </div>
                      <div className={styles.foldBottom}>
                        <dl>
                          <dt>ID Number</dt>
                          <dd>{prisoner.residentId || "—"}</dd>
                          <dt>키/몸무게</dt>
                          <dd>{prisoner.height || "—"}</dd>
                          <dt>형량</dt>
                          <dd>{prisoner.sentence || "—"}</dd>
                          <dt>수감일자</dt>
                          <dd>{prisoner.incarcerationDate || "—"}</dd>
                          <dt>구사 언어</dt>
                          <dd>{prisoner.spokenLanguage || "—"}</dd>
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
