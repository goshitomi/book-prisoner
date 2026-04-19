"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

// 좌/우 패널 간에 호버 상태를 공유한다.
// 가짜 커서(DualCursor)는 시각적인 div일 뿐이라 브라우저의 :hover를 트리거하지 못하므로,
// 실제 마우스가 속한 패널의 행 인덱스를 React state로 공유하여 반대 패널에도 같은 효과를 준다.
type Updater = string | null | ((cur: string | null) => string | null);

interface HoverSyncValue {
  hoveredKey: string | null;
  setHovered: (update: Updater) => void;
}

const HoverSyncContext = createContext<HoverSyncValue>({
  hoveredKey: null,
  setHovered: () => {},
});

export function HoverSyncProvider({ children }: { children: ReactNode }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const ref = useRef<string | null>(null);
  const setHovered = useCallback((update: Updater) => {
    const next =
      typeof update === "function" ? update(ref.current) : update;
    if (ref.current === next) return;
    ref.current = next;
    setHoveredKey(next);
  }, []);
  return (
    <HoverSyncContext.Provider value={{ hoveredKey, setHovered }}>
      {children}
    </HoverSyncContext.Provider>
  );
}

export function useHoverSync() {
  return useContext(HoverSyncContext);
}
