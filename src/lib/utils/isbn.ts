export function sanitizeIsbn(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/[-\s]/g, "").slice(0, 13);
}

export function isIsbnLike(query: string): boolean {
  const stripped = query.replace(/[-\s]/g, "");
  return /^\d{10}$/.test(stripped) || /^\d{13}$/.test(stripped);
}

// 13자리 → 000000-0000000 하이픈 포맷 (주민등록번호 모양)
export function formatResidentId(isbn13: string): string {
  if (!isbn13 || isbn13.length !== 13) return isbn13 || "주민번호 불명";
  return `${isbn13.slice(0, 6)}-${isbn13.slice(6)}`;
}
