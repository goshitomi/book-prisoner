"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./Header.module.css";

interface Props {
  swapped: boolean;
  onToggleSwap: () => void;
  bookSearch?: ReactNode;
  prisonerSearch?: ReactNode;
}

export function Header({ swapped, onToggleSwap, bookSearch, prisonerSearch }: Props) {
  const bookTitle = (
    <div className={styles.col} data-side={swapped ? "right" : "left"}>
      <div className={styles.row}>
        <h2 className={styles.title}>
          <Link href="/" className={styles.titleLink} aria-label="홈으로">
            List of Books
          </Link>
        </h2>
        {bookSearch}
      </div>
      <button
        type="button"
        className={styles.reverseBtn}
        onClick={onToggleSwap}
        aria-label="좌우 패널 교체"
        aria-pressed={swapped}
      >
        Reverse
      </button>
    </div>
  );
  const prisonerTitle = (
    <div className={styles.col} data-side={swapped ? "left" : "right"}>
      <div className={styles.row}>
        <h2 className={styles.title}>
          <Link href="/" className={styles.titleLink} aria-label="홈으로">
            List of Prisoners
          </Link>
        </h2>
        {prisonerSearch}
      </div>
    </div>
  );
  return (
    <header className={styles.root} role="banner">
      {swapped ? prisonerTitle : bookTitle}
      {swapped ? bookTitle : prisonerTitle}
    </header>
  );
}
