"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./AutoCursor.module.css";

const IDLE_RESUME_MS = 60_000;

type Signal = AbortSignal;

interface CursorAPI {
  setVisible: (v: boolean) => void;
  pos: () => { x: number; y: number };
  setPos: (x: number, y: number) => void;
  pulse: () => void;
}

interface RouterLike {
  push: (href: string) => void;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function wait(ms: number, signal: Signal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const id = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function animate(
  duration: number,
  signal: Signal,
  step: (t: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      if (signal.aborted) {
        cancelAnimationFrame(raf);
        return reject(new DOMException("Aborted", "AbortError"));
      }
      const t = Math.min(1, (now - t0) / duration);
      try {
        step(t);
      } catch {
        /* ignore */
      }
      if (t >= 1) {
        signal.removeEventListener("abort", onAbort);
        resolve();
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    const onAbort = () => {
      cancelAnimationFrame(raf);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    raf = requestAnimationFrame(tick);
  });
}

async function waitForSelector(
  selector: string,
  signal: Signal,
  timeoutMs = 6000,
): Promise<HTMLElement | null> {
  const t0 = performance.now();
  while (!signal.aborted) {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el) return el;
    if (performance.now() - t0 > timeoutMs) return null;
    await wait(120, signal);
  }
  return null;
}

async function waitForPathname(
  test: (p: string) => boolean,
  signal: Signal,
  timeoutMs = 6000,
): Promise<boolean> {
  const t0 = performance.now();
  while (!signal.aborted) {
    if (test(window.location.pathname)) return true;
    if (performance.now() - t0 > timeoutMs) return false;
    await wait(120, signal);
  }
  return false;
}

function findButtonByText(text: string): HTMLButtonElement | null {
  const buttons = Array.from(document.querySelectorAll("button"));
  for (const b of buttons) {
    if ((b.textContent || "").trim() === text) return b as HTMLButtonElement;
  }
  return null;
}

function dispatchHoverIn(target: Element) {
  target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
  target.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false, cancelable: true }));
}
function dispatchHoverOut(target: Element) {
  target.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, cancelable: true }));
  target.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false, cancelable: true }));
}

async function tweenTo(
  api: CursorAPI,
  x: number,
  y: number,
  duration: number,
  signal: Signal,
) {
  const start = api.pos();
  const dx = x - start.x;
  const dy = y - start.y;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
  await animate(duration, signal, (t) => {
    const e = easeInOut(t);
    api.setPos(start.x + dx * e, start.y + dy * e);
  });
}

async function tweenToElement(
  api: CursorAPI,
  el: Element,
  signal: Signal,
  duration?: number,
) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + Math.min(r.height / 2, 24);
  const cur = api.pos();
  const dist = Math.hypot(cx - cur.x, cy - cur.y);
  const dur = duration ?? Math.min(1200, Math.max(420, dist * 1.4));
  await tweenTo(api, cx, cy, dur, signal);
}

async function typeIntoInput(
  input: HTMLInputElement,
  text: string,
  signal: Signal,
) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) return;
  let current = "";
  // 시작 시 비우기
  setter.call(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  for (const ch of text) {
    if (signal.aborted) return;
    current += ch;
    setter.call(input, current);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(90 + Math.random() * 60, signal);
  }
}

// ----- 시나리오 -----

async function scenarioHoverScan(api: CursorAPI, signal: Signal) {
  if (window.location.pathname !== "/") return;
  const rows = Array.from(document.querySelectorAll('tbody[data-hovered]')).slice(0, 4);
  if (rows.length === 0) return;
  let prev: Element | null = null;
  for (const tbody of rows) {
    if (signal.aborted) return;
    const tr = tbody.querySelector("tr") as HTMLElement | null;
    if (!tr) continue;
    await tweenToElement(api, tr, signal);
    if (prev && prev !== tbody) dispatchHoverOut(prev);
    dispatchHoverIn(tbody);
    prev = tbody;
    await wait(750, signal);
  }
  if (prev) dispatchHoverOut(prev);
}

async function scenarioScrollList(api: CursorAPI, signal: Signal) {
  if (window.location.pathname !== "/") return;
  const left = document.querySelector('[data-panel="left"]') as HTMLElement | null;
  if (!left) return;
  const rect = left.getBoundingClientRect();
  const targetY = rect.top + rect.height - 60;
  await tweenTo(api, rect.left + rect.width / 2, targetY, 700, signal);
  await wait(200, signal);
  const max = left.scrollHeight - left.clientHeight;
  if (max <= 4) return;
  const dest = Math.min(max, 700);
  await animate(1300, signal, (t) => { left.scrollTop = dest * easeOut(t); });
  await wait(900, signal);
  await animate(1100, signal, (t) => { left.scrollTop = dest * (1 - easeOut(t)); });
}

async function scenarioDragSplitter(api: CursorAPI, signal: Signal) {
  if (window.location.pathname !== "/") return;
  const handle = document.querySelector('[role="separator"]') as HTMLElement | null;
  if (!handle) return;
  const rect = handle.getBoundingClientRect();
  const y = rect.top + rect.height / 2;
  const w = window.innerWidth;
  await tweenTo(api, rect.left + rect.width / 2, y, 700, signal);
  api.pulse();
  await wait(220, signal);
  const dispatchRatio = (r: number) => {
    window.dispatchEvent(new CustomEvent("autocursor:setratio", { detail: r }));
  };
  const sweep = async (from: number, to: number, ms: number) => {
    await animate(ms, signal, (t) => {
      const r = from + (to - from) * easeInOut(t);
      dispatchRatio(r);
      api.setPos(r * w, y);
    });
  };
  const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
  const a = rand(0.6, 0.78);
  const b = rand(0.22, 0.4);
  const final = rand(0.3, 0.7);
  await sweep(0.5, a, 900);
  await wait(380, signal);
  await sweep(a, b, 1100);
  await wait(380, signal);
  await sweep(b, final, 800);
}

async function scenarioReverse(api: CursorAPI, signal: Signal) {
  const btn = document.querySelector('button[aria-label="좌우 패널 교체"]') as HTMLButtonElement | null;
  if (!btn) return;
  btn.scrollIntoView({ behavior: "smooth", block: "center" });
  await wait(650, signal);
  await tweenToElement(api, btn, signal);
  api.pulse();
  btn.click();
  await wait(1500, signal);
  const btn2 = document.querySelector('button[aria-label="좌우 패널 교체"]') as HTMLButtonElement | null;
  if (!btn2) return;
  btn2.scrollIntoView({ behavior: "smooth", block: "center" });
  await wait(500, signal);
  await tweenToElement(api, btn2, signal);
  api.pulse();
  btn2.click();
  await wait(900, signal);
}

async function scenarioSort(api: CursorAPI, signal: Signal) {
  if (window.location.pathname !== "/") return;
  const ths = Array.from(document.querySelectorAll("thead th")) as HTMLElement[];
  if (ths.length === 0) return;
  const th = ths[Math.floor(Math.random() * ths.length)];
  await tweenToElement(api, th, signal);
  api.pulse();
  th.click();
  await wait(900, signal);
}

async function scenarioOpenDetail(
  api: CursorAPI,
  router: RouterLike,
  signal: Signal,
) {
  if (window.location.pathname !== "/") return;
  const tbodies = document.querySelectorAll('tbody[data-hovered]');
  if (tbodies.length === 0) return;
  const tbody = tbodies[Math.min(2, tbodies.length - 1)];
  const tr = tbody.querySelector("tr") as HTMLElement | null;
  if (!tr) return;
  tr.scrollIntoView({ behavior: "smooth", block: "center" });
  await wait(500, signal);
  await tweenToElement(api, tr, signal);
  dispatchHoverIn(tbody);
  await wait(450, signal);
  api.pulse();
  tr.click();
  const ok = await waitForPathname((p) => p.startsWith("/book/"), signal, 6000);
  if (!ok) return;
  await runDetailLoanFlow(api, router, signal);
}

async function scenarioSearch(
  api: CursorAPI,
  router: RouterLike,
  signal: Signal,
) {
  if (window.location.pathname !== "/") return;
  const input = document.querySelector('input[type="search"]') as HTMLInputElement | null;
  if (!input) return;
  await tweenToElement(api, input, signal);
  api.pulse();
  input.focus();
  await wait(220, signal);
  const term = "새로운 질서";
  await typeIntoInput(input, term, signal);
  await wait(450, signal);
  router.push(`/?q=${encodeURIComponent(term)}`);
  await wait(900, signal);
  const firstTr = await waitForSelector('tbody[data-hovered] tr', signal, 7000);
  if (!firstTr) return;
  await wait(500, signal);
  const tbody = firstTr.parentElement!;
  firstTr.scrollIntoView({ behavior: "smooth", block: "center" });
  await wait(500, signal);
  await tweenToElement(api, firstTr, signal);
  dispatchHoverIn(tbody);
  await wait(550, signal);
  api.pulse();
  (firstTr as HTMLElement).click();
  const ok = await waitForPathname((p) => p.startsWith("/book/"), signal, 6000);
  if (!ok) return;
  await runDetailLoanFlow(api, router, signal);
}

async function runDetailLoanFlow(
  api: CursorAPI,
  router: RouterLike,
  signal: Signal,
) {
  await wait(900, signal);
  const loanBtn =
    findButtonByText("대출 신청") ?? findButtonByText("면회 신청");
  if (!loanBtn) {
    router.push("/");
    await waitForPathname((p) => p === "/", signal, 5000);
    return;
  }
  loanBtn.scrollIntoView({ behavior: "smooth", block: "center" });
  await wait(500, signal);
  await tweenToElement(api, loanBtn, signal);
  api.pulse();
  loanBtn.click();
  await wait(1700, signal);
  // 오버레이 안의 홈 링크가 등장할 시간을 주고 위치로 이동(시각적으로만)
  const overlayHome = document.querySelector(
    'div[role="dialog"] a[href="/"]',
  ) as HTMLElement | null;
  if (overlayHome) {
    await tweenToElement(api, overlayHome, signal);
    api.pulse();
  }
  router.push("/");
  await waitForPathname((p) => p === "/", signal, 5000);
  await wait(800, signal);
}

// ----- 메인 컴포넌트 -----

export function AutoCursor() {
  const router = useRouter();
  const cursorRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    pos: { x: 0, y: 0 },
    abort: null as AbortController | null,
    resumeTimer: null as number | null,
    paused: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cursor = cursorRef.current;
    if (!cursor) return;

    const clamp = (v: number, lo: number, hi: number) =>
      Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : (lo + hi) / 2;

    const api: CursorAPI = {
      setVisible: (v) => cursor.setAttribute("data-visible", v ? "1" : "0"),
      pos: () => stateRef.current.pos,
      setPos: (x, y) => {
        const cx = clamp(x, -40, window.innerWidth + 40);
        const cy = clamp(y, -40, window.innerHeight + 40);
        stateRef.current.pos.x = cx;
        stateRef.current.pos.y = cy;
        cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      },
      pulse: () => {
        cursor.setAttribute("data-press", "1");
        window.setTimeout(() => cursor.setAttribute("data-press", "0"), 380);
      },
    };

    api.setPos(window.innerWidth / 2, window.innerHeight / 2);

    const routerLike: RouterLike = { push: (href) => router.push(href) };

    const startLoop = () => {
      if (stateRef.current.abort) return;
      const ctrl = new AbortController();
      stateRef.current.abort = ctrl;
      api.setVisible(true);
      void mainLoop(api, routerLike, ctrl.signal).catch(() => {
        /* aborted */
      });
    };

    const stopLoop = () => {
      const ctrl = stateRef.current.abort;
      if (ctrl) {
        ctrl.abort();
        stateRef.current.abort = null;
      }
      api.setVisible(false);
    };

    const scheduleResume = () => {
      if (stateRef.current.resumeTimer) {
        window.clearTimeout(stateRef.current.resumeTimer);
      }
      stateRef.current.resumeTimer = window.setTimeout(() => {
        stateRef.current.paused = false;
        startLoop();
      }, IDLE_RESUME_MS);
    };

    const onRealInput = () => {
      stateRef.current.paused = true;
      stopLoop();
      scheduleResume();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!e.isTrusted) return;
      onRealInput();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!e.isTrusted) return;
      onRealInput();
    };
    const onTouchStart = (e: TouchEvent) => {
      if (!e.isTrusted) return;
      onRealInput();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.isTrusted) return;
      if (e.key !== "=") return;
      onRealInput();
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    // 초기 가동을 잠깐 지연시켜 첫 페이지 렌더 완료 후 시작.
    const bootTimer = window.setTimeout(() => startLoop(), 1800);

    return () => {
      window.clearTimeout(bootTimer);
      if (stateRef.current.resumeTimer) {
        window.clearTimeout(stateRef.current.resumeTimer);
        stateRef.current.resumeTimer = null;
      }
      stopLoop();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [router]);

  return (
    <div ref={cursorRef} className={styles.cursor} aria-hidden="true" data-visible="0" data-press="0">
      <svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M3 2 L3 18 L7.2 14 L9.6 19.5 L12.2 18.4 L9.8 13 L15.5 13 Z"
          fill="#000"
          stroke="#fff"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      <span className={styles.pulse} aria-hidden="true" />
    </div>
  );
}

async function mainLoop(api: CursorAPI, router: RouterLike, signal: Signal) {
  // 시나리오 인덱스를 sessionStorage에 보관해 일시정지 후 재개 시 다음 동작으로 이어진다.
  const KEY = "autoCursor.scenarioIdx";
  const scenarios: Array<(api: CursorAPI, signal: Signal) => Promise<void>> = [
    scenarioHoverScan,
    scenarioScrollList,
    scenarioDragSplitter,
    scenarioSort,
    scenarioReverse,
    (a, s) => scenarioOpenDetail(a, router, s),
    (a, s) => scenarioSearch(a, router, s),
  ];

  while (!signal.aborted) {
    // 비정상 상태(상세 페이지 잔류)에서 재개되면 홈으로 복귀.
    if (window.location.pathname.startsWith("/book/")) {
      router.push("/");
      await waitForPathname((p) => p === "/", signal, 5000);
      await wait(700, signal);
    }

    // 첫 행이 등장할 때까지 대기.
    await waitForSelector('tbody[data-hovered]', signal, 8000);

    let idx = 0;
    try {
      idx = parseInt(sessionStorage.getItem(KEY) ?? "0", 10) || 0;
    } catch {
      /* ignore */
    }
    const scenario = scenarios[idx % scenarios.length];
    try {
      await scenario(api, signal);
    } catch {
      if (signal.aborted) return;
    }
    try {
      sessionStorage.setItem(KEY, String((idx + 1) % scenarios.length));
    } catch {
      /* ignore */
    }
    await wait(1400, signal);
  }
}
