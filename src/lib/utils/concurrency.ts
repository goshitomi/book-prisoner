// 간단한 concurrency limiter. 여러 API 클라이언트에서 재사용.
export async function runWithLimit<I, O>(
  items: I[],
  worker: (item: I) => Promise<O | null>,
  limit: number,
): Promise<(O | null)[]> {
  const results: (O | null)[] = new Array(items.length).fill(null);
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
