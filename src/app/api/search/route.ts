import { NextRequest, NextResponse } from "next/server";
import { searchNL, fetchNLNewBooks } from "@/lib/api/nl";
import { fetchSeojiBatch } from "@/lib/api/nlSeoji";
import { fetchBookEnrichment } from "@/lib/api/data4library";
import { kvGet, kvSet } from "@/lib/cache/kv";
import { mapBookToPrisoner, normalizeBook } from "@/lib/mapBookToPrisoner";
import { extractIsbn13, isIsbnLike } from "@/lib/utils/isbn";
import fallbackData from "@/lib/fallback/prisoners.json";
import { CACHE_TTL, MAX_PAGES, PAGE_SIZE } from "@/lib/constants";
import type { BookPrisonerPair, FallbackReason, NLRawItem, SearchResponse } from "@/lib/types";

export const runtime = "nodejs";

function cleanQuery(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  return trimmed || null;
}

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = cleanQuery(searchParams.get("q"));
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const cacheKey = query
    ? `v2:search:${encodeURIComponent(query)}:${page}`
    : `v2:newbooks:${page}`;

  const cached = await kvGet<SearchResponse>(cacheKey);
  if (cached) return NextResponse.json(cached);

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
        skeleton = await fetchNLNewBooks(PAGE_SIZE);
        total = skeleton.length;
        isFallback = true;
        fallbackReason = "empty_result";
      }
    } else {
      skeleton = await fetchNLNewBooks(PAGE_SIZE);
      total = skeleton.length;
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

    return NextResponse.json(response);
  } catch (err) {
    console.error("[search] failed, using local fallback", err);
    const items = (fallbackData as BookPrisonerPair[]).slice(0, PAGE_SIZE);
    const response: SearchResponse = {
      items,
      page: 1,
      pageSize: PAGE_SIZE,
      displayableTotal: items.length,
      totalPages: 1,
      isFallback: true,
      fallbackReason: "api_down",
      query,
    };
    return NextResponse.json(response);
  }
}
