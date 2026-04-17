"use client";

import { useRouter } from "next/navigation";
import type { BookPrisonerPair } from "@/lib/types";
import styles from "./PrisonerPanel.module.css";

interface Props {
  items: BookPrisonerPair[];
  isFallback: boolean;
  fallbackReason: string | null;
}

export function PrisonerPanel({ items, isFallback, fallbackReason }: Props) {
  const router = useRouter();
  return (
    <div className={styles.root}>
      <h2 id="prisoner-heading" className={styles.heading}>
        CURRENT INMATES
        <span className={styles.headingKo}>현 수감자 명부</span>
      </h2>
      {isFallback && fallbackReason === "empty_result" && (
        <div className={styles.fallbackBadge} role="status">
          ※ 수감자 명부에 해당 인물 없음 — 유사 프로필 조회
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
              <th>수감번호</th>
              <th>수감자명</th>
              <th>공범</th>
              <th>수감일</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ book, prisoner }) => (
              <tr
                key={book.isbn13 || prisoner.inmateNumber || prisoner.name}
                onClick={() => book.isbn13 && router.push(`/book/${book.isbn13}`)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && book.isbn13) router.push(`/book/${book.isbn13}`);
                }}
              >
                <td className={styles.inmateNumber}>{prisoner.inmateNumber}</td>
                <td>
                  <div className={styles.name}>{prisoner.name}</div>
                </td>
                <td className={styles.coConspirators}>{prisoner.coConspirators}</td>
                <td className={styles.incarcerationDate}>
                  {prisoner.incarcerationDate ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
