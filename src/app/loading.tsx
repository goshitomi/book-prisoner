import styles from "./loading.module.css";

export default function Loading() {
  const rows = Array.from({ length: 10 });
  const skeleton = (heading: string) => (
    <div className={styles.panel}>
      <h2 className={styles.heading}>{heading}</h2>
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
      {skeleton("List of Books")}
      <div className={styles.divider} />
      {skeleton("List of Prisoners")}
    </div>
  );
}
