"use client";

import { useEffect, useState } from "react";
import { Status } from "@/components/Status/Status";

const COOLDOWN_STEPS = [3, 7, 15];

export default function RuntimeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [cooldown, setCooldown] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    console.error("[runtime error]", error);
  }, [error]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const onRetry = () => {
    if (cooldown > 0) return;
    const wait = COOLDOWN_STEPS[Math.min(attempt, COOLDOWN_STEPS.length - 1)];
    setAttempt((a) => a + 1);
    setCooldown(wait);
    // 쿨다운 시작 후 reset: 첫 시도는 즉시, 이후 시도는 쿨다운 종료 후.
    if (attempt === 0) {
      reset();
    } else {
      setTimeout(reset, wait * 1000);
    }
  };

  const buttonLabel =
    cooldown > 0 ? `${cooldown}초 후 재시도 가능` : "다시 시도";

  const btnStyle = {
    background: "transparent",
    border: "1px solid currentColor",
    color: "inherit",
    padding: "10px 20px",
    fontFamily: "var(--font-ko)",
    fontSize: 13,
    letterSpacing: "0.1em",
    cursor: cooldown > 0 ? ("default" as const) : ("pointer" as const),
    opacity: cooldown > 0 ? 0.5 : 1,
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "100vh" }}>
      <Status
        variant="book"
        kicker="SYSTEM NOTICE"
        heading="자료실 점검 중"
        body="일시적으로 자료 조회가 중단되었습니다. 잠시 후 다시 시도해 주십시오."
        action={
          <button type="button" onClick={onRetry} disabled={cooldown > 0} style={btnStyle}>
            {buttonLabel}
          </button>
        }
      />
      <Status
        variant="prisoner"
        kicker="ADMINISTRATION NOTICE"
        heading="감독관 부재"
        body="모든 면회가 일시 중단되었습니다. 잠시 후 다시 시도해 주십시오."
        action={
          <button type="button" onClick={onRetry} disabled={cooldown > 0} style={btnStyle}>
            {buttonLabel}
          </button>
        }
      />
    </div>
  );
}
