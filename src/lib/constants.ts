export const LANG_MAP: Record<string, string> = {
  kor: "한국어",
  ko: "한국어",
  한국어: "한국어",
  eng: "영어",
  en: "영어",
  영어: "영어",
  jpn: "일본어",
  ja: "일본어",
  일본어: "일본어",
  chi: "중국어",
  zh: "중국어",
  중국어: "중국어",
  fre: "프랑스어",
  fra: "프랑스어",
  프랑스어: "프랑스어",
  ger: "독일어",
  deu: "독일어",
  독일어: "독일어",
  spa: "스페인어",
  스페인어: "스페인어",
  rus: "러시아어",
  러시아어: "러시아어",
  ita: "이탈리아어",
  이탈리아어: "이탈리아어",
  lat: "라틴어",
  라틴어: "라틴어",
  ara: "아랍어",
  아랍어: "아랍어",
  hin: "힌디어",
  힌디어: "힌디어",
};

export const CACHE_TTL = {
  SEARCH: 86400,
  BOOK_DETAIL: 604800,
  NEW_BOOKS: 21600,
  IMAGE: 604800,
} as const;

export const PAGE_SIZE = 20 as const;
export const MAX_PAGES = 50 as const;

// 도서관 ↔ 교도소 용어 사전. 어휘의 단일 진실 공급원.
export const DICTIONARY = {
  도서: "수감자",
  표제: "성명",
  저자: "공범",
  출판사: "출생기관",
  발행일: "출생일",
  발행지: "국적",
  ISBN: "주민등록번호",
  청구기호: "수감번호",
  판형: "신장",
  페이지: "형량",
  등록일자: "수감일",
  언어: "구사 언어",
  대출신청: "면회신청",
  대출허가: "면회허가",
  대출중: "이감중",
  분실: "탈옥",
  절판: "형 집행 종료",
} as const;
