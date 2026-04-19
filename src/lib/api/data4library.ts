import { kvGet, kvSet } from "../cache/kv";
import { CACHE_TTL } from "../constants";
import { runWithLimit } from "../utils/concurrency";
import type { NLRawItem } from "../types";
import designBooksData from "../data/design-books.json";

const D4L_BASE = "https://data4library.kr/api";
const CONCURRENCY = 5;
const TIMEOUT_MS = 5000;
const POPULAR_TIMEOUT_MS = 8000;

interface D4LBookDetail {
  bookImageURL?: string;
  class_no?: string;
  reg_date?: string;
}

async function fetchSingleDetail(isbn: string): Promise<D4LBookDetail | null> {
  const cacheKey = `d4l:${isbn}`;
  const cached = await kvGet<D4LBookDetail | null>(cacheKey);
  if (cached !== null) return cached;

  const url = new URL(`${D4L_BASE}/srchDtlList`);
  url.searchParams.set("authKey", process.env.DATA4LIB_API_KEY ?? "");
  url.searchParams.set("isbn13", isbn);
  url.searchParams.set("loaninfoYN", "N");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: CACHE_TTL.IMAGE },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      response?: {
        detail?: Array<{ book?: D4LBookDetail }>;
      };
    };
    const book = json.response?.detail?.[0]?.book ?? null;
    if (book) await kvSet(cacheKey, book, CACHE_TTL.IMAGE);
    return book;
  } catch {
    return null;
  }
}

export async function fetchBookEnrichment(
  isbns: string[],
): Promise<Record<string, D4LBookDetail>> {
  const unique = Array.from(new Set(isbns.filter(Boolean)));
  const results = await runWithLimit(unique, fetchSingleDetail, CONCURRENCY);
  const map: Record<string, D4LBookDetail> = {};
  results.forEach((r, i) => {
    if (r) map[unique[i]] = r;
  });
  return map;
}

export async function fetchBookImages(
  isbns: string[],
): Promise<Record<string, string | null>> {
  const enrichment = await fetchBookEnrichment(isbns);
  const map: Record<string, string | null> = {};
  for (const isbn of isbns) {
    map[isbn] = enrichment[isbn]?.bookImageURL ?? null;
  }
  return map;
}

// --- 인기 대출 도서 (도서관 정보나루 loanItemSrch) -------------------
//
// 랜딩 1-5 페이지를 정부 보고서 대신 디자인 관련 인기 대출 도서로 대체하기 위한 헬퍼.
// KDC 600(예술) 및 658(상업미술/디자인)을 주로 노린다.
// https://www.data4library.kr/openDataV

interface D4LLoanDoc {
  no?: string;
  ranking?: string;
  bookname?: string;
  authors?: string;
  publisher?: string;
  publication_year?: string;
  isbn13?: string;
  addition_symbol?: string;
  class_no?: string;
  class_nm?: string;
  bookImageURL?: string;
  bookDtlUrl?: string;
  loan_count?: string;
}

interface D4LLoanResponse {
  response?: {
    numFound?: string | number;
    resultNum?: string | number;
    docs?: Array<{ doc?: D4LLoanDoc }>;
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

async function fetchLoanPage(opts: {
  pageNo: number;
  pageSize: number;
  kdc?: string;
  startDt?: string;
  endDt?: string;
}): Promise<D4LLoanDoc[]> {
  const apiKey = process.env.DATA4LIB_API_KEY;
  if (!apiKey) return [];

  const url = new URL(`${D4L_BASE}/loanItemSrch`);
  url.searchParams.set("authKey", apiKey);
  url.searchParams.set("pageNo", String(opts.pageNo));
  url.searchParams.set("pageSize", String(opts.pageSize));
  if (opts.kdc) url.searchParams.set("kdc", opts.kdc);
  if (opts.startDt) url.searchParams.set("startDt", opts.startDt);
  if (opts.endDt) url.searchParams.set("endDt", opts.endDt);
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: CACHE_TTL.NEW_BOOKS },
      signal: AbortSignal.timeout(POPULAR_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as D4LLoanResponse;
    const docs = json.response?.docs ?? [];
    return docs
      .map((d) => d.doc)
      .filter((d): d is D4LLoanDoc => !!d && !!d.isbn13);
  } catch (err) {
    console.warn("[data4library] loanItemSrch failed", err);
    return [];
  }
}

function loanDocToNLRaw(d: D4LLoanDoc): NLRawItem {
  return {
    title_info: (d.bookname ?? "").trim(),
    author_info: (d.authors ?? "").trim(),
    pub_info: (d.publisher ?? "").trim(),
    pub_year_info: (d.publication_year ?? "").trim(),
    isbn: (d.isbn13 ?? "").trim(),
    call_no: (d.class_no ?? "").trim(),
    lang_info: "",
    image_url: (d.bookImageURL ?? "").trim(),
    reg_date: "",
    place_info: "",
  };
}

// 랜딩 1-5페이지용 디자인 인기 대출 도서는 로컬 큐레이션 JSON에서 로드한다.
//
// 이전에는 loanItemSrch(kdc=658/600)로 런타임 조회했지만, data4library 의 `kdc` 파라미터는
// **단일 자릿수만 허용**한다(e.g. kdc=6). 2~3자리를 넘기면 에러 없이 빈 docs 를 돌려준다.
// 결과적으로 프로덕션에서는 항상 빈 배열 → fetchNLNewBooks 폴백 → 정부 보고서 9건만 노출됐다.
//
// 안정적이고 결정론적인 5페이지 × 30건 = 150건을 보장하기 위해, kdc=6(예술) 전체에서
// 클래스번호 접두사(651/652/654/656/657/658/659/662) + 키워드 + 제외 규칙으로 선별해
// src/lib/data/design-books.json 에 커밋해 둔다. 런타임 API 장애에 영향받지 않는다.

interface DesignBookEntry {
  isbn13: string;
  title: string;
  authors: string;
  publisher: string;
  publicationYear: string;
  classNo: string;
  imageUrl: string;
}

const DESIGN_BOOKS: readonly DesignBookEntry[] =
  designBooksData as DesignBookEntry[];

function designEntryToNLRaw(e: DesignBookEntry): NLRawItem {
  return {
    title_info: e.title,
    author_info: e.authors,
    pub_info: e.publisher,
    pub_year_info: e.publicationYear,
    isbn: e.isbn13,
    call_no: e.classNo,
    lang_info: "",
    image_url: e.imageUrl,
    reg_date: "",
    place_info: "",
  };
}

export async function fetchPopularDesignBooks(
  pageSize: number,
  pageNum: number,
): Promise<{ items: NLRawItem[]; total: number }> {
  const total = DESIGN_BOOKS.length;
  const start = Math.max(0, (pageNum - 1) * pageSize);
  const end = Math.min(total, start + pageSize);
  const slice = start >= total ? [] : DESIGN_BOOKS.slice(start, end);
  const items = slice.map(designEntryToNLRaw);
  return { items, total };
}

// 레거시 (loanItemSrch 기반) 구현이 필요할 때를 대비해 내부 헬퍼는 남겨둔다.
// formatDate / fetchLoanPage / loanDocToNLRaw 는 다른 KDC 기반 작업에서 재사용 가능.
export const __popularDesignBooksSource = "local-json";
