"use client";

import Link from "next/link";
import styles from "./Header.module.css";

interface Props {
  swapped: boolean;
  onToggleSwap: () => void;
}

export function Header({ swapped, onToggleSwap }: Props) {
  return (
    <header className={styles.root} role="banner">
      <Link href="/" className={styles.brand} aria-label="홈으로">
        Book as Prisoner
      </Link>
      <button
        type="button"
        className={styles.reverseBtn}
        onClick={onToggleSwap}
        aria-label="좌우 패널 교체"
        aria-pressed={swapped}
      >
        Reverse
      </button>
    </header>
  );
}
