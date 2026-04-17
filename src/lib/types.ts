// 원본 API 응답 타입 (raw). 내부 파싱용.
export interface NLRawItem {
  title_info: string;
  author_info: string;
  pub_info: string;
  pub_year_info: string;
  isbn: string;
  call_no: string;
  lang_info: string;
  image_url: string;
  reg_date: string;
  place_info: string;
}

export interface NLSeojiRawItem {
  TITLE?: string;
  AUTHOR?: string;
  PUBLISHER?: string;
  PUBLISH_PREDATE?: string;
  PAGE?: string;
  BOOK_SIZE?: string;
  EA_ISBN?: string;
  FORM?: string;
}

// 정규화된 도메인 타입. UI는 이 형태만 의존한다.
export interface Book {
  isbn13: string;
  title: string;
  authors: string;
  publisher: string;
  publicationYear: string;
  callNo: string | null;
  registrationDate: string | null;
  form: string | null;
  pages: number | null;
  publishPlace: string | null;
  language: string | null;
  imageUrl: string | null;
  source: "NL";
}

// Prisoner는 Book의 순수 별칭. 새 데이터 생성 금지.
export interface Prisoner {
  inmateNumber: string;
  name: string;
  coConspirators: string;
  birthInstitution: string;
  birthYear: string;
  residentId: string;
  height: string | null;
  sentence: string | null;
  nationality: string | null;
  incarcerationDate: string | null;
  spokenLanguage: string | null;
  mugshot: string | null;
}

export interface BookPrisonerPair {
  book: Book;
  prisoner: Prisoner;
}

export type FallbackReason = "empty_result" | "api_down" | null;

export interface SearchResponse {
  items: BookPrisonerPair[];
  page: number;
  pageSize: number;
  displayableTotal: number;
  totalPages: number;
  isFallback: boolean;
  fallbackReason: FallbackReason;
  query: string | null;
}
