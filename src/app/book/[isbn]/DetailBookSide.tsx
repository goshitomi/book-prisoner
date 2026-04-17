"use client";

import Link from "next/link";
import { useState } from "react";
import type { BookPrisonerPair } from "@/lib/types";
import { toProxied } from "@/lib/utils/imageProxy";
import styles from "./Detail.module.css";

interface Props {
  pair: BookPrisonerPair;
  imageHover: null | "book" | "prisoner";
  onImageEnter: () => void;
  onImageLeave: () => void;
  onRequest: () => void;
}

export function DetailBookSide({
  pair,
  imageHover,
  onImageEnter,
  onImageLeave,
  onRequest,
}: Props) {
  const { book } = pair;
  const [imgOk, setImgOk] = useState(true);
  const proxied = toProxied(book.imageUrl);
  const inverted = imageHover === "prisoner";

  return (
    <div className={styles.root}>
      <div>
        <p className={styles.kicker}>BOOK INFORMATION</p>
        <h1 className={styles.title}>{book.title}</h1>
        <p className={styles.subtitle}>{book.authors}</p>

        <div
          className={`${styles.imageWrap} ${styles.imageBook} ${inverted ? styles.invert : ""}`}
          onMouseEnter={onImageEnter}
          onMouseLeave={onImageLeave}
        >
          {proxied && imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxied}
              alt={`${book.title} 표지`}
              onError={() => setImgOk(false)}
              loading="lazy"
            />
          ) : (
            <div className={styles.imagePlaceholder}>표지 미등록</div>
          )}
        </div>

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
          <dt>등록일자</dt>
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
          ← 명부로 돌아가기
        </Link>
      </div>
    </div>
  );
}
