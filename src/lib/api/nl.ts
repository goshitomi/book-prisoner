import { z } from "zod";
import type { NLRawItem } from "../types";

const NL_BASE = "https://www.nl.go.kr/NL/search/openApi/search.do";

// 국중 API는 실제로는 camelCase로 응답한다. snake_case 구 표기도 혹시 몰라 받는다.
const NLItemSchema = z
  .object({
    titleInfo: z.string().optional(),
    authorInfo: z.string().optional(),
    pubInfo: z.string().optional(),
    pubYearInfo: z.string().optional(),
    isbn: z.string().optional(),
    callNo: z.string().optional(),
    langName: z.string().optional(),
    mediaName: z.string().optional(),
    typeName: z.string().optional(),
    typeCode: z.string().optional(),
    imageUrl: z.string().optional(),
    regDate: z.string().optional(),
    placeInfo: z.string().optional(),
    media_name: z.string().optional(),
    type_name: z.string().optional(),
    type_code: z.string().optional(),
    title_info: z.string().optional(),
    author_info: z.string().optional(),
    pub_info: z.string().optional(),
    pub_year_info: z.string().optional(),
    call_no: z.string().optional(),
    lang_info: z.string().optional(),
    image_url: z.string().optional(),
    reg_date: z.string().optional(),
    place_info: z.string().optional(),
  })
  .passthrough();

// 검색 하이라이트용 <span class="searching_txt">...</span> 제거 + HTML 엔티티 정리.
function stripHighlight(s: string | undefined): string {
  if (!s) return "";
  return s
    .replace(/<\/?span[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const NLResponseSchema = z
  .object({
    total: z.union([z.number(), z.string()]).transform((v) => Number(v) || 0),
    result: z.array(NLItemSchema).optional().default([]),
  })
  .passthrough();

const NLErrorSchema = z
  .object({
    errorCode: z.string(),
    errorMsg: z.string().optional(),
  })
  .passthrough();

export interface NLSearchParams {
  query?: string;
  isbn?: string;
  pageNum: number;
  pageSize: number;
}

async function request(params: URLSearchParams): Promise<{ total: number; items: NLRawItem[] }> {
  const apiKey = process.env.NL_API_KEY;
  if (!apiKey) throw new Error("NL_API_KEY not configured");
  params.set("key", apiKey);
  params.set("apiType", "json");

  const url = `${NL_BASE}?${params.toString()}`;
  const res = await fetch(url, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`NL API ${res.status}`);

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // 간혹 BOM/주석 섞인 응답
    json = JSON.parse(text.replace(/^\uFEFF/, ""));
  }

  const errorParsed = NLErrorSchema.safeParse(json);
  if (errorParsed.success) {
    throw new Error(`NL API error ${errorParsed.data.errorCode}: ${errorParsed.data.errorMsg ?? ""}`);
  }

  const parsed = NLResponseSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[nl] schema mismatch", parsed.error.issues.slice(0, 3));
    throw new Error("NL API schema mismatch");
  }

  const items = parsed.data.result
    .map((item) => ({
      title_info: stripHighlight(item.titleInfo ?? item.title_info),
      author_info: stripHighlight(item.authorInfo ?? item.author_info),
      pub_info: stripHighlight(item.pubInfo ?? item.pub_info),
      pub_year_info: stripHighlight(item.pubYearInfo ?? item.pub_year_info),
      isbn: String(item.isbn ?? "").trim(),
      call_no: String(item.callNo ?? item.call_no ?? "").trim(),
      lang_info: String(item.langName ?? item.lang_info ?? "").trim(),
      image_url: String(item.imageUrl ?? item.image_url ?? "").trim(),
      reg_date: String(item.regDate ?? item.reg_date ?? "").trim(),
      place_info: stripHighlight(item.placeInfo ?? item.place_info),
      media_name: String(item.mediaName ?? item.media_name ?? "").trim(),
      type_name: String(item.typeName ?? item.type_name ?? "").trim(),
    }))
    .filter(isBookLike);

  return { total: parsed.data.total, items: items.map(stripTypeFields) };
}

// 비도서 자료 제외 — 논문/기사/신문/잡지/학위논문/학술지 등.
// 1) ISBN-13 형태가 있으면 도서로 판정 (가장 강한 신호).
// 2) media/type 정보에 비도서 키워드가 있으면 제외.
// 3) 청구기호 패턴(예: KDC 0xx 총류 신문/잡지 등은 별도 처리 안 함 — 과한 false-negative 방지).
const NON_BOOK_KEYWORDS = [
  "신문",
  "잡지",
  "학술지",
  "논문",
  "학위논문",
  "기사",
  "연속간행물",
  "전자자료",
  "마이크로",
  "지도",
  "악보",
  "음반",
  "비도서",
];

function isBookLike(item: { isbn: string; media_name: string; type_name: string; call_no: string }): boolean {
  // 공백/하이픈으로 이어붙인 다중 ISBN 중 하나라도 ISBN-13/10이면 도서로 인정.
  const tokens = item.isbn.replace(/-/g, " ").split(/\s+/).filter(Boolean);
  const hasIsbn13 = tokens.some((t) => /^(97[89])\d{10}$/.test(t));
  const hasIsbn10 = tokens.some((t) => /^\d{9}[\dXx]$/i.test(t));
  if (hasIsbn13 || hasIsbn10) return true;

  const tag = `${item.media_name} ${item.type_name}`.toLowerCase();
  for (const kw of NON_BOOK_KEYWORDS) {
    if (tag.includes(kw.toLowerCase())) return false;
  }

  // ISBN이 비어있어도 인쇄자료/도서류면 통과 (고서·희귀자료).
  const isPrintBook =
    item.type_name.includes("도서") && item.media_name.includes("인쇄자료");
  return isPrintBook;
}

function stripTypeFields(item: NLRawItem & { media_name?: string; type_name?: string }): NLRawItem {
  return {
    title_info: item.title_info,
    author_info: item.author_info,
    pub_info: item.pub_info,
    pub_year_info: item.pub_year_info,
    isbn: item.isbn,
    call_no: item.call_no,
    lang_info: item.lang_info,
    image_url: item.image_url,
    reg_date: item.reg_date,
    place_info: item.place_info,
  };
}

export async function searchNL(params: NLSearchParams) {
  const qs = new URLSearchParams();
  qs.set("systemType", "오프라인자료");
  qs.set("category", "도서");
  qs.set("pageNum", String(params.pageNum));
  qs.set("pageSize", String(params.pageSize));

  if (params.isbn) {
    qs.set("detailSearch", "true");
    qs.set("isbnOp", "isbn");
    qs.set("isbnCode", params.isbn);
  } else if (params.query) {
    qs.set("kwd", params.query);
  }

  return request(qs);
}

// NL API는 kwd 필수 + sort 파라미터 무시됨. 결과 과다 샘플링 후 제목 dedup 및 regDate DESC 정렬.
// "대한민국"은 35/50 고유 제목, ISBN 19/50 — 가장 균형 잡힌 랜딩 키워드.
const LANDING_KEYWORD = "대한민국";

// NL API의 pageSize 상한(=100)을 넘지 않도록 여러 페이지로 나눠 샘플링.
const NL_PAGE_SIZE_CAP = 100;

export async function fetchNLNewBooks(
  pageSize = 20,
  pageNum = 1,
): Promise<{ items: NLRawItem[]; total: number }> {
  const want = Math.min(pageSize * 5, 300);
  const pagesNeeded = Math.ceil(want / NL_PAGE_SIZE_CAP);

  const results = await Promise.all(
    Array.from({ length: pagesNeeded }, (_, i) => {
      const qs = new URLSearchParams();
      qs.set("systemType", "오프라인자료");
      qs.set("category", "도서");
      qs.set("kwd", LANDING_KEYWORD);
      qs.set("pageNum", String((pageNum - 1) * pagesNeeded + i + 1));
      qs.set("pageSize", String(Math.min(want - i * NL_PAGE_SIZE_CAP, NL_PAGE_SIZE_CAP)));
      return request(qs).catch((err) => {
        console.warn("[nl] newBooks sub-fetch failed", err);
        return { items: [], total: 0 };
      });
    }),
  );

  const total = results[0]?.total ?? 0;
  const allItems = results.flatMap((r) => r.items);

  const seen = new Set<string>();
  const unique: NLRawItem[] = [];
  for (const item of allItems) {
    const key = item.title_info.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  unique.sort((a, b) => {
    const da = (a.reg_date || "").replace(/\D/g, "");
    const db = (b.reg_date || "").replace(/\D/g, "");
    return db.localeCompare(da);
  });

  return { items: unique.slice(0, pageSize), total };
}
