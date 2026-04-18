"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { BookPrisonerPair } from "@/lib/types";
import styles from "./BookPanel.module.css";

interface Props {
  items: BookPrisonerPair[];
  isFallback: boolean;
  fallbackReason: string | null;
  query?: string | null;
  footer?: ReactNode;
}

export function BookPanel({ items, isFallback, fallbackReason, query, footer }: Props) {
  const router = useRouter();
  return (
    <div className={styles.root}>
      <h2 id="book-heading" className={styles.heading}>
        CURRENT HOLDINGS
        <span className={styles.headingKo}>현재 소장 도서</span>
      </h2>
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
              <th>표제</th>
              <th>발행일</th>
              <th>ISBN</th>
              <th>판형</th>
              <th>입고날짜</th>
              <th>청구기호</th>
            </tr>
          </thead>
          {items.map(({ book }) => {
            const onActivate = () => book.isbn13 && router.push(`/book/${book.isbn13}`);
            return (
              <tbody key={book.isbn13 || book.callNo || book.title} className={styles.group}>
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
                    <div className={styles.detailBox}>
                      <dl>
                        <dt>저자</dt>
                        <dd>{book.authors || "—"}</dd>
                        <dt>출판사</dt>
                        <dd>{book.publisher || "—"}</dd>
                        <dt>발행지</dt>
                        <dd>{book.publishPlace || "—"}</dd>
                        <dt>페이지</dt>
                        <dd>{book.pages ? `${book.pages} p.` : "—"}</dd>
                        <dt>언어</dt>
                        <dd>{book.language || "—"}</dd>
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
