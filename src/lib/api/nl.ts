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
    imageUrl: z.string().optional(),
    regDate: z.string().optional(),
    placeInfo: z.string().optional(),
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

  const items = parsed.data.result.map((item) => ({
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
  }));

  return { total: parsed.data.total, items };
}

export async function searchNL(params: NLSearchParams) {
  const qs = new URLSearchParams();
  qs.set("systemType", "오프라인자료");
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

export async function fetchNLNewBooks(pageSize = 20): Promise<NLRawItem[]> {
  const qs = new URLSearchParams();
  qs.set("systemType", "오프라인자료");
  qs.set("kwd", LANDING_KEYWORD);
  qs.set("pageNum", "1");
  qs.set("pageSize", String(pageSize * 5));
  const { items } = await request(qs);

  const seen = new Set<string>();
  const unique: NLRawItem[] = [];
  for (const item of items) {
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

  return unique.slice(0, pageSize);
}
