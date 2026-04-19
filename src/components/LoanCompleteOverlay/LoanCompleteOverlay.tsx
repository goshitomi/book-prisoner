"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { BookPrisonerPair } from "@/lib/types";
import styles from "./LoanCompleteOverlay.module.css";

interface Props {
  pair: BookPrisonerPair;
  swapped: boolean;
  onClose: () => void;
}

export function LoanCompleteOverlay({ pair, swapped, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        // 포커스 트랩
        const root = rootRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKey);

    // 초기 포커스: 패널 내 첫 포커스 가능한 요소(돌아가기 링크).
    const initialFocusable = rootRef.current?.querySelector<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])',
    );
    initialFocusable?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  const bookPanel = (
    <div className={`${styles.panel} ${styles.panelBook}`} key="book">
      <div>
        <p className={styles.kicker}>LOAN REQUEST RECEIVED</p>
        <h2 id="overlay-title-book" className={styles.headline}>
          대출 신청 접수
        </h2>
        <dl className={styles.meta}>
          <dt>표제</dt>
          <dd>{pair.book.title}</dd>
          <dt>저자</dt>
          <dd>{pair.book.authors}</dd>
          <dt>청구기호</dt>
          <dd className="num">{pair.book.callNo ?? "—"}</dd>
        </dl>
        <p className={styles.body} aria-live="assertive">
          대출신청이 완료되었습니다.
        </p>
      </div>
      <div>
        <Link href="/" className={styles.homeLink}>
          ← 돌아가기(홈)
        </Link>
      </div>
    </div>
  );

  const prisonerPanel = (
    <div className={`${styles.panel} ${styles.panelPrisoner}`} key="prisoner">
      <div>
        <p className={styles.kicker}>VISITATION REQUEST RECEIVED</p>
        <h2 className={styles.headline}>면회 신청 접수</h2>
        <dl className={styles.meta}>
          <dt>수감자명</dt>
          <dd>{pair.prisoner.name}</dd>
          <dt>공범</dt>
          <dd>{pair.prisoner.coConspirators}</dd>
          <dt>수감번호</dt>
          <dd className="num">{pair.prisoner.inmateNumber}</dd>
        </dl>
        <p className={styles.body} aria-live="assertive">
          면회신청이 완료되었습니다.
        </p>
      </div>
      <div>
        <Link href="/" className={styles.homeLink}>
          ← 돌아가기(홈)
        </Link>
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={`${styles.overlay} ${swapped ? styles.swapped : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="overlay-title-book"
    >
      <div
        className={styles.panels}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {swapped ? prisonerPanel : bookPanel}
        {swapped ? bookPanel : prisonerPanel}
      </div>
    </div>
  );
}
