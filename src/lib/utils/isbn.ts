// 국중 isbn 필드는 "ISBN10 ISBN13" 또는 공백으로 이어붙인 여러 ISBN이 섞여 들어온다. 토큰 파싱.
export function extractIsbn13(raw: string | null | undefined): string {
  if (!raw) return "";
  const tokens = raw.replace(/-/g, " ").split(/\s+/).filter(Boolean);
  const isbn13 = tokens.find((t) => /^\d{13}$/.test(t));
  if (isbn13) return isbn13;
  const isbn10 = tokens.find(
    (t) => /^\d{9}[\dXx]$/i.test(t) && validateIsbn10Checksum(t),
  );
  return isbn10 ? convertIsbn10To13(isbn10) : "";
}

function validateIsbn10Checksum(isbn10: string): boolean {
  const clean = isbn10.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (clean.length !== 10) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const d = parseInt(clean[i], 10);
    if (Number.isNaN(d)) return false;
    sum += d * (10 - i);
  }
  const last = clean[9];
  const check = last === "X" ? 10 : parseInt(last, 10);
  if (Number.isNaN(check)) return false;
  return (sum + check) % 11 === 0;
}

function convertIsbn10To13(isbn10: string): string {
  const d = isbn10.replace(/[^0-9Xx]/g, "").slice(0, 9);
  if (d.length !== 9) return "";
  const base = "978" + d;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3);
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
