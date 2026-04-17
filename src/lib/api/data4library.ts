import { kvGet, kvSet } from "../cache/kv";
import { CACHE_TTL } from "../constants";

const D4L_BASE = "https://data4library.kr/api";

interface D4LBookDetail {
  bookImageURL?: string;
  class_no?: string;
  reg_date?: string;
}

async function fetchSingleDetail(isbn: string): Promise<D4LBookDetail | null> {
  const cacheKey = `d4l:${isbn}`;
  const cached = await kvGet<D4LBookDetail | null>(cacheKey);
  if (cached !== null) return cached;

  const url = new URL(`${D4L_BASE}/srchDtlList`);
  url.searchParams.set("authKey", process.env.DATA4LIB_API_KEY ?? "");
  url.searchParams.set("isbn13", isbn);
  url.searchParams.set("loaninfoYN", "N");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: CACHE_TTL.IMAGE },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      response?: {
        detail?: Array<{ book?: D4LBookDetail }>;
      };
    };
    const book = json.response?.detail?.[0]?.book ?? null;
    if (book) await kvSet(cacheKey, book, CACHE_TTL.IMAGE);
    return book;
  } catch {
    return null;
  }
}

export async function fetchBookEnrichment(
  isbns: string[],
): Promise<Record<string, D4LBookDetail>> {
  const unique = Array.from(new Set(isbns.filter(Boolean)));
  const results = await Promise.allSettled(unique.map((isbn) => fetchSingleDetail(isbn)));
  const map: Record<string, D4LBookDetail> = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) map[unique[i]] = r.value;
  });
  return map;
}

export async function fetchBookImages(
  isbns: string[],
): Promise<Record<string, string | null>> {
  const enrichment = await fetchBookEnrichment(isbns);
  const map: Record<string, string | null> = {};
  for (const isbn of isbns) {
    map[isbn] = enrichment[isbn]?.bookImageURL ?? null;
  }
  return map;
}
