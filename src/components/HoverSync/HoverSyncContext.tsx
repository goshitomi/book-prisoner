"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

// 좌/우 패널 간에 호버 상태를 공유한다. 한쪽에서 마우스가 행에 들어오면
// 반대 패널의 동일 인덱스 행에도 같은 호버 효과를 적용한다.
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
