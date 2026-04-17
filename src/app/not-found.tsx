import Link from "next/link";
import { Status } from "@/components/Status/Status";

const linkStyle: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid currentColor",
  padding: "10px 20px",
  fontFamily: "var(--font-ko)",
  fontSize: 13,
  letterSpacing: "0.1em",
  textDecoration: "none",
  color: "inherit",
};

export default function NotFound() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "100vh" }}>
      <Status
        variant="book"
        kicker="NOT IN CATALOG"
        heading="해당 자료가 수감 기록에 존재하지 않습니다"
        body="요청하신 자료는 현재 명부에서 찾을 수 없습니다."
        action={
          <Link href="/" style={linkStyle}>
            ← 명부로 돌아가기
          </Link>
        }
      />
      <Status
        variant="prisoner"
        kicker="UNIDENTIFIED"
        heading="해당 수감자가 확인되지 않습니다"
        body="요청하신 인물은 현재 수감자 명부에 없습니다."
        action={
          <Link href="/" style={linkStyle}>
            ← 수감자 명부로
          </Link>
        }
      />
    </div>
  );
}
