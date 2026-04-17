"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import styles from "./Pagination.module.css";

interface Props {
  page: number;
  totalPages: number;
}

function getRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) items.push("…");
  for (let i = left; i <= right; i++) items.push(i);
  if (right < total - 1) items.push("…");
  items.push(total);
  return items;
}

export function Pagination({ page, totalPages }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (totalPages <= 1) return null;

  const goto = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const range = getRange(page, totalPages);

  return (
    <nav className={`${styles.root} allowSystemCursor`} aria-label="페이지 네비게이션">
      <button
        type="button"
        className={`${styles.page} ${styles.arrow}`}
        onClick={() => goto(page - 1)}
        disabled={page <= 1}
        aria-label="이전 페이지"
      >
        ‹
      </button>
      {range.map((item, i) =>
        item === "…" ? (
          <span key={`e${i}`} className={styles.ellipsis} aria-hidden="true">
            …
          </span>
        ) : (
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
        ),
      )}
      <button
        type="button"
        className={`${styles.page} ${styles.arrow}`}
        onClick={() => goto(page + 1)}
        disabled={page >= totalPages}
        aria-label="다음 페이지"
      >
        ›
      </button>
    </nav>
  );
}
