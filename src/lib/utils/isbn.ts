// 국중 isbn 필드는 "ISBN10 ISBN13" 같은 다중 토큰 혼재. slice(0,13) 대신 토큰 파싱.
export function extractIsbn13(raw: string | null | undefined): string {
  if (!raw) return "";
  const tokens = raw.replace(/-/g, " ").split(/\s+/).filter(Boolean);
  const isbn13 = tokens.find((t) => /^\d{13}$/.test(t));
  if (isbn13) return isbn13;
  const isbn10 = tokens.find((t) => /^\d{9}[\dXx]$/i.test(t));
  return isbn10 ? convertIsbn10To13(isbn10) : "";
}

function convertIsbn10To13(isbn10: string): string {
  const d = isbn10.replace(/[^0-9]/gi, "").slice(0, 9);
  if (d.length !== 9) return "";
  const base = "978" + d;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

export function sanitizeIsbn(raw: string | null | undefined): string {
  return extractIsbn13(raw);
}

export function isIsbnLike(query: string): boolean {
  const stripped = query.replace(/[-\s]/g, "");
  return /^\d{10}$/.test(stripped) || /^\d{13}$/.test(stripped);
}

export function formatResidentId(isbn13: string): string {
  if (!isbn13 || isbn13.length !== 13) return isbn13 || "주민번호 불명";
  return `${isbn13.slice(0, 6)}-${isbn13.slice(6)}`;
}
