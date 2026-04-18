import styles from "./loading.module.css";

export default function Loading() {
  const rows = Array.from({ length: 10 });
  const skeleton = (heading: string, headingKo: string) => (
    <div className={styles.panel}>
      <h2 className={styles.heading}>
        {heading}
        <span className={styles.headingKo}>{headingKo}</span>
      </h2>
      <div className={styles.tableWrap}>
        {rows.map((_, i) => (
          <div key={i} className={styles.row}>
            <div className={`${styles.cell} ${styles.colSm}`} />
            <div className={`${styles.cell} ${styles.colLg}`} />
            <div className={`${styles.cell} ${styles.colMd}`} />
            <div className={`${styles.cell} ${styles.colXs}`} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={styles.root} aria-busy="true" aria-label="명부 불러오는 중">
      {skeleton("CURRENT HOLDINGS", "현재 소장 도서")}
      <div className={styles.divider} />
      {skeleton("CURRENT INMATES", "현 수감자 명부")}
    </div>
  );
}
