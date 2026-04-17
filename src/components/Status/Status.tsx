import { ReactNode } from "react";
import styles from "./Status.module.css";

interface Props {
  kicker?: string;
  heading: string;
  body?: string;
  action?: ReactNode;
  variant?: "book" | "prisoner";
}

export function Status({ kicker, heading, body, action, variant = "book" }: Props) {
  return (
    <div
      className={`${styles.root} ${variant === "book" ? styles.panelBook : styles.panelPrisoner}`}
    >
      <div className={styles.inner}>
        {kicker && <div className={styles.kicker}>{kicker}</div>}
        <h2 className={styles.heading}>{heading}</h2>
        {body && <p className={styles.body}>{body}</p>}
        {action}
      </div>
    </div>
  );
}
