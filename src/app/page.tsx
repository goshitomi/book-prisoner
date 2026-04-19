import { Suspense } from "react";
import { loadSearch } from "@/lib/search/loadSearch";
import { LandingShell } from "./LandingShell";

// 검색/페이지네이션은 URL 쿼리 파라미터로 분기되므로 revalidate로 캐시 경로를 나눈다.
export const revalidate = 600;

interface SearchParams {
  q?: string;
  page?: string;
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = searchParams.q?.trim() || null;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const data = await loadSearch(query, page);
  return (
    <Suspense fallback={null}>
      <LandingShell data={data} />
    </Suspense>
  );
}
