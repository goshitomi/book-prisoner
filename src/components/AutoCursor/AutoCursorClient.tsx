"use client";

import dynamic from "next/dynamic";

const AutoCursorInner = dynamic(
  () => import("./AutoCursor").then((m) => m.AutoCursor),
  { ssr: false },
);

export function AutoCursorClient() {
  return <AutoCursorInner />;
}
