"use client";

import { useRouter } from "next/navigation";
import type { BookPrisonerPair } from "@/lib/types";
import styles from "./BookPanel.module.css";

interface Props {
  items: BookPrisonerPair[];
  isFallback: boolean;
  fallbackReason: string | null;
}

export function BookPanel({ items, isFallback, fallbackReason }: Props) {
  const router = useRouter();
  return (
    <div className={styles.root}>
      <h2 id="book-heading" className={styles.heading}>
        CURRENT HOLDINGS
        <span className={styles.headingKo}>현재 소장 도서</span>
      </h2>
      {isFallback && fallbackReason === "empty_result" && (
        <div className={styles.fallbackBadge} role="status">
          ※ 해당 도서 없음 — 신착 자료로 대체
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
              <th>청구기호</th>
              <th>표제</th>
              <th>저자</th>
              <th>등록일</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ book }) => (
              <tr
                key={book.isbn13 || book.callNo || book.title}
                onClick={() => book.isbn13 && router.push(`/book/${book.isbn13}`)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && book.isbn13) router.push(`/book/${book.isbn13}`);
                }}
              >
                <td className={styles.callNo}>{book.callNo ?? "—"}</td>
                <td>
                  <div className={styles.title}>{book.title}</div>
                </td>
                <td className={styles.authors}>{book.authors}</td>
                <td className={styles.regDate}>{book.registrationDate ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
