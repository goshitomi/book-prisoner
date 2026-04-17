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
  return (
    <header className={styles.root} role="banner">
      <Link href="/" className={styles.brand} aria-label="홈으로">
        Book as Prisoner
      </Link>
      {searchSlot}
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
