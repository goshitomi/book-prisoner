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

export function DetailPrisonerSide({
  pair,
  imageHover,
  onImageEnter,
  onImageLeave,
  onRequest,
}: Props) {
  const { prisoner } = pair;
  const [imgOk, setImgOk] = useState(true);
  const proxied = toProxied(prisoner.mugshot);
  const inverted = imageHover === "book";

  return (
    <div className={styles.root}>
      <div>
        <p className={styles.kicker}>INMATE PROFILE</p>
        <h1 className={styles.title}>{prisoner.name}</h1>
        <p className={styles.subtitle}>{prisoner.coConspirators}</p>

        <div
          className={`${styles.imageWrap} ${styles.imagePrisoner} ${inverted ? styles.invert : ""}`}
          onMouseEnter={onImageEnter}
          onMouseLeave={onImageLeave}
        >
          {proxied && imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxied}
              alt={`${prisoner.name} 수감 사진`}
              onError={() => setImgOk(false)}
              loading="lazy"
            />
          ) : (
            <div className={styles.imagePlaceholder}>사진 미등록 / PHOTO UNAVAILABLE</div>
          )}
        </div>

        <dl className={styles.spec}>
          <dt>성명</dt>
          <dd>{prisoner.name}</dd>
          <dt>공범</dt>
          <dd>{prisoner.coConspirators}</dd>
          <dt>출생기관</dt>
          <dd>{prisoner.birthInstitution}</dd>
          <dt>출생년도</dt>
          <dd className={styles.num}>{prisoner.birthYear}</dd>
          <dt>국적</dt>
          <dd>{prisoner.nationality || "국적 불명"}</dd>
          <dt>수감번호</dt>
          <dd className={styles.num}>{prisoner.inmateNumber}</dd>
          <dt>주민등록번호</dt>
          <dd className={styles.num}>{prisoner.residentId}</dd>
          <dt>신장</dt>
          <dd className={styles.num}>{prisoner.height || "신원 미확인"}</dd>
          <dt>형량</dt>
          <dd className={styles.num}>{prisoner.sentence || "형량 미정"}</dd>
          <dt>수감일</dt>
          <dd className={styles.num}>{prisoner.incarcerationDate || "수감일 불명"}</dd>
          <dt>구사 언어</dt>
          <dd>{prisoner.spokenLanguage || "구사 언어 불명"}</dd>
        </dl>

        <button
          type="button"
          className={`${styles.cta} ${styles.ctaPrisoner}`}
          onClick={onRequest}
        >
          면회 신청
        </button>
      </div>
      <div>
        <Link href="/" className={styles.back}>
          ← 수감자 명부로 돌아가기
        </Link>
      </div>
    </div>
  );
}
