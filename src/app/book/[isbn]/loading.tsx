import styles from "./loading.module.css";

export default function Loading() {
  const block = (
    <div className={styles.panel}>
      <div className={styles.kicker} />
      <div className={styles.title} />
      <div className={`${styles.line} ${styles.lineShort}`} />
      <div className={styles.image} />
      <div className={styles.spec}>
        <div className={`${styles.line} ${styles.lineLabel}`} />
        <div className={`${styles.line} ${styles.lineValue}`} />
        <div className={`${styles.line} ${styles.lineLabel}`} />
        <div className={`${styles.line} ${styles.lineValue}`} />
        <div className={`${styles.line} ${styles.lineLabel}`} />
        <div className={`${styles.line} ${styles.lineValue}`} />
        <div className={`${styles.line} ${styles.lineLabel}`} />
        <div className={`${styles.line} ${styles.lineValue}`} />
      </div>
      <div className={styles.cta} />
    </div>
  );
  return (
    <div className={styles.root} aria-busy="true" aria-label="상세 정보 불러오는 중">
      {block}
      <div className={styles.divider} />
      {block}
    </div>
  );
}
