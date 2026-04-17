# Book Prisoner — 수정 기획서 (plan.md)

> 대상 사이트: https://book-prisoner.vercel.app/
> 작성 목적: `feedback.md`에 정리된 버그 및 잠재 이슈를 해결하기 위한 단계별 구현 플랜
> 전제 조건: **데스크톱(마우스) 전용**. 모바일 / 터치스크린 대응은 의도적으로 제외한다.

---

## 0. 작업 우선순위 요약

| 순위 | 항목 | 영향 범위 | 난이도 | 파일 |
|------|------|-----------|--------|------|
| P0 | 1.5 표제 데이터 폴백 오류 | 콘텐츠 정확성 | 낮음 | `src/lib/mapBookToPrisoner.ts`, `BookPanel` |
| P0 | 1.2 커서·슬라이더 UI 원복 | 시각 전역 | 낮음 | `DualCursor`, `SplitScreen`, `globals.css` |
| P1 | 1.1 듀얼 커서 좌표 매핑 재설계 | 핵심 인터랙션 | 중간 | `DualCursor` |
| P1 | 1.3 페이지네이션 복구 | 데이터 탐색 | 중간 | `Pagination`, `api`, `page.tsx` |
| P2 | 1.4 스왑 레이아웃 붕괴 | 레이아웃 | 중간 | `SplitScreen`, `SyncScroll` |
| P2 | 2.1 스크롤 동기화 무한 루프 | 안정성 | 중간 | `SyncScroll` |
| P2 | 2.2 Zero-Result 처리 | UX 예외 | 낮음 | `page.tsx`, `SearchBar`, `api` |

> 권장 순서: **P0 → P1 → P2**. P0 두 건은 구조 변경 없이 즉시 반영 가능하므로 단독 커밋으로 먼저 정리한다.

---

## 1. 즉시 수정 항목 (User Feedback)

### 1.1 듀얼 커서 — 상대 좌표 매핑으로 전환

**현재 문제**
- 좌/우 패널 사이에 데칼코마니(좌우 반전) 방식으로 동작 → 좌측 표제에 커서를 올려도 우측에서는 대응되는 수감자명 위에 오지 않음.

**목표 동작**
- 좌측 패널의 특정 "상대 위치(%)"를 우측 패널 동일 상대 위치에 투영.
- 공식:
  - 마우스가 좌측에 있을 때:
    `x_right = W_left + (mouseX_inLeft / W_left) × W_right`
  - 마우스가 우측에 있을 때:
    `x_left = (mouseX_inRight / W_right) × W_left`
  - Y축은 **뷰포트 좌표 그대로 유지**(동기 스크롤이 Y를 이미 맞추므로 불필요한 재계산 제거).

**구현 체크리스트**
- [ ] `DualCursor` 내부 데칼코마니(`W - x`) 계산 로직 제거.
- [ ] `ResizeObserver`로 `W_left`, `W_right`를 실시간 추적. `--left-ratio` 변화에도 즉시 반영.
- [ ] 좌·우 스왑 상태(row-reverse)에서도 "마우스가 속한 패널"을 `event.target.closest('[data-panel]')` 기반으로 판정 (좌표가 아닌 DOM 기준).
- [ ] 스크롤 오프셋 반영: `y_ghost = mouseY + (scrollTop_other - scrollTop_active)` 로 동기 스크롤 이후 상대 행 위치가 틀어지지 않도록 보정.
- [ ] 커서 렌더링은 `pointer-events: none` 유지, `translate3d`로 GPU 합성.

**검수 기준**
- 좌측 3번째 행 표제 위에 마우스를 올리면 우측 3번째 행 수감자명 위에 고스트 커서가 위치.
- 슬라이더로 비율을 30:70, 70:30으로 바꿔도 좌표가 어긋나지 않음.
- 스왑(좌우 반전) 후에도 동일하게 동작.

---

### 1.2 커서 & 슬라이더 UI 원복

**목표**
- **커서**: 원형 커스텀 커서 삭제 → 시스템 기본 포인터.
- **슬라이더**: 중앙 분할선에 붙어있는 원형 Knob 제거 → 드래그 가능한 얇은 분할선만 남김.

**구현 체크리스트**
- [ ] `globals.css` / 해당 컴포넌트의 `cursor: none;`, `cursor: url(...)` 룰 제거.
- [ ] `DualCursor`의 "내 쪽 패널 커서" 렌더링 삭제. 반대편에 투영되는 **고스트 커서만 유지**(1.1 동작의 시각적 단서).
- [ ] `SplitScreen` 분할 핸들에서 `::before/::after`로 그려지는 원형 Knob 제거.
- [ ] 분할 핸들 `hitbox`는 유지(예: width 1px 시각, 8px 클릭 영역) — 시각은 얇게, 잡기는 쉽게.
- [ ] 드래그 중에만 `cursor: col-resize`.

**검수 기준**
- 기본 화살표 포인터가 전역에서 그대로 보임.
- 중앙 분할선이 일자 라인 형태이며, 원형 UI 없음.

---

### 1.3 페이지네이션 복구

**현재 문제**
- 스크롤로 다음 페이지 전환 안 됨. 이동 컨트롤 부재.

**요구 사양**
- 페이지당 **20건 고정**.
- 리스트 하단 중앙에 **번호 기반 페이지네이션** (`‹ 1 2 3 … 10 ›`).
- 페이지 변경 시 좌/우 패널 스크롤을 **최상단으로 리셋**.

**구현 체크리스트**
- [ ] `src/lib/api` 국중(국립중앙도서관) API 호출부에서 `pageSize=20` 명시. 현재 하드코딩된 값이 있다면 `constants.ts`로 중앙화.
- [ ] 응답에서 `totalCount`(또는 `total`)를 받아 `totalPages = Math.ceil(total / 20)` 계산.
- [ ] URL 쿼리 `?page=n&q=...` 동기화 → 새로고침·공유 시 상태 보존.
- [ ] `Pagination` 컴포넌트:
  - 번호 버튼, `‹ ›` 이동, `…` 축약(현재 페이지 기준 ±2 노출).
  - 첫/마지막 페이지에서 이전/다음 비활성화.
- [ ] 페이지 변경 핸들러 내에서 `leftPanelRef.current?.scrollTo({top:0})`, `rightPanelRef.current?.scrollTo({top:0})` 실행 (동기 스크롤 플래그를 잠시 꺼서 핑퐁 방지 — 2.1 참고).
- [ ] 로딩 상태: 기존 카드 자리를 skeleton 20개로 대체(레이아웃 점프 방지).

**검수 기준**
- 기본 상태에서 20건 노출.
- 페이지 버튼 클릭 시 상단으로 리셋되며 새 20건이 즉시 보임.
- URL에 `?page=3`이 남으며 새로고침해도 3페이지가 그대로 뜸.

---

### 1.4 좌/우 스왑 시 UI 붕괴 수정

**현재 문제**
- 스왑(`row-reverse`) 시 내부 정렬 어긋남, 스크롤 동기 플래그 꼬임.

**구현 체크리스트**
- [ ] `SplitScreen`에서 레이아웃을 `flex-direction: row-reverse`로 뒤집지 말고, **데이터 prop만 교체**하는 방식으로 전환:
  - `swapped` 상태값 + `panels = swapped ? [right, left] : [left, right]`
  - DOM 순서와 시각 순서를 일치시켜 CSS 부작용 제거.
- [ ] 패널 ref를 "좌/우 물리적 위치" 기준(`panelARef`, `panelBRef`)으로 유지하고, "책 / 수감자" 데이터는 상태로 주입.
- [ ] `isSyncing` 플래그는 **어느 패널이 스왑되든 공용**이 되도록 `useRef<boolean>` 단일 값으로 관리.
- [ ] 1.1 좌표 매핑은 "데이터 역할"이 아닌 "물리 좌표 A→B" 기준으로 돌아가도록 재정렬.

**검수 기준**
- 스왑 버튼 연타해도 컨텐츠 정렬, 동기 스크롤, 고스트 커서 위치가 깨지지 않음.

---

### 1.5 표제 데이터 출력 오류

**현재 문제**
- 실제 제목 대신 "책"이라는 하드코딩 텍스트가 노출됨 → 폴백 우선순위 오류.

**구현 체크리스트**
- [ ] `mapBookToPrisoner.ts` (또는 `lib/fallback`)에서 title 결정 순서를 다음으로 명시:
  1. `nlkBook.title`
  2. `nlkBook.titleInfo`
  3. `nlkBook.bookname`
  4. (모두 없을 때) 문자열 `"제목 미상"` — **"책" 금지**
- [ ] `BookPanel` 렌더링부에서 `title || "책"` 같은 인라인 폴백 제거.
- [ ] 잘못 주입될 수 있는 개발용 시드 데이터(`fallback/` 하위)에서 `"책"` 리터럴을 grep 후 전부 제거.

**검수 기준**
- "김영하", "박완서" 등 실제 검색 시 표제가 정상 출력.
- 빈 값에도 "책"이 뜨지 않음.

---

## 2. 심층 분석 — 잠재 이슈 보강

### 2.1 스크롤 동기화 무한 루프 방지

**가설된 루프**
1. 좌 패널 스크롤 → onScroll 발생 → 우 패널 프로그램적 스크롤
2. 우 패널 스크롤 이벤트 → 다시 좌 패널 프로그램적 스크롤
3. 미세한 반올림 오차 누적 → 화면 떨림.

**대책**
- [ ] **활성 스크롤 소유자 패턴**: `activeScroller: 'left' | 'right' | null` 을 `useRef`로 관리. onScroll 시 "활성 소유자가 아니면 무시".
- [ ] 소유권 해제는 `requestAnimationFrame` 또는 `setTimeout(..., 0)` 으로 다음 tick에 수행(중첩 호출 방어).
- [ ] 스왑/페이지 변경 시 `activeScroller = null` 강제 초기화.
- [ ] 스크롤 비율로 동기화할지, 절대 픽셀로 동기화할지 결정(카드 높이가 좌/우 다를 수 있으므로 **비율 기반** 권장):
  - `scrollRatio = scrollTop / (scrollHeight - clientHeight)`
  - 반대편: `other.scrollTop = scrollRatio * (other.scrollHeight - other.clientHeight)`

---

### 2.2 검색 결과 0건 처리

**구현 체크리스트**
- [ ] API 응답에서 `total === 0`일 때:
  - 좌/우 패널 상단에 `검색하신 "<쿼리>"에 해당하는 도서는 존재하지 않습니다.` 문구 표시.
  - 하단에 **추천 영역**으로 신규 도서 20건(최신 등록순) 로드.
- [ ] 추천 데이터는 기존 리스트 API를 `sort=recent&pageSize=20`으로 재사용.
- [ ] 페이지네이션은 추천 영역에서는 **숨김**(검색이 0건이면 "페이지"라는 개념이 무의미).
- [ ] 문구 위치는 분할선 양쪽에 각각 노출(좌: 도서 기준 문구, 우: 수감자 기준 문구 — 톤 일관).

**UX 문구 샘플**
- 좌: `"<쿼리>"에 해당하는 도서를 찾지 못했습니다. 대신 최근 입고된 도서를 보여드릴게요.`
- 우: `대응되는 수감자 기록이 없습니다. 아래 신규 수감자 목록을 확인해 주세요.`

---

## 3. 공통 리팩터링 & 정리

- [ ] **상수화**: `PAGE_SIZE = 20`, `SPLIT_MIN_RATIO = 0.2`, `SPLIT_MAX_RATIO = 0.8` 등을 `src/lib/constants.ts`로 이동.
- [ ] **`--left-ratio` CSS 변수**를 `SplitScreen`에서만 단일 진실 원천으로 관리. 자식은 읽기만.
- [ ] **Dead code 제거**: 원형 커서 / 원형 Knob 관련 CSS, 데칼코마니 계산 로직.
- [ ] **타입 강화**: `Book`, `Prisoner`, `MappedRow` 타입을 `lib/types.ts`에 정리하고 선택적 필드 명확화(표제 폴백 근거).

---

## 4. 수동 QA 시나리오 (배포 전 필수)

1. 검색창에 "한강" 입력 → 20건 노출 + 페이지 버튼 확인.
2. 페이지 3 클릭 → 상단 리셋 + URL `?page=3` 반영.
3. 좌측 5번째 행 표제에 마우스 → 우측 5번째 행에 고스트 커서 위치 일치.
4. 슬라이더를 25% / 75%로 이동 → 고스트 커서 여전히 정확.
5. 스왑 버튼 5회 연타 → 레이아웃/스크롤/커서 모두 정상.
6. 검색어 "asdkfjha" → Zero-Result 문구 + 추천 20건 노출.
7. 임의 도서 제목이 "책"으로 표시되지 않음을 10건 랜덤 확인.
8. 좌 패널을 빠르게 스크롤 → 우 패널이 동기 이동, 떨림/역진 없음.

---

## 5. 데이터 집계 로직 재검토 (aggregateBookData)

> 대상 파일: `src/app/api/search/route.ts`, `src/lib/api/nl.ts`, `src/lib/api/nlSeoji.ts`, `src/lib/api/data4library.ts`, `src/lib/mapBookToPrisoner.ts`, `src/lib/utils/isbn.ts`
> 원칙: **국중(NL) = 마스터 DB, 정보나루(data4library) / 국중 서지(Seoji) = 보강(enrichment)**. 키는 `ISBN13`.

### 5.1 현재 파이프라인 요약

1. `searchNL` → 국중 오프라인자료 검색(`NLRawItem[]` skeleton + total).
2. skeleton에서 ISBN 추출 → `sanitizeIsbn` → 13자리 필터.
3. `fetchSeojiBatch(isbns)` + `fetchBookEnrichment(isbns)` 병렬 호출(ISBN 단건씩 `Promise.allSettled`).
4. skeleton을 순회하며 `seojiMap[isbn]`·`enrichmentMap[isbn]`으로 **좌측 조인(left join)** → `normalizeBook` → `mapBookToPrisoner`.

### 5.2 검출된 이슈 (심각도 순)

#### 🔴 H1. ISBN 키 신뢰성 붕괴 (`sanitizeIsbn`의 `slice(0,13)`)

```ts
// utils/isbn.ts
export function sanitizeIsbn(raw) {
  return raw.replace(/[-\s]/g, "").slice(0, 13);
}
```

- 국중 `isbn` 필드는 종종 `"8932917245 9788932917245"` (ISBN10 + ISBN13 공백 구분) 또는 `"9788932917245 set"`처럼 다중 값이 들어옴.
- 공백/하이픈만 제거한 뒤 단순히 앞 13자로 자르면:
  - `"8932917245 9788932917245"` → `"89329172459788"` → **완전히 잘못된 ISBN**.
  - `"9788932917245 9788932917252"` → 앞 책의 ISBN만 살아남고 뒤는 사라짐(정합은 되지만 dedup 안 됨).
- 결과: 서지/정보나루 **매칭 miss → 이미지·페이지·판형 모두 누락** → 수감자 카드가 "형량 불명 / 신장 불명"으로 뜸.
- **수정**: 공백으로 split 후 각 토큰에서 `/^\d{13}$/` 또는 `/^\d{10}$/`를 매칭, 13자리 우선 선택. ISBN10만 있으면 ISBN13으로 변환(앞 `978` + 체크섬 재계산).

```ts
// 제안 유틸
export function extractIsbn13(raw: string): string {
  if (!raw) return "";
  const tokens = raw.replace(/[-]/g, " ").split(/\s+/).filter(Boolean);
  const isbn13 = tokens.find((t) => /^\d{13}$/.test(t));
  if (isbn13) return isbn13;
  const isbn10 = tokens.find((t) => /^\d{9}[\dXx]$/.test(t));
  return isbn10 ? convertIsbn10To13(isbn10) : "";
}
```

#### 🔴 H2. 중복 ISBN (복본) 미제거

- 국중은 동일 ISBN의 소장 복본을 별도 레코드로 반환하는 경우가 잦음 → 20건 중 같은 책이 2~3회 뜸.
- 현재 코드: skeleton 순서 그대로 `pairs` 생성 → UI에 중복 카드.
- **수정**: skeleton 생성 직후 `ISBN13 + title` 기준 dedup. 빈 ISBN은 `title+author`로 dedup.

```ts
const seen = new Set<string>();
const unique = skeleton.filter((b) => {
  const key = extractIsbn13(b.isbn) || `${b.title_info}|${b.author_info}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
```

#### 🟠 M1. "마스터 DB = 국중" 원칙 위배 (reg_date 우선순위)

```ts
// search/route.ts
normalizeBook(raw, seoji, enrichment.bookImageURL ?? raw.image_url ?? null,
              enrichment.reg_date ?? null);
```
```ts
// mapBookToPrisoner.ts
registrationDate: registrationDate || formatRegDate(nl.reg_date) || null,
```

- `enrichment.reg_date`(정보나루 등록일)를 우선, 국중 `reg_date`는 후순위. 원칙과 반대.
- 의미도 다름: 정보나루 reg_date = 정보나루 시스템 등록일, 국중 reg_date = 국중 소장 등록일. "수감일(= 국중에 처음 들어온 날)" 은유에는 **국중이 더 정확**.
- **수정**: 국중 `reg_date` 우선, 정보나루는 폴백.
  ```ts
  registrationDate: formatRegDate(nl.reg_date) ?? enrichment.reg_date ?? null
  ```

#### 🟠 M2. 이미지 소스 단일화 — silent fallback 문제

- `raw.image_url`은 실전에서 거의 항상 빈 문자열(국중 openApi는 표지 이미지 URL을 주지 않음).
- 따라서 `mugshot`은 사실상 정보나루(`bookImageURL`)에 전적으로 의존.
- 정보나루가 실패(키 누락·401·timeout·해당 ISBN 없음) 시 `mugshot: null` → UI에 플레이스홀더만 남음. 관측 불가.
- **수정**:
  - [ ] 정보나루 hit율을 로깅(예: `console.info("[d4l] hit", hit, "/", total)`).
  - [ ] `DATA4LIB_API_KEY` 미설정 시 기동 시 경고 로그.
  - [ ] 추가 폴백 체인 고려: 네이버 책 API 또는 Aladin `cover` URL(있다면) — 선택 사항.

#### 🟠 M3. 검색 결과 0건 → "책" 키워드 재검색 (1.5 이슈의 실제 원흉 후보)

```ts
// nl.ts fetchNLNewBooks 2차 폴백
fallbackQs.set("kwd", "책");
```

- 1.5에서 언급된 "하드코딩된 '책'"은 **화면에 뿌려지는 제목**이 아니라, **폴백 검색어**일 가능성이 높음.
- 정렬이 무시돼 1차 시도가 빈 배열이면 `kwd=책`으로 재검색 → 제목에 "책"이 들어간 책들이 다수 반환 → **사용자가 "표제 자리에 '책'이 하드코딩된 것처럼 보인다"** 고 인식한 오해.
- **수정**: 2차 폴백을 `kwd="책"`이 아니라 **광범위 카테고리 조회**(예: `category=도서 + systemType=오프라인자료 + 최근 reg_date 범위`)로 전환. 또는 고정 추천 ISBN 리스트(`src/lib/fallback/curated-isbns.json`)에서 가져오기.

```ts
// 대안
const curated = await fetchSeojiBatch(CURATED_ISBNS);
return CURATED_ISBNS.map((isbn) => seojiToNLRaw(curated[isbn])).filter(Boolean);
```

#### 🟠 M4. rate limit / 동시성 과다

- `fetchSeojiBatch`와 `fetchBookEnrichment`가 각각 20건을 `Promise.allSettled`로 동시 호출 → 요청당 총 **외부 API 40건 동시**.
- 국중 서지 API는 같은 cert_key로 초당 요청 수 제한이 있음(문서상 20 qps 수준). 캐시 miss가 집중된 페이지에서 **429 / silent timeout** 위험.
- **수정**:
  - [ ] 동시성 제한(p-limit 같은 경량 세마포어 혹은 수동 청크, 예: 5 병렬).
  - [ ] `AbortSignal.timeout(4000)` 을 8000ms 정도로 상향(저녁 피크 타임에 끊김 많음).
  - [ ] 실패 건은 카운터로 집계해 응답에 `enrichmentCoverage: 0.85` 같은 진단 필드 포함(개발 모드 한정).

#### 🟡 L1. ISBN 없는 레코드의 카드화

- skeleton 중 ISBN이 비거나 13자리가 안 되는 건도 `pairs`에 포함 → `residentId: "주민번호 불명"`, `mugshot: null`로 뜸.
- 도메인 은유상 "주민번호 불명"은 있을 수 있지만, 이미지·페이지·판형이 모두 없는 카드는 UX적으로 빈 껍데기.
- **정책 선택**:
  - (A) drop: ISBN13이 없으면 pair에서 제외 → 페이지당 20건 보장 깨질 수 있음(서버에서 더 가져와 보충 필요).
  - (B) keep + 시각적 다운그레이드: 카드에 "기록 미상" 오버레이, 반대편 카드도 동일 스타일.
- 권장: **B**. 마스터 DB 원칙 유지 + 사용자 혼선 방지.

#### 🟡 L2. `normalizeBook` 필드 조인 순서

```ts
title: (nl.title_info || seoji.TITLE || "").trim() || "제목 미상",
authors: (nl.author_info || seoji.AUTHOR || "").trim() || "저자 미상",
publisher: (nl.pub_info || seoji.PUBLISHER || "").trim(),
publicationYear: extractYear(nl.pub_year_info || seoji.PUBLISH_PREDATE),
```

- 원칙(국중 우선) 일치 ✅.
- 하지만 국중 `title_info`는 `stripHighlight` 후 빈 문자열로 떨어질 수 있음(하이라이트 태그만 있는 응답). 이 경우 seoji로 내려가므로 정상 동작.
- `publisher`는 공백 제거 후 `""`이어도 빈 문자열을 리턴 → `mapBookToPrisoner.birthInstitution`에서 `book.publisher || "출생기관 불명"`로 처리 → OK.
- **개선**: 값이 `""`일 때와 `null`일 때를 Book 레벨에서 통일(모두 `null`)해 상단 로직이 단순해지게.

#### 🟡 L3. 캐시 키 이스케이프 & 버전링

- `search:${query}:${page}` — 쿼리에 콜론/공백/한글이 그대로 들어감. kv 백엔드에 따라 충돌 가능.
- **수정**: `encodeURIComponent(query)` + 버전 프리픽스.
  ```ts
  const cacheKey = `v2:search:${encodeURIComponent(query)}:${page}`;
  ```
- 데이터 구조(`BookPrisonerPair`) 변경 시 `v2 → v3`로 올려 구버전 캐시를 자연 만료.

#### 🟡 L4. 에러 단일 catch로 전체 fallback

- `searchNL`이 throw하면 전체 응답이 `prisoners.json` 스태틱으로 대체됨.
- 국중만 죽고 정보나루는 살아있는 경우 정보나루 단독 모드를 만들기는 어려움(정보나루는 키워드 검색 API가 빈약) → 현 구현이 현실적.
- 단, **로그를 Sentry/console에 명확히 남겨야** 운영 중 국중 장애를 빠르게 인지 가능.

### 5.3 리팩터된 `aggregateBookData` 제안 시그니처

`search/route.ts` 안에 인라인된 조인 로직을 순수 함수로 분리:

```ts
// src/lib/aggregateBookData.ts
export interface AggregateDeps {
  fetchSeojiBatch: (isbns: string[]) => Promise<Record<string, Partial<NLSeojiRawItem>>>;
  fetchEnrichment: (isbns: string[]) => Promise<Record<string, D4LBookDetail>>;
}

export async function aggregateBookData(
  skeleton: NLRawItem[],
  deps: AggregateDeps,
): Promise<{ pairs: BookPrisonerPair[]; coverage: { seoji: number; d4l: number } }> {
  // 1) ISBN 추출 (extractIsbn13, 다중 토큰 대응)
  // 2) skeleton dedup (ISBN13 또는 title|author)
  // 3) 병렬 조회 (동시성 제한 p=5)
  // 4) left join + normalize + map
  // 5) coverage 계산
}
```

장점:
- 테스트 가능(fixture로 국중·서지·정보나루 응답을 주입).
- `search/route.ts`는 흐름 제어만 담당.
- 동일 로직을 `/api/book/[isbn]` 단건 엔드포인트에서도 재사용.

### 5.4 즉시 반영 체크리스트

- [ ] `extractIsbn13` 유틸 신설, `sanitizeIsbn`의 `slice(0,13)` 제거.
- [ ] skeleton dedup.
- [ ] `normalizeBook`에서 `registrationDate` 우선순위 역전(국중 우선).
- [ ] `fetchNLNewBooks`의 `kwd=책` 2차 폴백 제거 또는 curated ISBN으로 대체.
- [ ] 외부 API 동시성 제한(5 병렬) + 타임아웃 8000ms 상향.
- [ ] 캐시 키 `encodeURIComponent` + `v2:` 프리픽스.
- [ ] 응답에 `coverage` 디버그 필드(개발 모드).
- [ ] ISBN 없는 레코드의 UI 다운그레이드 정책 결정(A/B).

---

## 6. 디자인 피드백 반영 (designfeedback.md)

> 출처: `designfeedback.md`
> 방향: 화면 전체를 **단일 톤의 백색 + 검정 3px 분할선 + 12px 평문** 중심 타이포그래피로 재편. 흑/백 듀얼톤과 호버 반전 효과 제거.

### 6.1 헤더 재설계 — **Reverse의 영향권에서 분리**

**핵심**
- 현재 `Header`는 `SplitScreen`과 동일한 `--left-ratio` grid를 따라가며, `swapped`에 따라 좌/우 컴포넌트까지 재배치됨. → Reverse 버튼을 누르면 헤더도 같이 뒤집힘.
- 피드백 요구사항: **제목 / 검색창 / Reverse 버튼**이 Reverse 토글과 **무관하게 고정 위치**에 있어야 함.

**구현 체크리스트**
- [ ] `Header.tsx`에서 `swapped` prop 제거(또는 무시). `bookSide` / `prisonerSide` 2분할 구조 삭제.
- [ ] 헤더를 단일 `<header>`로 재구성:
  - 좌측: `Book as Prisoner` (타이틀)
  - 중앙: `<SearchBar />`
  - 우측: `Reverse` 토글 버튼
  - 또는 세 요소를 **헤더 중앙에 한 덩어리로 정렬**(요구사항은 "헤더 중앙에 보기 좋게" — 실제 배치 예시는 아래 6.2 참고).
- [ ] `Header.module.css`에서 `--left-ratio` 기반 `grid-template-columns` 제거 → `display: flex; justify-content: center; gap: …` 단일 축 배치.
- [ ] `SplitScreen`의 `row-reverse` 또는 데이터 swap(4.1 결론에 따름)이 헤더에 침투하지 않도록 DOM 상 헤더는 **SplitScreen 바깥**에 유지(이미 그렇게 돼 있음 — CSS만 독립시키면 됨).
- [ ] 헤더 높이 64px 유지, `position: fixed` 유지, `backdrop-filter` 제거(배경이 백색으로 단일화되므로 불필요).

**레이아웃 배치 안 (택1)**
- **안 A — 중앙 집중형**: `[Book as Prisoner] [Search] [Reverse]` 세 요소를 헤더 중앙에 수평 정렬. 요구사항의 "세 요소 모두 헤더 중앙에"에 가장 가까움.
- **안 B — 3분할 유지**: 좌/중앙/우에 각각 배치하되 Reverse와 무관하게 고정. 넓은 해상도에서 균형이 좋음.
- 권장: **안 A**. 문서 뉘앙스와 미니멀 타이포 방향 일치.

### 6.2 카피 & 문구 교체

| 위치 | 현재 | 변경 |
|------|------|------|
| 타이틀 | `책은 죄수다` + `OVERDUE` | `Book as Prisoner` (단일) |
| 검색 placeholder | `수감자 성명 또는 주민등록번호(ISBN)` | `Search` |
| 검색 제출 버튼 | `조회` | 삭제 (엔터로만 제출) 또는 `Search` 아이콘 단독 |
| Reverse 버튼 | `書 ↔ 囚` | `Reverse` |
| aria-label | 그대로 유지 (접근성) | 변경 불요 |

**구현 체크리스트**
- [ ] `Header.tsx` 제목 `<Link>` 내부 `책은 죄수다` / `OVERDUE` 제거 → `Book as Prisoner` 단일 텍스트.
- [ ] `SearchBar.tsx` placeholder → `Search`. `<button>조회</button>`는 시각적으로 숨기거나 제거(`type="submit"`만 남기고 엔터 제출).
- [ ] `Header.tsx`의 `<button>` 내 `書 ↔ 囚` → `Reverse`.
- [ ] `aria-label`은 한국어로 유지(스크린리더 UX 손실 방지) — 버튼 시각 텍스트만 영문화.

### 6.3 타이포그래피 — Univers Next Pro 600

**웹폰트 적용**
- CDNFonts 링크: `https://www.cdnfonts.com/univers-next-pro.font`
- **주의**: CDNFonts는 비공식 재배포이며 라이선스 리스크가 있음. 상용/공개 서비스라면 Monotype/Linotype 정식 라이선스 구매가 안전. 피드백 지시에 따라 일단 적용하되, 별도 경고 포함 권장.

**구현 체크리스트**
- [ ] `src/app/layout.tsx`의 `<head>`(또는 `globals.css` 최상단 `@import`)에 CDNFonts URL 추가:
  ```html
  <link href="https://fonts.cdnfonts.com/css/univers-next-pro" rel="stylesheet">
  ```
- [ ] `globals.css`에서 `--font-en` 변수 갱신:
  ```css
  --font-en: "Univers Next Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;
  ```
- [ ] 가중치 600을 기본값으로 쓰기 위해 body / 주요 텍스트에 `font-weight: 600` 적용. 단, 본문 12px에서 600은 다소 두껍게 읽힐 수 있으므로 실제 렌더링 테스트 후 조정.
- [ ] 한글도 같은 폰트 스택에서 대체 → Noto Sans KR은 유지(한글은 Univers에 글리프가 없음).
- [ ] `font-display: swap` 확보(CDN CSS에 이미 포함되어 있는지 확인).

### 6.4 글자 크기 / 색상 / 투명도 정책

**규칙**
- **크기**: 타이틀 `Book as Prisoner`를 제외한 **모든 영/국문 텍스트 = 12px**.
- **색**: 전부 `#000000`. `rgba(..., 0.x)` 또는 `opacity`로 반투명 처리된 텍스트 전부 제거.
- 호버 반전(텍스트 ↔ 배경) 인터랙션 제거.

**구현 체크리스트**
- [ ] `globals.css` body `font-size: 15px` → `12px` (타이틀은 컴포넌트 단위에서 override).
- [ ] 모든 모듈 CSS에서 `font-size: 13px | 14px | 15px | 16px` 등 타이틀 이외 사용처를 `12px`로 통일.
- [ ] `color: rgba(…)` / `opacity: 0.x` 패턴을 grep 후 전부 `#000`으로 교체(시각적 weak-emphasis는 회색 대신 행간·공백으로 표현).
- [ ] `var(--color-muted)` 사용처 재검토 — 텍스트에는 쓰지 않고 분할선/스크롤바 등 비텍스트 요소만 유지.
- [ ] Helvetica/시스템 폰트에서 12px는 깨지기 쉬우므로 `-webkit-font-smoothing: antialiased` 유지 확인.

### 6.5 분할선 (Split Line)

**규칙**
- 색: **검정 `#000`**
- 굵기: **3px solid**
- 길이: **`height: 100vh`** (뷰포트 전체)

**구현 체크리스트**
- [ ] `globals.css` 또는 `SplitScreen.module.css`에서 `--split-line-width: 1px` → `3px`.
- [ ] `.splitLine` 배경 `var(--color-muted)` → `#000` (또는 `--color-ink: #000` 변수 신설).
- [ ] `transform: translateX(-0.5px)` 는 1px 라인 정렬 트릭이었으므로 3px 기준으로 `translateX(-1.5px)`로 조정(또는 `translateX(calc(var(--split-line-width) / -2))`).
- [ ] `.handle` 원형 UI는 1.2 원복(UI 간소화)과 중복 — **삭제**. 드래그는 분할선 전체 영역(hit-area 8~12px 확장 레이어)으로 처리.
- [ ] `.handle::before`의 내부 원형 점도 함께 삭제.

### 6.6 배경색 통일

**규칙**
- 기존: 좌(Book) 백색 / 우(Prisoner) 흑색 듀얼톤.
- 변경: **좌/우 모두 백색 (`#ffffff`)**.

**구현 체크리스트**
- [ ] `globals.css`
  - `--color-prisoner-bg: #000000` → `#ffffff`
  - `--color-prisoner-fg: #ffffff` → `#000000`
- [ ] 이에 따라 `prisonerSide`, `panelPrisoner`에서 배경/전경 규칙 재확인. 실질적으로 모든 패널이 동일 `background: #fff; color: #000;`.
- [ ] `LoanCompleteOverlay` 등 흑배경 전제로 디자인된 오버레이가 있는지 확인 후 톤 재설정.
- [ ] 도서 ↔ 수감자 시각 구분은 **배경색이 아닌 컬럼 위치와 라벨(Book / Prisoner)**로 유지.

### 6.7 호버 인터랙션 제거

**규칙**
- 행(row) 호버 시 배경이 검정으로 바뀌는 인터랙션 제거. 정지 상태 = 호버 상태(시각 동일).

**구현 체크리스트**
- [ ] `BookPanel` / `PrisonerPanel`의 CSS 모듈에서 `.row:hover`, `.card:hover` 등 배경 전환 규칙 삭제.
- [ ] 호버 피드백이 필요한 경우 **언더라인** 또는 **가는 좌측 캐럿 인디케이터** 정도로 최소화.
- [ ] 듀얼 커서가 이미 "현재 주목 중인 행"을 시각적으로 알려주므로 호버 하이라이트는 실질적으로 불필요.
- [ ] 링크(Link) 요소의 `:hover` 밑줄/색 변경도 동일하게 제거(`a { text-decoration: none; }` 유지).

### 6.8 부수 영향 & 충돌 지점 점검

- **1.2 UI 원복 섹션**과 부분 중복: 슬라이더 Knob 제거, 시스템 커서 복원 — 디자인 피드백의 "핸들 원형 UI 삭제", "opacity 제거" 방향과 일치. 두 섹션을 실제 커밋 시 **하나로 묶어도 됨**.
- **1.4 스왑 리팩터**: 헤더를 Reverse 영향권에서 분리(6.1)하면, 스왑 책임이 `SplitScreen` 내부로만 국한되어 오히려 단순해짐.
- **색 변수 리네이밍 권장**: `--color-book-*`, `--color-prisoner-*` 는 더 이상 대비하지 않으므로 `--color-bg: #fff`, `--color-ink: #000`, `--color-line: #000` 같은 중립 명칭으로 이동하는 게 유지보수상 유리. 단, 기존 호출부가 많으므로 변수만 우선 같게 맞추고 리네이밍은 별도 커밋.
- **분할선 3px × 검정**은 컬러 팔레트의 새로운 기준. 다른 보더(패널 헤더, 카드)가 `1px #8a8a8a`라면 **시각적 무게 역전**이 생길 수 있음 → 보더 정책도 같이 정리(본문 구분은 공백, 섹션 경계는 `1px #000` 또는 `none`).
- **폰트 라이선스**: CDNFonts 경로는 비공식 재배포 가능성. 상용 배포 전 정식 라이선스 확보 여부 확인 필요.

### 6.9 검수 기준

1. Reverse 버튼을 연타해도 헤더 요소(타이틀/검색/Reverse) 위치·크기·정렬이 전혀 변하지 않음.
2. 타이틀을 제외한 모든 텍스트가 12px · `#000`. `opacity`가 `< 1`인 텍스트는 전무.
3. 배경은 좌/우/헤더 모두 `#ffffff`.
4. 중앙에 검정 3px 세로선이 뷰포트 전체 높이로 고정되어 있고, 원형 Knob 없음.
5. 행에 마우스를 올려도 배경이 바뀌지 않음.
6. `Book as Prisoner`, `Search`, `Reverse` 세 카피가 화면 전체의 영문 카피 전부여야 함.

---

## 7. 작업 분할 제안 (커밋 단위)

**Phase A — 버그 즉시 수정**
1. `fix: restore default cursor and remove split knob` (1.2)
2. `fix: correct title fallback priority (nl.title_info first)` (1.5)
3. `refactor: swap panels by data, not flex-direction` (1.4)
4. `feat: relative-coordinate dual cursor mapping` (1.1)
5. `feat: pagination with pageSize=20 and scroll reset` (1.3)
6. `fix: scroll sync ownership to prevent ping-pong` (2.1)
7. `feat: zero-result message and fallback recommendations` (2.2)

**Phase B — 데이터 계층 재정비**
8. `fix(data): extractIsbn13 utility replacing slice(0,13)` (5.2 H1)
9. `fix(data): dedup skeleton by ISBN13+title` (5.2 H2)
10. `refactor(data): extract aggregateBookData with coverage metrics` (5.3)
11. `fix(data): prefer NL reg_date over d4l reg_date` (5.2 M1)
12. `fix(data): remove kwd='책' fallback, use curated ISBNs` (5.2 M3)
13. `perf(data): limit concurrent seoji/d4l requests to 5` (5.2 M4)

**Phase C — 디자인 리뉴얼 (designfeedback.md)**
14. `refactor(ui): detach Header from Reverse/split-ratio` (6.1)
15. `feat(ui): replace copy to Book as Prisoner / Search / Reverse` (6.2)
16. `feat(ui): load Univers Next Pro 600 webfont` (6.3)
17. `style(ui): enforce 12px + solid #000 typography` (6.4)
18. `style(ui): black 3px split line, drop handle knob` (6.5)
19. `style(ui): unify background to white on both panels` (6.6)
20. `style(ui): remove row hover background invert` (6.7)

**Phase D — 정리**
21. `chore: extract constants and clean dead code` (3장)
22. `refactor(ui): rename book/prisoner color tokens to neutral names` (6.8)

권장 순서: **A → B → C → D**.
- A는 사용자가 이미 "고쳐달라"고 한 버그이므로 선두에 배치.
- C(디자인)는 시각을 크게 바꾸므로 A/B가 먼저 안정화된 이후 한 번에 반영하면 충격이 덜함.
- D는 리네이밍·정리라 언제든 가능.
