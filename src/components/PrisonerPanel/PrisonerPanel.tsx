"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BookPrisonerPair } from "@/lib/types";
import { useHoverSync } from "@/components/HoverSync/HoverSyncContext";
import styles from "./PrisonerPanel.module.css";

interface Props {
  items: BookPrisonerPair[];
  isFallback: boolean;
  fallbackReason: string | null;
  query?: string | null;
  footer?: ReactNode;
}

export function PrisonerPanel({ items, isFallback, fallbackReason, query, footer }: Props) {
  const router = useRouter();
  const { hoveredKey, setHovered } = useHoverSync();
  return (
    <div className={styles.root}>
      <h2 id="prisoner-heading" className={styles.heading}>
        <Link href="/" className={styles.headingLink} aria-label="홈으로">
          List of Prisoners
        </Link>
      </h2>
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
              <th>수감자</th>
              <th>출생년도</th>
              <th>ID Number</th>
              <th>키/몸무게</th>
              <th>수감일자</th>
              <th>수인번호</th>
            </tr>
          </thead>
          {items.map(({ book, prisoner }, idx) => {
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
                    <div className={styles.name}>{prisoner.name}</div>
                  </td>
                  <td className={styles.num}>{prisoner.birthYear || "—"}</td>
                  <td className={styles.num}>{prisoner.residentId || "—"}</td>
                  <td className={styles.num}>{prisoner.height || "—"}</td>
                  <td className={styles.num}>{prisoner.incarcerationDate ?? "—"}</td>
                  <td className={styles.num}>{prisoner.inmateNumber || "—"}</td>
                </tr>
                <tr className={styles.detail} aria-hidden="true">
                  <td colSpan={6}>
                    <div className={styles.detailBox}>
                      <dl>
                        <dt>공범</dt>
                        <dd>{prisoner.coConspirators || "—"}</dd>
                        <dt>출생기관</dt>
                        <dd>{prisoner.birthInstitution || "—"}</dd>
                        <dt>국적</dt>
                        <dd>{prisoner.nationality || "—"}</dd>
                        <dt>형량</dt>
                        <dd>{prisoner.sentence || "—"}</dd>
                        <dt>구사 언어</dt>
                        <dd>{prisoner.spokenLanguage || "—"}</dd>
                      </dl>
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
