"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

// 좌/우 패널 간에 호버 상태를 공유한다.
// 가짜 커서(DualCursor)는 시각적인 div일 뿐이라 브라우저의 :hover를 트리거하지 못하므로,
// 실제 마우스가 속한 패널의 행 인덱스를 React state로 공유하여 반대 패널에도 같은 효과를 준다.
interface HoverSyncValue {
  hoveredKey: string | null;
  setHovered: (key: string | null) => void;
}

const HoverSyncContext = createContext<HoverSyncValue>({
  hoveredKey: null,
  setHovered: () => {},
});

export function HoverSyncProvider({ children }: { children: ReactNode }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const setHovered = useCallback((key: string | null) => setHoveredKey(key), []);
  return (
    <HoverSyncContext.Provider value={{ hoveredKey, setHovered }}>
      {children}
    </HoverSyncContext.Provider>
  );
}

export function useHoverSync() {
  return useContext(HoverSyncContext);
}
