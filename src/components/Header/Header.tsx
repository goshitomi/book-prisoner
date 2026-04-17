"use client";

import Link from "next/link";
import { ReactNode } from "react";
import styles from "./Header.module.css";

interface Props {
  swapped: boolean;
  onToggleSwap: () => void;
  searchSlot?: ReactNode;
}

export function Header({ swapped, onToggleSwap, searchSlot }: Props) {
  const bookSide = (
    <div className={`${styles.side} ${styles.bookSide}`}>
      <Link href="/" className={styles.brand} aria-label="홈으로">
        <strong className={styles.ko}>책은 죄수다</strong>
        <span>OVERDUE</span>
      </Link>
    </div>
  );
  const prisonerSide = (
    <div className={`${styles.side} ${styles.prisonerSide}`}>
      {searchSlot}
      <button
        type="button"
        className={styles.swapBtn}
        onClick={onToggleSwap}
        aria-label="좌우 패널 교체"
        aria-pressed={swapped}
      >
        <span>書 ↔ 囚</span>
      </button>
    </div>
  );
  return (
    <header className={`${styles.root} ${swapped ? styles.swapped : ""}`} role="banner">
      {swapped ? prisonerSide : bookSide}
      {swapped ? bookSide : prisonerSide}
    </header>
  );
}
