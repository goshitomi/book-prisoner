import { searchNL, fetchNLNewBooks } from "@/lib/api/nl";
import { fetchSeojiBatch } from "@/lib/api/nlSeoji";
import { fetchBookEnrichment } from "@/lib/api/data4library";
import { kvGet, kvSet } from "@/lib/cache/kv";
import { mapBookToPrisoner, normalizeBook } from "@/lib/mapBookToPrisoner";
import { isIsbnLike, sanitizeIsbn } from "@/lib/utils/isbn";
import fallbackData from "@/lib/fallback/prisoners.json";
import { CACHE_TTL, MAX_PAGES, PAGE_SIZE } from "@/lib/constants";
import type { BookPrisonerPair, FallbackReason, SearchResponse } from "@/lib/types";
import { LandingShell } from "./LandingShell";

export const dynamic = "force-dynamic";

async function loadSearch(query: string | null, page: number): Promise<SearchResponse> {
  const cacheKey = query ? `search:${query}:${page}` : `newbooks:${page}`;
  const cached = await kvGet<SearchResponse>(cacheKey);
  if (cached) return cached;

  try {
    let skeleton;
    let total = 0;
    let isFallback = false;
    let fallbackReason: FallbackReason = null;

    if (query) {
      const isbn = isIsbnLike(query) ? sanitizeIsbn(query) : undefined;
      const result = await searchNL({
        query: isbn ? undefined : query,
        isbn,
        pageNum: page,
        pageSize: PAGE_SIZE,
      });
      skeleton = result.items;
      total = result.total;

      if (skeleton.length === 0) {
        skeleton = await fetchNLNewBooks(PAGE_SIZE);
        total = skeleton.length;
        isFallback = true;
        fallbackReason = "empty_result";
      }
    } else {
      skeleton = await fetchNLNewBooks(PAGE_SIZE);
      total = skeleton.length;
    }

    const isbns = skeleton
      .map((b) => sanitizeIsbn(b.isbn))
      .filter((i): i is string => !!i && i.length === 13);

    const [seojiMap, enrichmentMap] = await Promise.all([
      fetchSeojiBatch(isbns),
      fetchBookEnrichment(isbns),
    ]);

    const pairs: BookPrisonerPair[] = skeleton.map((raw) => {
      const isbn = sanitizeIsbn(raw.isbn);
      const seoji = seojiMap[isbn] ?? {};
      const enrichment = enrichmentMap[isbn] ?? {};
      const book = normalizeBook(
        raw,
        seoji,
        enrichment.bookImageURL ?? null,
        enrichment.reg_date ?? null,
      );
      const prisoner = mapBookToPrisoner(book);
      return { book, prisoner };
    });

    const displayableTotal = query
      ? Math.min(total || pairs.length, PAGE_SIZE * MAX_PAGES)
      : pairs.length;
    const totalPages = Math.min(
      Math.max(1, Math.ceil(displayableTotal / PAGE_SIZE)),
      MAX_PAGES,
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
    console.error("[page] loadSearch failed, using local fallback", err);
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

interface SearchParams {
  q?: string;
  page?: string;
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = searchParams.q?.trim() || null;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const data = await loadSearch(query, page);
  return <LandingShell data={data} />;
}
