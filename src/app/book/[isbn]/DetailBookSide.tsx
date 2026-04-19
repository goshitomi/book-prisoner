"use client";

import Link from "next/link";
import type { BookPrisonerPair } from "@/lib/types";
import styles from "./Detail.module.css";

interface Props {
  pair: BookPrisonerPair;
  onRequest: () => void;
}

export function DetailBookSide({ pair, onRequest }: Props) {
  const { book } = pair;

  return (
    <div className={styles.root}>
      <div>
        <p className={styles.kicker}>BOOK INFORMATION</p>
        <h1 className={styles.title}>{book.title}</h1>

        <dl className={styles.spec}>
          <dt>표제</dt>
          <dd>{book.title}</dd>
          <dt>저자</dt>
          <dd>{book.authors}</dd>
          <dt>출판사</dt>
          <dd>{book.publisher || "—"}</dd>
          <dt>발행일</dt>
          <dd className={styles.num}>{book.publicationYear || "—"}</dd>
          <dt>발행지</dt>
          <dd>{book.publishPlace || "—"}</dd>
          <dt>청구기호</dt>
          <dd className={styles.num}>{book.callNo || "—"}</dd>
          <dt>ISBN</dt>
          <dd className={styles.num}>{book.isbn13 || "—"}</dd>
          <dt>판형</dt>
          <dd className={styles.num}>{book.form || "—"}</dd>
          <dt>페이지</dt>
          <dd className={styles.num}>{book.pages ? `${book.pages} p.` : "—"}</dd>
          <dt>입고날짜</dt>
          <dd className={styles.num}>{book.registrationDate || "—"}</dd>
          <dt>언어</dt>
          <dd>{book.language || "—"}</dd>
        </dl>

        <button type="button" className={`${styles.cta} ${styles.ctaBook}`} onClick={onRequest}>
          대출 신청
        </button>
      </div>
      <div>
        <Link href="/" className={styles.back}>
          ← 돌아가기
        </Link>
      </div>
    </div>
  );
}
