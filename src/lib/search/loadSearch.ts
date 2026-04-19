import { searchNL, fetchNLNewBooks } from "@/lib/api/nl";
import { fetchSeojiBatch } from "@/lib/api/nlSeoji";
import { fetchBookEnrichment } from "@/lib/api/data4library";
import { kvGet, kvSet } from "@/lib/cache/kv";
import { mapBookToPrisoner, normalizeBook } from "@/lib/mapBookToPrisoner";
import { extractIsbn13, isIsbnLike, sanitizeIsbn } from "@/lib/utils/isbn";
import fallbackData from "@/lib/fallback/prisoners.json";
import { CACHE_TTL, MAX_PAGES, PAGE_SIZE } from "@/lib/constants";
import type {
  BookPrisonerPair,
  FallbackReason,
  NLRawItem,
  SearchResponse,
} from "@/lib/types";

// 캐시 키 버전은 이 파일에서 단일 관리. 스키마 변경 시 CACHE_VERSION만 올리면 전사 무효화.
const CACHE_VERSION = "v3";

function dedupByIsbn(items: NLRawItem[]): NLRawItem[] {
  const seen = new Set<string>();
  const out: NLRawItem[] = [];
  for (const item of items) {
    const isbn = extractIsbn13(item.isbn);
    const key = isbn || `${item.title_info}::${item.author_info}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function loadSearch(
  query: string | null,
  page: number,
): Promise<SearchResponse> {
  const cacheKey = query
    ? `${CACHE_VERSION}:search:${encodeURIComponent(query)}:${page}`
    : `${CACHE_VERSION}:newbooks:${page}`;
  const cached = await kvGet<SearchResponse>(cacheKey);
  if (cached) return cached;

  try {
    let skeleton: NLRawItem[];
    let total = 0;
    let isFallback = false;
    let fallbackReason: FallbackReason = null;

    if (query) {
      const isbn = isIsbnLike(query) ? extractIsbn13(query) : undefined;
      const result = await searchNL({
        query: isbn ? undefined : query,
        isbn,
        pageNum: page,
        pageSize: PAGE_SIZE,
      });
      skeleton = result.items;
      total = result.total;

      if (skeleton.length === 0) {
        const fb = await fetchNLNewBooks(PAGE_SIZE, page);
        skeleton = fb.items;
        total = fb.total;
        isFallback = true;
        fallbackReason = "empty_result";
      }
    } else {
      const fb = await fetchNLNewBooks(PAGE_SIZE, page);
      skeleton = fb.items;
      total = fb.total;
    }

    skeleton = dedupByIsbn(skeleton);

    const isbns = skeleton
      .map((b) => extractIsbn13(b.isbn))
      .filter((i): i is string => !!i && i.length === 13);

    const [seojiMap, enrichmentMap] = await Promise.all([
      fetchSeojiBatch(isbns),
      fetchBookEnrichment(isbns),
    ]);

    const pairs: BookPrisonerPair[] = skeleton.map((raw) => {
      const isbn = extractIsbn13(raw.isbn);
      const seoji = seojiMap[isbn] ?? {};
      const enrichment = enrichmentMap[isbn] ?? {};
      const book = normalizeBook(
        raw,
        seoji,
        enrichment.bookImageURL ?? raw.image_url ?? null,
        enrichment.reg_date ?? null,
      );
      const prisoner = mapBookToPrisoner(book);
      return { book, prisoner };
    });

    // 홈(쿼리 없음)은 5페이지까지만 표시 — 그 이후 NL API가 빈 결과/에러를 자주 반환.
    // 검색은 호출 가능한 모든 페이지(MAX_PAGES) 허용.
    const pageCap = query ? MAX_PAGES : 5;
    const displayableTotal = Math.min(
      total || pairs.length,
      PAGE_SIZE * pageCap,
    );
    const totalPages = Math.min(
      Math.max(1, Math.ceil(displayableTotal / PAGE_SIZE)),
      pageCap,
    );

    const response: SearchResponse = {
      items: pairs,
      page,
      pageSize: PAGE_SIZE,
      displayableTotal,
      totalPages,
      isFallback,
      fallbackReason,
      query,
    };

    const ttl = query ? CACHE_TTL.SEARCH : CACHE_TTL.NEW_BOOKS;
    await kvSet(cacheKey, response, ttl);
    return response;
  } catch (err) {
    console.error("[loadSearch] failed, using local fallback", err);
    const items = (fallbackData as BookPrisonerPair[]).slice(0, PAGE_SIZE);
    return {
      items,
      page: 1,
      pageSize: PAGE_SIZE,
      displayableTotal: items.length,
      totalPages: 1,
      isFallback: true,
      fallbackReason: "api_down",
      query,
    };
  }
}

export async function loadPair(
  rawIsbn: string,
): Promise<BookPrisonerPair | null> {
  const isbn = sanitizeIsbn(rawIsbn);
  if (!isbn || isbn.length !== 13) return null;

  const cacheKey = `${CACHE_VERSION}:book:${isbn}`;
  const cached = await kvGet<BookPrisonerPair>(cacheKey);
  if (cached) return cached;

  try {
    const { items } = await searchNL({ isbn, pageNum: 1, pageSize: 10 });
    const raw =
      items.find((item) => extractIsbn13(item.isbn) === isbn) ?? items[0];
    if (!raw) {
      const fallback = (fallbackData as BookPrisonerPair[]).find(
        (p) => p.book.isbn13 === isbn,
      );
      return fallback ?? null;
    }
    const [seojiMap, enrichmentMap] = await Promise.all([
      fetchSeojiBatch([isbn]),
      fetchBookEnrichment([isbn]),
    ]);
    const seoji = seojiMap[isbn] ?? {};
    const enrichment = enrichmentMap[isbn] ?? {};
    const book = normalizeBook(
      raw,
      seoji,
      enrichment.bookImageURL ?? null,
      enrichment.reg_date ?? null,
    );
    const prisoner = mapBookToPrisoner(book);
    const pair: BookPrisonerPair = { book, prisoner };
    await kvSet(cacheKey, pair, CACHE_TTL.BOOK_DETAIL);
    return pair;
  } catch (err) {
    console.error("[loadPair] failed", err);
    const fallback = (fallbackData as BookPrisonerPair[]).find(
      (p) => p.book.isbn13 === isbn,
    );
    return fallback ?? null;
  }
}
