import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set([
  "image.aladin.co.kr",
  "bookthumb-phinf.pstatic.net",
  "data4library.kr",
  "www.data4library.kr",
  "www.nl.go.kr",
  "nl.go.kr",
  "cdn.nl.go.kr",
]);

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("src");
  if (!src) return new NextResponse("Missing src", { status: 400 });

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) {
    return new NextResponse("Host not allowed", { status: 403 });
  }

  try {
    const upstream = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "book-prisoner/1.0 (+exhibit)" },
    });
    if (!upstream.ok) {
      return new NextResponse("Upstream error", { status: upstream.status });
    }
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return new NextResponse("Proxy failed", { status: 502 });
  }
}
