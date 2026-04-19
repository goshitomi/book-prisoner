# Book-Prisoner 종합 버그/이슈 감사 보고서

작성일: 2026-04-19
대상 커밋: 로컬 작업 트리 (`/mnt/book-prisoner`)
스택: Next.js 14.2.15 App Router, React 18, TypeScript 5.5, Vercel KV, Zod

---

## TL;DR — 요약

타입 에러는 없고(`tsc --noEmit` 통과), 치명적인 런타임 크래시도 없지만 **"검색 결과가 안 보이는 것처럼 느껴지는" 가장 큰 체감 이슈의 주범은 검색 API 자체가 아니라 CSS 애니메이션**입니다. 페이지 로드 후 **약 4.2초간 검색바·제목이 투명**하고 테이블은 **1.6초 후부터 2.5초에 걸쳐 위→아래로 서서히 드러나**기 때문에, 결과가 "나타나지 않는다"고 보입니다. 추가로 NL API 응답 필터링 로직이 실제 응답 형태와 어긋나면서 일부 정상 데이터가 표시 대상에서 탈락하고 있고, 듀얼 커서는 "OS 커서 + JS 고스트 커서"가 동시에 렌더링되는 이원 구조라 좌우 모양이 필연적으로 달라집니다. 그 외 데드 코드, 캐시 버전 불일치, 모바일 대응 전무 등 구조적 이슈가 11건 더 있습니다.

아래는 **원인 → 해결** 순서로 심각도(🔴 Critical / 🟠 High / 🟡 Medium / 🔵 Low)를 붙여 정리한 내용입니다.

---

## 🔴 ISSUE 1. "검색 결과가 나타나지 않음"처럼 보이는 가장 큰 원인 — 진입 애니메이션이 너무 길고 검색 결과 페이지에도 그대로 적용됨

### 증상

- 홈(`/`)은 물론이고 `?q=...` 검색 결과 페이지에서도 **검색바+"List of Books" 타이틀이 처음 4.2초 동안 화면에 없음** (opacity 0).
- 테이블은 **1.6초 후부터 2.5초에 걸쳐 위→아래로 clip-path로 드러남**. 즉 로드 후 최소 **4.1초까지는 결과가 거의 보이지 않음**.
- 페이지네이션으로 이동하거나 새로고침할 때마다 애니메이션이 처음부터 재생되므로, 검색 결과가 "뜨지 않는 것"처럼 보임.

### 원인 (코드 위치)

`src/components/BookPanel/BookPanel.module.css`

```css
.leading { ... animation: drawFade 0.6s ... 4.2s both; }   /* 4.2초 지연 */
.table   { ... animation: tableReveal 2.5s ... 1.6s both; } /* 1.6초 지연 + 2.5초 재생 */
```

`PrisonerPanel.module.css`도 동일합니다. 그리고 **검색 결과 페이지에서도 그대로 재사용**되기 때문에, 검색 후 첫 인상이 "빈 화면"처럼 느껴집니다. `page.tsx`의 `export const dynamic = "force-dynamic"` 때문에 매 요청마다 SSR이 다시 돌아서 애니메이션이 매번 처음부터 재생됩니다.

### 해결

1. **애니메이션을 '초기 진입' 때만 적용**하고 검색 결과 페이지에서는 생략:

   ```tsx
   // LandingShell.tsx
   const isFirstLoad = !params.get("q") && data.page === 1;
   // 해당 class를 condition으로 붙이거나, BookPanel에 prop 전달
   <BookPanel ... animated={isFirstLoad} />
   ```

2. **지연을 축소**: `4.2s` → `0.3s`, `1.6s` → `0.1s`, `2.5s` → `0.6s` 정도로 확 줄여도 전시의 극적 효과는 유지됩니다.

3. `prefers-reduced-motion` 분기에 더해, 결과가 비어 있지 않으면 **처음 1회만** 재생되도록 `sessionStorage` 플래그를 사용:

   ```tsx
   useEffect(() => {
     if (sessionStorage.getItem("intro-played")) return;
     document.documentElement.dataset.introPlaying = "1";
     const t = setTimeout(() => {
       delete document.documentElement.dataset.introPlaying;
       sessionStorage.setItem("intro-played", "1");
     }, 4600);
     return () => clearTimeout(t);
   }, []);
   ```

---

## 🔴 ISSUE 2. `/api/search`, `/api/book/[isbn]` 두 라우트가 **완전한 데드 코드**이며 캐시 버전이 서로 다름

### 증상

서버에서 데이터 로딩은 `src/app/page.tsx`의 `loadSearch()`와 `src/app/book/[isbn]/page.tsx`의 `loadPair()`가 직접 담당하고 있는데, **동일 로직이 `src/app/api/search/route.ts`와 `src/app/api/book/[isbn]/route.ts`에도 중복 구현**되어 있습니다. 그리고 두 파일의 KV 캐시 키 버전이 서로 다릅니다.

### 원인

```ts
// page.tsx
const cacheKey = query ? `v3:search:...` : `v3:newbooks:...`;

// api/search/route.ts
const cacheKey = query ? `v2:search:...` : `v2:newbooks:...`;
```

프로젝트 내 어디에서도 `/api/search`를 `fetch`하는 코드가 없습니다 (`grep /api/search src/` → 0 matches). `/api/book/[isbn]`도 동일. 즉 두 파일은 **호출자가 없는 데드 라우트**이면서 동시에 **캐시 키 버전이 어긋난 사본**으로 존재하고 있습니다. 이 상태가 방치되면 배포 이후 언젠가 한쪽이 "최신"으로 잘못 판단되어 수정되면서 UI용 페이지와 엇박자 버그가 나올 가능성이 큽니다.

### 해결

1. **권장**: 두 라우트 파일을 삭제하고, 공통 로직을 `src/lib/search/loadSearch.ts`, `src/lib/search/loadPair.ts`로 추출해 `page.tsx`와 `book/[isbn]/page.tsx`에서 공유. 캐시 키 버전도 한 곳에서만 관리.
2. 만약 외부 연동(e.g. 아카이브/모니터링)이 이미 `/api/search`를 쓰고 있다면, API 라우트가 내부 공통 loader를 `import`해서 호출하도록 **얇은 래퍼로 리팩터**.

---

## 🟠 ISSUE 3. NL API 응답에 실제 존재하는 필드(`mediaName`, `typeName`)를 기반으로 한 "도서 여부" 필터가 과도하게 좁음

### 증상

검색 결과 중 ISBN이 빈 문자열인 항목(특정 고서/희귀자료/합본)은 전부 탈락하고, 여러 판본의 ISBN이 공백으로 묶여 들어오는 대하소설 시리즈는 첫 ISBN 하나로 통합되면서 실질적으로 1건처럼 보임. 사용자 입장에서는 "NL 사이트에서는 보이는데 내 사이트에선 안 보이는" 항목이 생김.

### 원인 (코드 위치: `src/lib/api/nl.ts`)

실제 API 응답에서 확인된 특성:

- `result` 키 자체가 **없을 수도 있음** (`total: 0`일 때). Zod `optional().default([])`로 방어는 돼 있음. ✓
- `titleInfo`는 `<span class="searching_txt">...</span>` 하이라이트 포함. `stripHighlight()`로 처리 중. ✓
- `isbn` 필드는 빈 문자열 또는 공백으로 이어붙인 여러 ISBN. 예:

  ```
  isbn: "9788957073629 9788957073636 9788957073643 ... 9788957073728"
  ```

문제는 `isBookLike()`:

```ts
const isbnDigits = item.isbn.replace(/[^0-9Xx]/g, "");
const hasIsbn13 = /^(978|979)\d{10}$/.test(isbnDigits);
```

공백이 제거되어 `isbnDigits`가 39자리 이상이 되므로 `hasIsbn13`이 항상 `false`. 그 아래 키워드 필터로 간신히 통과합니다.

그리고 마지막 조건:

```ts
return Boolean(item.isbn); // "" 면 탈락
```

때문에 ISBN이 비어 있는 고서·특수자료가 전부 탈락합니다. NL 사이트에서는 이런 자료도 결과에 뜨기 때문에, "국립중앙도서관과 같은 검색 결과가 나오지 않는다"는 체감으로 이어집니다.

### 해결

```ts
// 1) 공백으로 구분된 다중 ISBN 문자열에서 하나라도 ISBN-13이면 도서로 인정
function isBookLike(item): boolean {
  const tokens = item.isbn.replace(/-/g, " ").split(/\s+/).filter(Boolean);
  const hasIsbn13 = tokens.some((t) => /^(97[89])\d{10}$/.test(t));
  const hasIsbn10 = tokens.some((t) => /^\d{9}[\dXx]$/.test(t));
  if (hasIsbn13 || hasIsbn10) return true;

  const tag = `${item.media_name} ${item.type_name}`.toLowerCase();
  if (NON_BOOK_KEYWORDS.some((kw) => tag.includes(kw.toLowerCase()))) return false;

  // 2) ISBN이 없어도 typeName이 '도서'이고 mediaName이 '인쇄자료'면 통과
  const isPrintBook =
    item.type_name?.includes("도서") &&
    item.media_name?.includes("인쇄자료");
  return isPrintBook;
}
```

추가로 `BookPanel` 쪽 `rowKey` 생성에서 `isbn13 || callNo || \`${title}-${idx}\``를 이미 쓰고 있으므로, ISBN 없는 행도 안전하게 렌더링됩니다. 상세 페이지는 ISBN-13이 필수지만 ISBN 없는 행은 클릭 비활성으로 처리하면 됩니다:

```tsx
onClick={book.isbn13 ? onActivate : undefined}
style={{ cursor: book.isbn13 ? "pointer" : "default" }}
aria-disabled={!book.isbn13}
```

---

## 🟠 ISSUE 4. `pageSize * 5` 로 신착도서를 샘플링하는데 NL API는 pageSize 상한이 있음

### 증상

홈(랜딩)에서 신착 느낌을 주려고 더 많이 가져와 중복 제거 후 상위 N개를 보여주는 전략. `PAGE_SIZE=30` × 5 = **pageSize=150** 요청. NL openAPI는 `pageSize` 상한이 문서상 100으로 알려져 있어, 150을 요청하면 응답은 최대 100개만 반환되는 경우가 있습니다. 즉 5배 샘플링이 의도대로 되지 않고 3.3배 정도가 됨 → 중복 제거 후 부족분이 생기면 페이지당 30개가 안 찰 수 있음.

### 원인 (코드 위치: `src/lib/api/nl.ts`)

```ts
qs.set("pageSize", String(pageSize * 5));
```

### 해결

1. 다중 페이지 페칭으로 바꾸기: `Promise.all([request(p1, 100), request(p2, 100)])` 식으로 100·100으로 2회 호출 후 합치기.
2. 또는 `pageSize`를 100으로 클램프하고, 모자라면 `pageNum+1`로 2-3번만 더 부르기.
3. 키워드 "대한민국"에 대한 의존도도 낮추기. 현재 이 키워드가 장르 편향을 만들고 있음 — "신착"이라고 이름 붙였지만 실제로는 "대한민국 들어간 책 중 regDate DESC"임. `seq=RECENT` 같은 신착 전용 정렬이 없는 API 한계는 있으나, 서로 다른 키워드 2-3개를 라운드로빈으로 돌려 샘플링 편향을 완화하는 것이 더 자연스럽습니다.

---

## 🔴 ISSUE 5. 좌/우 커서가 다르게 보이는 문제 — OS 커서와 JS 고스트가 이원 렌더링되는 구조적 결함

### 증상 (사용자 직접 보고)

왼쪽 패널과 오른쪽 패널의 커서 모양이 다르게 표시됨. 특히 링크·버튼 위에서 한쪽은 손가락 모양, 다른 쪽은 아예 커서가 없거나 다른 모양으로 나타남.

### 원인

1. **`globals.css`에 `body { cursor: none; }`이 없음.** 따라서 실제 OS 시스템 커서는 어디서나 렌더링됩니다.
2. `DualCursor.tsx`는 "반대쪽 패널"에 SVG 고스트 커서를 `position: fixed`로 그림.
3. 결과적으로 렌더링되는 커서는:

   | 위치                 | 활성 패널 (마우스 실제 위치)                      | 반대 패널 (고스트)                                 |
   | -------------------- | ------------------------------------------------- | -------------------------------------------------- |
   | 기본                 | OS 화살표                                         | SVG 화살표                                         |
   | 텍스트 위            | OS I-beam                                         | SVG I-beam                                         |
   | 버튼/링크 위         | OS 손가락 pointer                                 | **opacity 0 (안 보임)** ← `isInteractive` 분기    |
   | 구분선 위            | OS `col-resize` ↔                                | 구분선 자체는 반대편에 없어 `elementFromPoint` 무의미 |

   즉 **고스트 커서는 "화살표"/"I-beam" 2종뿐**이고, 인터랙티브 요소 위에서는 아예 숨겨집니다. 반면 OS 커서는 손가락, col-resize, grab, text, zoom 등 상황별로 다양한 모양을 씁니다. 태생적으로 좌우가 일치할 수 없는 설계.

4. `allowSystemCursor`라는 클래스 마커가 `SplitScreen`/`Pagination`에 붙어 있지만 **CSS에 해당 셀렉터 정의가 없어서 아무 효과도 없음**. 과거 설계의 잔재로 보임.

### 해결 (3가지 전략 중 택 1)

#### 전략 A — "고스트는 완전히 OS 커서를 모방하도록 확장"하고 OS 커서는 숨김 (가장 극적, 전시 모드 적합)

1. `globals.css`에 추가:
   ```css
   html, body { cursor: none; }
   .allowSystemCursor, .allowSystemCursor * { cursor: revert; }
   ```
   이제 `SplitScreen handle`과 `Pagination`에서만 OS 커서가 나타남.

2. `DualCursor`에 2개의 커서 DOM을 렌더링 (메인 + 고스트). 메인은 실제 마우스 위치, 고스트는 반대편. 두 커서 모두 같은 상태 분기를 공유:
   ```tsx
   const state = detectCursorState(el); // "pointer" | "text" | "resize" | "default"
   ```
   `elementFromPoint`로 얻은 엘리먼트의 `getComputedStyle(el).cursor`를 읽어 분기하면 실제 CSS `cursor: *`와 완벽히 동기화됩니다.

3. SVG 아이콘을 4종 이상 확장: `default` / `pointer` / `text` / `col-resize` / `grab`.

#### 전략 B — "고스트 포기, OS 커서만 사용" (가장 안전, 버그 0)

1. `DualCursor` 컴포넌트를 삭제 또는 기본 OFF.
2. 대신 `HoverSyncContext`로 반대편 행만 하이라이트되는 현재 동작은 유지.
3. 전시장 기계에서만 `NEXT_PUBLIC_ENABLE_DUAL_CURSOR=true`로 켜는 식.

#### 전략 C — "고스트는 보조 효과로만"

1. `DualCursor`를 "반대 패널 안에만" 반투명한 링/도트로 렌더링 (모양 차이 자체를 없앰):
   ```css
   .ghost { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #000; background: transparent; opacity: 0.5; }
   ```
2. 모양 판별 로직 제거. 단순 위치 미러링만.
3. OS 커서는 그대로 두어 기능 훼손 없음.

전시 프로젝트의 성격상 전략 A가 가장 맥락에 맞지만, 구현 복잡도가 높습니다. 빠른 해결을 원하면 전략 B→C 순서로 권장.

---

## 🟠 ISSUE 6. SSR/클라이언트 간 `swapped` 상태 깜빡임

### 증상

`localStorage.getItem("overdue.swapped")`이 `"1"`인 상태에서 페이지를 새로고침하면 **서버 렌더는 기본(book-prisoner) 배치**로 나갔다가, `useEffect`에서 `setSwapped(true)`가 호출되면서 한 프레임 뒤에 좌/우가 뒤집히는 깜빡임이 발생합니다.

### 원인 (코드 위치: `src/app/LandingShell.tsx`, `src/app/book/[isbn]/DetailShell.tsx`)

```tsx
const [swapped, setSwapped] = useState(false);
useEffect(() => {
  const saved = localStorage.getItem(SWAP_STORAGE_KEY);
  if (saved === "1") setSwapped(true);
}, []);
```

### 해결

1. `cookie`로 대체 + SSR에서 읽기:
   ```tsx
   // page.tsx (server component)
   import { cookies } from "next/headers";
   const swapped = cookies().get("overdue.swapped")?.value === "1";
   return <LandingShell data={data} initialSwapped={swapped} />;
   ```

2. 또는 첫 렌더 직전에 블로킹 스크립트로 `html[data-swapped="1"]` 속성을 주입하고 CSS로 분기(테마 다크모드 FOUC 방어와 동일 기법):
   ```tsx
   // layout.tsx
   <script dangerouslySetInnerHTML={{
     __html: `try{if(localStorage.getItem("overdue.swapped")==="1")document.documentElement.dataset.swapped="1"}catch(e){}`,
   }} />
   ```

---

## 🟠 ISSUE 7. 반응형(모바일/태블릿) 대응이 전혀 없음

### 증상

- `grid-template-columns: calc(100vw * var(--left-ratio)) 1fr`에 모바일 브레이크포인트 없음.
- 6열 테이블(`th:nth-child(n) { width: 26/11/19/11/15/18% }`)을 375px 기기에서 보면 각 셀이 20~45px로 눌려 완전히 뭉개짐.
- 제목·입력창·페이지네이션도 데스크톱 전용 패딩·폰트 크기만 정의돼 있음.

### 원인 (코드 위치 전반)

`grep @media`로 확인한 결과 **`prefers-reduced-motion` 외에는 어떤 뷰포트 브레이크포인트도 없음**.

### 해결

1. 최소한의 모바일 대응:
   ```css
   @media (max-width: 768px) {
     .root { grid-template-columns: 1fr !important; height: auto; }
     .panel:nth-child(2) { border-top: 2px solid #000; }
     .splitLine, .handle, .DualCursor { display: none; }
   }
   ```

2. 테이블은 모바일에서 카드 스택으로 전환:
   ```css
   @media (max-width: 768px) {
     .table, .table tbody, .table tr, .table td { display: block; width: 100%; }
     .table thead { display: none; }
     .table td::before { content: attr(data-label); ... }
   }
   ```
   각 `<td>`에 `data-label="표제"` 등 추가 필요.

3. `DualCursor`는 `(hover: none)` 미디어쿼리로 이미 비활성화되므로 모바일에서 추가 조치 불필요.

---

## 🟡 ISSUE 8. Seoji + data4library 배치 페치의 장애 전파 / 성능 병목

### 증상

- 페이지당 30개 아이템 각각에 Seoji 1회 + data4library 1회 호출. `CONCURRENCY=5`, `AbortSignal.timeout(8000)`.
- KV 캐시 미구성 + 첫 방문 = 최악의 경우 `ceil(30/5) × 2 × 8s = 96s` 동안 SSR 대기 가능.
- 로컬 개발에서는 `.env.local`에 KV 환경변수가 없기 때문에 매번 원천 API로 페치됨 → 개발 속도 저하.

### 원인 (코드 위치: `src/lib/api/nlSeoji.ts`, `src/lib/api/data4library.ts`)

- 두 파일이 완전히 동일한 `runWithLimit`을 각자 정의 (DRY 위반).
- `next: { revalidate }`와 `kvGet/kvSet`이 동시에 걸려 있음 → Next 기본 fetch 캐시 + KV. 이중.

### 해결

1. `runWithLimit`를 `src/lib/utils/concurrency.ts`로 빼고 공유.
2. Seoji/D4L 둘 다 `AbortSignal.timeout(5000)`으로 축소. 어차피 실패 시 null 허용이므로 5초 컷이 안전.
3. SSR 블로킹을 피하려면 **쉘 먼저 렌더 → 이미지/부가정보는 RSC Suspense 또는 클라이언트 streaming으로 분리**:
   ```tsx
   // page.tsx
   <Suspense fallback={<SkeletonTable />}>
     <EnrichedRows skeleton={skeleton} />
   </Suspense>
   ```
4. KV 미구성 로컬 개발은 LRU 인메모리 폴백 추가:
   ```ts
   const mem = new Map<string, { v: unknown; exp: number }>();
   if (!isKvConfigured()) { /* 인메모리 분기 */ }
   ```

---

## 🟡 ISSUE 9. 접근성 — 가상 테이블 구조와 상세 행의 `aria-hidden`

### 증상

- 테이블 각 "행 그룹"이 `<tbody>`로 되어 있음 (한 `<table>` 안에 `<thead>` 하나 + `<tbody>` 30개). HTML 스펙은 허용하지만 스크린리더가 "테이블 30개"로 읽어 혼란.
- 호버 시 펼쳐지는 상세 행이 `<tr className={styles.detail} aria-hidden="true">`로 항상 숨겨짐. **키보드/스크린리더 사용자는 상세 정보 접근 불가**.
- `tabIndex={0} onClick` 으로 커스텀 버튼화된 `<tr>`:
  - `onKeyDown={(e) => { if (e.key === "Enter") onActivate(); }}` — **Space 키 미지원** (버튼 컨벤션 위반).
  - `role="button"` 미지정으로 스크린리더는 그냥 "row"라고 읽음.
- `globals.css`:
  ```css
  :focus { outline: none; }
  :focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  ```
  `:focus-visible` 미지원 구 브라우저(크게 문제되진 않음)에서는 포커스 링이 완전히 사라짐.

### 해결

1. `<tbody>` 남발 대신 상세 영역은 별도 `<details>/<summary>` 패턴으로 분리하거나, 상세는 키보드로도 토글 가능한 단일 `<tr>`로 하고 `aria-expanded`/`aria-controls`로 연결.
2. 행 클릭은 `<a>` 래퍼로 바꾸고 `<Link href={"/book/"+isbn}>` 사용 — 키보드/Space/Enter/새 탭 열기(⌘+클릭) 모두 무료로 얻음:
   ```tsx
   <tr className={styles.main}>
     <td>
       <Link href={`/book/${book.isbn13}`} className={styles.rowLink}>
         <div className={styles.title}>{book.title}</div>
       </Link>
     </td>
     ...
   </tr>
   ```
3. `:focus { outline: none }` 라인 제거하거나 최소한 키보드 포커스 스타일 보존:
   ```css
   :focus:not(:focus-visible) { outline: none; }
   ```
4. h1은 상세 페이지에만 있음. 랜딩 페이지의 `<h2>"List of Books"`를 시각적 디자인은 유지하되 `<h1>`로 승격 고려.

---

## 🟡 ISSUE 10. 탭 타이틀 애니메이션이 탭 전환/북마크 제목을 오염

### 증상

`document.title`을 `"B"`, `"Bo"`, `"Boo"`…로 삭제/복원 반복. 탭을 나가 있다가 돌아오면 순간 제목이 공백으로 보이고, 탭이 백그라운드 상태일 때 브라우저가 북마크·알림 제목을 그 순간의 값으로 캐싱하는 경우 있음.

### 원인 (코드 위치: `src/app/LandingShell.tsx`)

```ts
document.title = FULL.slice(0, pos); // 한 글자씩 줄여갔다 복구
```

### 해결

1. 애니메이션 지속 시간 축소 + "원복 시점"에 확실히 풀 타이틀로 복귀 (`stop()` 내부에 이미 있음 — OK이지만 `onVis`에서 `visible`일 때만 `stop()` 호출되므로, 중간에 탭 전환 없이 오래 방치하면 삭제 사이클 중 프레임이 북마크화될 수 있음).
2. 보수적 대안: 탭이 `hidden`일 때만 `(⚠) Book as Prisoner` 같은 고정 prefix를 붙이고, 실시간 타이핑 대신 3초 주기로 2-state 토글. 더 안전하고 예측 가능.

---

## 🟡 ISSUE 11. `extractIsbn13`의 잠재적 오변환

### 증상

`convertIsbn10To13`은 항상 `"978"` 프리픽스를 붙이는데, 일부 데이터 소스(특히 정리되지 않은 DB 덤프)에서 이미 ISBN-13이 아닌 "979로 변환된 가짜 ISBN-10"을 ISBN 필드에 넣어놓는 경우가 드물게 있음. 이 경우 잘못된 ISBN-13이 생성될 수 있음.

### 해결

현 NL API 응답에서는 거의 발생 안 하지만, 방어적으로 체크섬 검증 추가:

```ts
function convertIsbn10To13(isbn10: string): string {
  const d = isbn10.replace(/[^0-9Xx]/gi, "").slice(0, 9);
  if (d.length !== 9) return "";
  // ISBN-10 체크섬 먼저 검증
  const full10 = d + isbn10.replace(/[^0-9Xx]/gi, "").slice(9, 10);
  if (!validateIsbn10Checksum(full10)) return "";
  // ...이후 978 변환
}
```

ROI가 낮은 이슈이므로 우선순위 낮음.

---

## 🟡 ISSUE 12. `useSearchParams` 의 `<Suspense>` 경계 없음 (Next 14 경고 대상)

### 증상

`LandingShell`과 `Pagination`이 모두 `useSearchParams()`를 사용. Next 14에서는 이 훅을 쓰는 클라이언트 컴포넌트는 가장 가까운 부모에 `<Suspense>`가 필요합니다. 현재 경로 `app/layout.tsx → page.tsx → LandingShell(client)` 구조에서 Suspense 경계가 없어 **빌드 시 "deopted into client-side rendering" 경고**가 나며, 정적 최적화가 비활성화됩니다 (지금은 `force-dynamic`이라 체감은 없지만 정리 필요).

### 해결

```tsx
// page.tsx
import { Suspense } from "react";
...
return (
  <Suspense fallback={null}>
    <LandingShell data={data} />
  </Suspense>
);
```

---

## 🔵 ISSUE 13. 사용 안 하는 `Header` 컴포넌트

`src/components/Header/Header.tsx` 는 어디에서도 `import` 되지 않습니다 (`grep Header src/` → 해당 파일만 매치). 삭제 또는 `LandingShell`에서 직접 쓰는 헤더 구조로 통합 권장.

---

## 🔵 ISSUE 14. `.env.local`에 실제 API 키가 평문으로 저장됨

`.env.local`이 `.gitignore`에 들어 있는지 반드시 확인. 이 파일을 실수로 커밋하면 `NL_API_KEY`, `DATA4LIB_API_KEY`가 전시/오픈소스용 저장소에 영구 노출될 수 있습니다. `git log -- .env.local`로 히스토리에 노출 여부도 함께 확인 바랍니다.

`tsconfig.tsbuildinfo`(85KB)도 같이 `.gitignore`에 추가.

### 해결

```
# .gitignore
.env*.local
*.tsbuildinfo
.next/
```

---

## 🔵 ISSUE 15. `runWithLimit` 중복 구현 (2회)

`src/lib/api/nlSeoji.ts`와 `src/lib/api/data4library.ts`에 동일한 `runWithLimit` 함수가 두 벌 정의되어 있습니다. `src/lib/utils/concurrency.ts`로 추출해 재사용.

---

## 🔵 ISSUE 16. 페이지네이션 클릭 시 SPA 이동이 아닌 풀 SSR 재실행

`page.tsx`에 `export const dynamic = "force-dynamic"`이 걸려 있기 때문에 `Pagination.tsx`의 `router.push`가 발생할 때마다 페이지 전체가 서버에서 다시 렌더됨. 유저 체감 지연이 큼.

### 해결

- 검색/페이지네이션은 URL 쿼리 파라미터로 구분되므로, `force-dynamic`을 제거하고 `revalidate`를 분 단위로 (e.g. `export const revalidate = 600;`) 설정. 캐시 경로가 달라지면 자연스럽게 새 응답.
- 또는 검색 결과만 클라이언트-사이드 fetch + SWR로 이관.

---

## 🔵 ISSUE 17. `HoverSync` 레이스와 호버 누수

마우스가 행 사이를 빠르게 지나갈 때 `onMouseLeave`가 다음 `onMouseEnter`보다 늦게 발화하면 `hoveredKey`가 `null`로 덮일 수 있음 (짧은 플리커). `setHovered(null)` 이전에 `requestAnimationFrame` 한 틱 지연 또는 "현재 행이 내가 맞을 때만 null로 지우기" 패턴으로 방어 가능:

```tsx
onMouseLeave={() => setHovered((cur) => (cur === rowKey ? null : cur))}
```

---

## 🔵 ISSUE 18. `SearchBar` 타이프라이터 이펙트의 `for-await` 루프와 StrictMode

`useEffect` 안에서 `while (!cancelled)` 루프 + `await wait()`. React 18 StrictMode 개발 모드에서 effect가 2번 실행되면 **두 개의 타이프라이터 루프가 겹쳐** 글자가 빠르게 깜빡이는 현상이 드물게 나타남. `cancelled`로 방어는 하지만 첫 effect의 `wait(90)` 중간에 cleanup이 호출되면 두 번째 effect가 동시에 또 한 번 `setTyped`를 쏨. 실전 영향은 작으나 개발 환경에서 거슬리면 `AbortController` 기반으로 더 엄격히 제어.

---

## 🔵 ISSUE 19. 에러 페이지의 "다시 시도"가 즉시 같은 에러를 반복할 가능성

`error.tsx`의 `reset()`은 동일 요청을 그대로 다시 수행하므로, 업스트림 NL/d4l이 장애인 경우 사용자가 버튼을 눌러도 같은 화면을 반복해서 보게 됨. 지수 백오프(3s, 7s, 15s) 후 시도하는 UX가 안전:

```tsx
const [cooldown, setCooldown] = useState(0);
// reset 시 setCooldown(3); setInterval로 감소; 버튼 disabled until 0
```

---

## ✅ 정상 동작으로 확인된 부분

- `tsc --noEmit` 통과 (TypeScript 0 에러).
- `/api/image` 프록시의 allowlist 기반 SSRF 방어 (단, 응답 Content-Type 화이트리스트는 추가해도 좋음: `if (!ct.startsWith("image/")) return 400`).
- `kvGet/kvSet`의 no-op degrade (KV 미구성 시도 앱이 죽지 않음).
- Zod `.passthrough()` + `.optional().default([])`로 NL 응답 변이에 대한 기본 방어는 되어 있음.
- 다크 레드 accent (`--color-accent: #ff2e2e`) + 대비도 4.5:1 이상으로 WCAG AA 본문 대비 만족 (흰 바탕 + 빨강 뱃지 한정).

---

## 권장 우선순위 (2주 스프린트 가정)

| 순위 | 이슈                              | 예상 공수       | 영향                               |
| ---- | --------------------------------- | --------------- | ---------------------------------- |
| 1    | #1 애니메이션 지연 축소 / 1회 재생 | 반나절          | 체감 "결과 안 보임" 전면 해소      |
| 2    | #2 데드 라우트 정리 + 캐시 버전 통일 | 반나절          | 배포 후 엇박자 버그 방지           |
| 3    | #5 듀얼 커서 전략 결정 (A/B/C)    | 1일~3일         | 좌/우 모양 불일치 해결             |
| 4    | #3 NL 필터 완화                   | 반나절          | 누락 결과 회복                     |
| 5    | #7 모바일 레이아웃                | 1~2일           | 접근 가능한 사용자 범위 확대       |
| 6    | #6 swap 깜빡임                    | 2시간           | FOUC 제거                          |
| 7    | #9 접근성 개선                    | 1일             | 키보드/SR 사용자 대응              |
| 8    | #8 Seoji/D4L 성능                 | 1일             | 초기 로딩 단축                     |
| 9    | 나머지 low-severity               | 2시간 합계      | 코드 품질 상향                     |

---

## 부록 — 각 버그의 재현 체크리스트

1. 이슈 #1: 브라우저 throttle "Slow 3G" 상태에서 `/`접속 → 상단 2초, 테이블 1.6–4.1초 지연 확인.
2. 이슈 #3: `/` + ISBN 비어있는 고서로 알려진 키워드(e.g. "조선왕조실록 영인본")로 검색 → NL 사이트 결과수와 본 사이트 결과수 비교.
3. 이슈 #5: 왼쪽 패널의 행 위에 마우스 올림 → 오른쪽 패널 같은 좌표에서 고스트 커서 표시 확인 → 링크에 올림 → 오른쪽 고스트 사라짐 확인.
4. 이슈 #6: 스와프 토글 후 새로고침 → 첫 프레임에서 원래 순서로 보이고 다음 프레임에 뒤집히는 깜빡임 캡처.
5. 이슈 #7: `375×667` 뷰포트에서 `/` 로드 → 테이블 붕괴 확인.
6. 이슈 #10: 탭을 백그라운드로 보내고 다시 전환 → 제목이 잠깐 한 글자만 보이는 프레임 캡처.

