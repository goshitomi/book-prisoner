import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Book as Prisoner",
  description:
    "국립중앙도서관 서지 데이터를 이용해 도서 대출신청과 죄수 면회신청이 구조적으로 동일함을 보여주는 스토리텔링 프로젝트.",
  openGraph: {
    title: "Book as Prisoner",
    description: "A Book is a Prisoner.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <a href="#main" className="skipLink">
          본문으로 건너뛰기
        </a>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
