// Vercel KV 래퍼. KV 환경변수가 없으면 무캐시 모드(no-op)로 degrade.
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

export async function kvGet<T = CacheValue>(key: string): Promise<T | null> {
  try {
    const client = await getClient();
    if (!client) return null;
    return (await client.get<T>(key)) ?? null;
  } catch (err) {
    console.warn("[kv] get failed", err);
    return null;
  }
}

export async function kvSet(key: string, value: CacheValue, ttlSeconds: number): Promise<void> {
  try {
    const client = await getClient();
    if (!client) return;
    await client.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.warn("[kv] set failed", err);
  }
}
