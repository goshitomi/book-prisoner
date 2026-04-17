export function toProxied(src: string | null | undefined): string | null {
  if (!src) return null;
  try {
    // URL 유효성만 검증
    new URL(src);
    return `/api/image?src=${encodeURIComponent(src)}`;
  } catch {
    return null;
  }
}
