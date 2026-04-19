import { notFound } from "next/navigation";
import { loadPair } from "@/lib/search/loadSearch";
import { sanitizeIsbn } from "@/lib/utils/isbn";
import { DetailShell } from "./DetailShell";

export const revalidate = 3600;

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
