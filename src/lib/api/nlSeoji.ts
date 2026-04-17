import type { NLSeojiRawItem } from "../types";
import { kvGet, kvSet } from "../cache/kv";
import { CACHE_TTL } from "../constants";

const SEOJI_BASE = "https://www.nl.go.kr/seoji/SearchApi.do";
const CONCURRENCY = 5;

async function fetchSingleSeoji(isbn: string): Promise<Partial<NLSeojiRawItem> | null> {
  const cacheKey = `seoji:${isbn}`;
  const cached = await kvGet<Partial<NLSeojiRawItem> | null>(cacheKey);
  if (cached !== null) return cached;

  const url = new URL(SEOJI_BASE);
  url.searchParams.set("cert_key", process.env.NL_API_KEY ?? "");
  url.searchParams.set("result_style", "json");
  url.searchParams.set("page_no", "1");
  url.searchParams.set("page_size", "1");
  url.searchParams.set("isbn", isbn);

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: CACHE_TTL.BOOK_DETAIL },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { docs?: Array<Partial<NLSeojiRawItem>> };
    const item = json.docs?.[0] ?? null;
    if (item) await kvSet(cacheKey, item, CACHE_TTL.BOOK_DETAIL);
    return item;
  } catch {
    return null;
  }
}

async function runWithLimit<T>(
  items: string[],
  worker: (item: string) => Promise<T | null>,
  limit: number,
): Promise<(T | null)[]> {
  const results: (T | null)[] = new Array(items.length).fill(null);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await worker(items[i]);
      } catch {
        results[i] = null;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
  return results;
}

export async function fetchSeojiBatch(
  isbns: string[],
): Promise<Record<string, Partial<NLSeojiRawItem>>> {
  const unique = Array.from(new Set(isbns.filter(Boolean)));
  const results = await runWithLimit(unique, fetchSingleSeoji, CONCURRENCY);
  const map: Record<string, Partial<NLSeojiRawItem>> = {};
  results.forEach((r, i) => {
    if (r) map[unique[i]] = r;
  });
  return map;
}
