import { notFound } from "next/navigation";
import { searchNL } from "@/lib/api/nl";
import { fetchSeojiBatch } from "@/lib/api/nlSeoji";
import { fetchBookEnrichment } from "@/lib/api/data4library";
import { kvGet, kvSet } from "@/lib/cache/kv";
import { mapBookToPrisoner, normalizeBook } from "@/lib/mapBookToPrisoner";
import { extractIsbn13, sanitizeIsbn } from "@/lib/utils/isbn";
import fallbackData from "@/lib/fallback/prisoners.json";
import { CACHE_TTL } from "@/lib/constants";
import type { BookPrisonerPair } from "@/lib/types";
import { DetailShell } from "./DetailShell";

export const dynamic = "force-dynamic";

async function loadPair(isbn: string): Promise<BookPrisonerPair | null> {
  const cacheKey = `book:${isbn}`;
  const cached = await kvGet<BookPrisonerPair>(cacheKey);
  if (cached) return cached;

  try {
    // NL API의 isbnCode 검색은 동일 ISBN 문자열을 가진 여러 판본을 반환할 수 있고,
    // 첫 번째 결과가 클릭한 책과 다른 경우가 있다. 충분히 가져온 뒤 ISBN 정확 일치하는 항목 선택.
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
    console.error("[detail] failed", err);
    const fallback = (fallbackData as BookPrisonerPair[]).find(
      (p) => p.book.isbn13 === isbn,
    );
    return fallback ?? null;
  }
}

export default async function BookDetailPage({
  params,
}: {
  params: { isbn: string };
}) {
  const isbn = sanitizeIsbn(params.isbn);
  if (!isbn || isbn.length !== 13) notFound();
  const pair = await loadPair(isbn);
  if (!pair) notFound();
  return <DetailShell pair={pair} />;
}
