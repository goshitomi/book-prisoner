import { searchNL, fetchNLNewBooks } from "@/lib/api/nl";
import { fetchSeojiBatch } from "@/lib/api/nlSeoji";
import {
  fetchBookEnrichment,
  fetchPopularDesignBooks,
} from "@/lib/api/data4library";
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
// v4: 랜딩을 디자인 인기 대출 도서로 교체 + 페이지당 30건 엄수.
const CACHE_VERSION = "v4";

// 과다 필터링(비도서/중복/ISBN 누락)에 대비한 오버페치 비율.
// NL 검색 pageSize 상한은 100이므로 PAGE_SIZE * 1.7 ≈ 51 으로 안전.
const OVERFETCH_MULTIPLIER = 1.7;

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
      // ISBN 조회는 결과 수가 적으므로 오버페치 불필요.
      const fetchSize = isbn
        ? PAGE_SIZE
        : Math.min(Math.ceil(PAGE_SIZE * OVERFETCH_MULTIPLIER), 100);
      const result = await searchNL({
        query: isbn ? undefined : query,
        isbn,
        pageNum: page,
        pageSize: fetchSize,
      });
      skeleton = result.items;
      total = result.total;

      if (skeleton.length === 0) {
        const fb = await fetchPopularDesignBooks(PAGE_SIZE, page);
        skeleton = fb.items;
        total = fb.total;
        isFallback = true;
        fallbackReason = "empty_result";
      }
    } else {
      // 홈(1-5 페이지): 디자인 인기 대출 도서.
      // data4library 가 응답하지 않으면 catch 에서 로컬 fallback 으로 폴스루.
      const fb = await fetchPopularDesignBooks(PAGE_SIZE, page);
      skeleton = fb.items;
      total = fb.total;

      // 인기 대출 API 가 빈 결과를 돌려주면 기존 NL 신착으로 폴백 (완전한 공백 방지).
      if (skeleton.length === 0) {
        const nlFb = await fetchNLNewBooks(PAGE_SIZE, page);
        skeleton = nlFb.items;
        total = nlFb.total;
      }
    }

    skeleton = dedupByIsbn(skeleton);

    // 목록에서 상세 페이지로 넘어갈 때 동일 레코드가 보장되도록 ISBN13 없는 항목은 제거.
    // (ISBN 없으면 /book/[isbn] 라우트로 이동할 수 없어 링크가 끊긴다.)
    skeleton = skeleton.filter((raw) => {
      const i = extractIsbn13(raw.isbn);
      return !!i && i.length === 13;
    });

    // 오버페치 결과를 정확히 PAGE_SIZE 로 트림 — 페이지당 30건 보장.
    if (skeleton.length > PAGE_SIZE) {
      skeleton = skeleton.slice(0, PAGE_SIZE);
    }

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

    // 목록/상세 페이지 간 데이터 일관성 보장:
    // loadPair는 동일 cacheKey(book:{isbn})를 먼저 조회하므로,
    // 검색 시점에 결정된 레코드를 그대로 재사용해 NL API가 다른 인스턴스를 돌려줘도
    // 사용자에게는 동일한 정보가 노출된다.
    await Promise.all(
      pairs
        .filter((p) => p.book.isbn13 && p.book.isbn13.length === 13)
        .map((p) =>
          kvSet(
            `${CACHE_VERSION}:book:${p.book.isbn13}`,
            p,
            CACHE_TTL.BOOK_DETAIL,
          ),
        ),
    );

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
