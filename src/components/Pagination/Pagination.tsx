"use client";

import type { ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import styles from "./Pagination.module.css";

interface Props {
  page: number;
  totalPages: number;
  trailing?: ReactNode;
}

function getRange(current: number, total: number): number[] {
  const window = 5;
  if (total <= window) return Array.from({ length: total }, (_, i) => i + 1);
  let start = Math.max(1, current - 2);
  let end = start + window - 1;
  if (end > total) {
    end = total;
    start = end - window + 1;
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function Pagination({ page, totalPages, trailing }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const goto = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const range = getRange(page, totalPages);

  return (
    <nav
      className={`${styles.root} allowSystemCursor`}
      aria-label="페이지 네비게이션"
    >
      <div className={styles.pages}>
        {totalPages > 1 && (
          <>
            <button
              type="button"
              className={`${styles.page} ${styles.arrow}`}
              onClick={() => goto(page - 1)}
              disabled={page <= 1}
              aria-label="이전 페이지"
            >
              ‹
            </button>
            {range.map((item) => (
              <button
                key={item}
                type="button"
                className={`${styles.page} ${item === page ? styles.current : ""}`}
                onClick={() => goto(item)}
                aria-current={item === page ? "page" : undefined}
                aria-label={`${item} 페이지${item === page ? " (현재)" : ""}`}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              className={`${styles.page} ${styles.arrow}`}
              onClick={() => goto(page + 1)}
              disabled={page >= totalPages}
              aria-label="다음 페이지"
            >
              ›
            </button>
          </>
        )}
      </div>
      {trailing && <div className={styles.trailing}>{trailing}</div>}
    </nav>
  );
}
