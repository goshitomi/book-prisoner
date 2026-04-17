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

  const parsed = NLResponseSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[nl] schema mismatch", parsed.error.issues.slice(0, 3));
    return { total: 0, items: [] };
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

// 기본 랜딩 / 결과 없음 폴백용. 국중 API에 명시적 '신착'은 없으므로
// 광범위한 조회(category=도서)로 최신을 받아온다.
export async function fetchNLNewBooks(pageSize = 20): Promise<NLRawItem[]> {
  const qs = new URLSearchParams();
  qs.set("systemType", "오프라인자료");
  qs.set("category", "도서");
  qs.set("pageNum", "1");
  qs.set("pageSize", String(pageSize));
  qs.set("sort", "reg_date");
  qs.set("order", "desc");
  const { items } = await request(qs);
  if (items.length > 0) return items;
  // 정렬이 무시되는 경우를 대비한 2차 시도
  const fallbackQs = new URLSearchParams();
  fallbackQs.set("systemType", "오프라인자료");
  fallbackQs.set("kwd", "책");
  fallbackQs.set("pageNum", "1");
  fallbackQs.set("pageSize", String(pageSize));
  const { items: fallbackItems } = await request(fallbackQs);
  return fallbackItems;
}
