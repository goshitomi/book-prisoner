import { NextRequest, NextResponse } from "next/server";
import { searchNL } from "@/lib/api/nl";
import { fetchSeojiBatch } from "@/lib/api/nlSeoji";
import { fetchBookEnrichment } from "@/lib/api/data4library";
import { kvGet, kvSet } from "@/lib/cache/kv";
import { mapBookToPrisoner, normalizeBook } from "@/lib/mapBookToPrisoner";
import { sanitizeIsbn } from "@/lib/utils/isbn";
import fallbackData from "@/lib/fallback/prisoners.json";
import { CACHE_TTL } from "@/lib/constants";
import type { BookPrisonerPair } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { isbn: string } },
) {
  const isbn = sanitizeIsbn(params.isbn);
  if (!isbn || isbn.length !== 13) {
    return NextResponse.json({ error: "INVALID_ISBN" }, { status: 400 });
  }

  const cacheKey = `book:${isbn}`;
  const cached = await kvGet<BookPrisonerPair>(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    const { items } = await searchNL({ isbn, pageNum: 1, pageSize: 1 });
    const raw = items[0];
    const [seojiMap, enrichmentMap] = await Promise.all([
      fetchSeojiBatch([isbn]),
      fetchBookEnrichment([isbn]),
    ]);

    if (!raw) {
      const fallbackPair = (fallbackData as BookPrisonerPair[]).find(
        (p) => p.book.isbn13 === isbn,
      );
      if (fallbackPair) return NextResponse.json(fallbackPair);
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const seoji = seojiMap[isbn] ?? {};
    const enrichment = enrichmentMap[isbn] ?? {};
    const book = normalizeBook(
      raw,
      seoji,
      enrichment.bookImageURL ?? raw.image_url ?? null,
      enrichment.reg_date ?? null,
    );
    const prisoner = mapBookToPrisoner(book);
    const pair: BookPrisonerPair = { book, prisoner };

    await kvSet(cacheKey, pair, CACHE_TTL.BOOK_DETAIL);
    return NextResponse.json(pair);
  } catch (err) {
    console.error("[book] failed", err);
    const fallbackPair = (fallbackData as BookPrisonerPair[]).find(
      (p) => p.book.isbn13 === isbn,
    );
    if (fallbackPair) return NextResponse.json(fallbackPair);
    return NextResponse.json({ error: "UPSTREAM_DOWN" }, { status: 502 });
  }
}
