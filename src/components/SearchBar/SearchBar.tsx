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
  useEffect(() => {
    if (!examples || examples.length === 0) return;
    if (value || focused) {
      setTyped("");
      return;
    }

    let cancelled = false;
    let idx = 0;

    const run = async () => {
      while (!cancelled) {
        const word = examples[idx % examples.length];
        for (let i = 1; i <= word.length; i++) {
          if (cancelled) return;
          setTyped(word.slice(0, i));
          await wait(90);
        }
        await wait(1400);
        if (cancelled) return;
        for (let i = word.length; i >= 0; i--) {
          if (cancelled) return;
          setTyped(word.slice(0, i));
          await wait(45);
        }
        await wait(300);
        idx++;
      }
    };
    run();
    return () => {
      cancelled = true;
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

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
