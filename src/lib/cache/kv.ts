// Vercel KV 래퍼. KV 환경변수가 없으면 프로세스 메모리 LRU 캐시로 degrade.
// 로컬 개발 및 KV 미구성 배포에서도 앱이 정상 동작하도록 보장.

type CacheValue = unknown;

let kvClient: {
  get: <T = unknown>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, opts?: { ex?: number }) => Promise<unknown>;
} | null = null;

function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function getClient() {
  if (!isKvConfigured()) return null;
  if (kvClient) return kvClient;
  try {
    const mod = await import("@vercel/kv");
    kvClient = mod.kv as unknown as typeof kvClient;
    return kvClient;
  } catch (err) {
    console.warn("[kv] @vercel/kv unavailable, caching disabled", err);
    return null;
  }
}

// ---- 인메모리 폴백 ----
// KV가 없을 때 프로세스 생명주기 내에서만 유효한 캐시. SSR 재요청 시 NL/Seoji/D4L 연타를 막는다.
interface MemEntry {
  value: unknown;
  exp: number;
}
const MEM_MAX_ENTRIES = 500;
const memCache = new Map<string, MemEntry>();

function memGet<T>(key: string): T | null {
  const hit = memCache.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) {
    memCache.delete(key);
    return null;
  }
  // LRU: 최근 접근을 꼬리로 이동.
  memCache.delete(key);
  memCache.set(key, hit);
  return hit.value as T;
}

function memSet(key: string, value: unknown, ttlSeconds: number): void {
  if (memCache.size >= MEM_MAX_ENTRIES) {
    const oldest = memCache.keys().next().value;
    if (oldest) memCache.delete(oldest);
  }
  memCache.set(key, { value, exp: Date.now() + ttlSeconds * 1000 });
}

export async function kvGet<T = CacheValue>(key: string): Promise<T | null> {
  try {
    const client = await getClient();
    if (!client) return memGet<T>(key);
    return (await client.get<T>(key)) ?? null;
  } catch (err) {
    console.warn("[kv] get failed", err);
    return memGet<T>(key);
  }
}

export async function kvSet(key: string, value: CacheValue, ttlSeconds: number): Promise<void> {
  try {
    const client = await getClient();
    if (!client) {
      memSet(key, value, ttlSeconds);
      return;
    }
    await client.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.warn("[kv] set failed", err);
    memSet(key, value, ttlSeconds);
  }
}
