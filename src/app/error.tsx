"use client";

import { useEffect } from "react";
import { Status } from "@/components/Status/Status";

export default function RuntimeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[runtime error]", error);
  }, [error]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "100vh" }}>
      <Status
        variant="book"
        kicker="SYSTEM NOTICE"
        heading="자료실 점검 중"
        body="일시적으로 자료 조회가 중단되었습니다. 잠시 후 다시 시도해 주십시오."
        action={
          <button
            type="button"
            onClick={reset}
            style={{
              background: "transparent",
              border: "1px solid currentColor",
              color: "inherit",
              padding: "10px 20px",
              fontFamily: "var(--font-ko)",
              fontSize: 13,
              letterSpacing: "0.1em",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        }
      />
      <Status
        variant="prisoner"
        kicker="ADMINISTRATION NOTICE"
        heading="감독관 부재"
        body="모든 면회가 일시 중단되었습니다. 잠시 후 다시 시도해 주십시오."
        action={
          <button
            type="button"
            onClick={reset}
            style={{
              background: "transparent",
              border: "1px solid currentColor",
              color: "inherit",
              padding: "10px 20px",
              fontFamily: "var(--font-ko)",
              fontSize: 13,
              letterSpacing: "0.1em",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        }
      />
    </div>
  );
}
