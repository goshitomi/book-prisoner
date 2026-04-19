import { kvGet, kvSet } from "../cache/kv";
import { CACHE_TTL } from "../constants";
import { runWithLimit } from "../utils/concurrency";
import type { NLRawItem } from "../types";

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

// 디자인 계열 KDC 분류. 658(상업미술/그래픽 디자인)을 최우선,
// 부족하면 600(예술 전체)로 보충 — 인기 대출 도서 특성상 해당 카테고리 자체가 편중돼
// 총 150건을 채우기 어려우므로 2단계로 샘플링한다.
const DESIGN_KDC_PRIMARY = "658";
const DESIGN_KDC_FALLBACK = "600";
// 조회 기간: 최근 1년 인기 대출.
const POPULAR_WINDOW_DAYS = 365;

export async function fetchPopularDesignBooks(
  pageSize: number,
  pageNum: number,
): Promise<{ items: NLRawItem[]; total: number }> {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - POPULAR_WINDOW_DAYS);
  const startDt = formatDate(startDate);
  const endDt = formatDate(endDate);

  // loanItemSrch pageNo 는 1-based. 페이지네이션을 그대로 전달.
  const primary = await fetchLoanPage({
    pageNo: pageNum,
    pageSize,
    kdc: DESIGN_KDC_PRIMARY,
    startDt,
    endDt,
  });

  let docs = primary;

  // 1차 결과가 요청 수보다 적으면 광의 카테고리(600)로 보충.
  if (docs.length < pageSize) {
    const deficit = pageSize - docs.length;
    const fallback = await fetchLoanPage({
      pageNo: pageNum,
      pageSize: deficit * 2,
      kdc: DESIGN_KDC_FALLBACK,
      startDt,
      endDt,
    });
    const existing = new Set(docs.map((d) => d.isbn13));
    for (const d of fallback) {
      if (docs.length >= pageSize) break;
      if (d.isbn13 && !existing.has(d.isbn13)) {
        docs.push(d);
        existing.add(d.isbn13);
      }
    }
  }

  const items = docs.map(loanDocToNLRaw);
  // loanItemSrch 는 정확한 total 을 주지 않으므로 5페이지 * pageSize 로 상한을 가정한다.
  // loadSearch 쪽에서 pageCap(5)으로 재차 클램프되므로 안전하다.
  return { items, total: pageSize * 5 };
}
