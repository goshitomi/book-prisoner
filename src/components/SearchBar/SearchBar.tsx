"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./SearchBar.module.css";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  ariaLabel?: string;
  examples?: string[];
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Search",
  ariaLabel = "검색",
  examples,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState("");

  // 입력값이 없고 포커스도 없을 때만 타이프라이터 작동.
  // 한 글자씩 타이핑 → 1.4초 대기 → 한 글자씩 삭제 → 다음 예시.
  // AbortController로 React StrictMode 이중 실행 및 cleanup race를 엄격히 차단.
  useEffect(() => {
    if (!examples || examples.length === 0) return;
    if (value || focused) {
      setTyped("");
      return;
    }

    const ctrl = new AbortController();
    const { signal } = ctrl;
    let idx = 0;

    const run = async () => {
      try {
        while (!signal.aborted) {
          const word = examples[idx % examples.length];
          for (let i = 1; i <= word.length; i++) {
            if (signal.aborted) return;
            setTyped(word.slice(0, i));
            await wait(90, signal);
          }
          await wait(1400, signal);
          if (signal.aborted) return;
          for (let i = word.length; i >= 0; i--) {
            if (signal.aborted) return;
            setTyped(word.slice(0, i));
            await wait(45, signal);
          }
          await wait(300, signal);
          idx++;
        }
      } catch {
        /* aborted */
      }
    };
    run();
    return () => {
      ctrl.abort();
    };
  }, [examples, value, focused]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const shownPlaceholder = examples && examples.length && !value && !focused
    ? typed || placeholder
    : placeholder;

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      role="search"
    >
      <input
        ref={inputRef}
        className={styles.input}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={shownPlaceholder}
        aria-label={ariaLabel}
        spellCheck={false}
        autoComplete="off"
      />
    </form>
  );
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
