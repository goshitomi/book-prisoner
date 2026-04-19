"use client";

import styles from "./ReverseButton.module.css";

interface Props {
  swapped: boolean;
  onToggle: () => void;
}

export function ReverseButton({ swapped, onToggle }: Props) {
  return (
    <button
      type="button"
      className={styles.btn}
      onClick={onToggle}
      aria-label="좌우 패널 교체"
      aria-pressed={swapped}
      title="Reverse"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 6 H15 M12 3 L15 6 L12 9 M17 14 H5 M8 11 L5 14 L8 17"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
          strokeLinejoin="miter"
          fill="none"
        />
      </svg>
    </button>
  );
}
