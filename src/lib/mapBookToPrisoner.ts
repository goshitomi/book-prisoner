import type { Book, Prisoner, NLRawItem, NLSeojiRawItem } from "./types";
import { LANG_MAP } from "./constants";
import { formatResidentId, sanitizeIsbn } from "./utils/isbn";

export function normalizeBook(
  nl: NLRawItem,
  seoji: Partial<NLSeojiRawItem>,
  imageUrl: string | null,
  registrationDate: string | null = null,
): Book {
  const rawIsbn = nl.isbn || seoji.EA_ISBN || "";
  const isbn13 = sanitizeIsbn(rawIsbn);

  return {
    isbn13,
    title: (nl.title_info || seoji.TITLE || "").trim() || "제목 미상",
    authors: (nl.author_info || seoji.AUTHOR || "").trim() || "저자 미상",
    publisher: (nl.pub_info || seoji.PUBLISHER || "").trim(),
    publicationYear: extractYear(nl.pub_year_info || seoji.PUBLISH_PREDATE),
    callNo: nl.call_no?.trim() || null,
    registrationDate: registrationDate || formatRegDate(nl.reg_date) || null,
    form: parseForm(seoji.BOOK_SIZE ?? null),
    pages: parsePages(seoji.PAGE ?? null),
    publishPlace: null,
    language: parseLanguage(nl.lang_info),
    imageUrl,
    source: "NL",
  };
}

export function mapBookToPrisoner(book: Book): Prisoner {
  return {
    inmateNumber: book.callNo
      ? book.callNo.replace(/\s+/g, "").toUpperCase()
      : "수감번호 불명",
    name: book.title,
    coConspirators: book.authors || "공범 불명",
    birthInstitution: book.publisher || "출생기관 불명",
    birthYear: book.publicationYear || "출생년 불명",
    residentId: formatResidentId(book.isbn13),
    height: book.form,
    sentence: book.pages ? `${book.pages}년` : null,
    nationality: book.publishPlace,
    incarcerationDate: book.registrationDate,
    spokenLanguage: book.language
      ? LANG_MAP[book.language.toLowerCase()] ?? book.language
      : null,
    mugshot: book.imageUrl,
  };
}

function extractYear(raw: string | null | undefined): string {
  if (!raw) return "";
  const m = raw.match(/\d{4}/);
  return m ? m[0] : "";
}

function parseForm(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.replace(/\s+/g, "").toLowerCase();
  return trimmed || null;
}

function parsePages(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseLanguage(raw: string): string | null {
  if (!raw) return null;
  return raw.trim() || null;
}

// NL regDate는 "20130923" 같은 YYYYMMDD. 하이픈 형태로 정규화.
function formatRegDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return digits || null;
}
