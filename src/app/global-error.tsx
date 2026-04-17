"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
          color: "#000",
          fontFamily:
            'system-ui, -apple-system, "Noto Sans KR", sans-serif',
          padding: "40px",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 12 }}>
            시스템 장애
          </h1>
          <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>
            예기치 못한 오류가 발생했습니다. 페이지를 새로고침하거나 잠시 후 다시 시도해 주십시오.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "transparent",
              border: "1px solid #000",
              padding: "10px 20px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
