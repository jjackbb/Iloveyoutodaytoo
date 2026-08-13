# home 검증 결과 — 잔여데이터·경계면

> 검증일: 2026-08-09 / 대상: `src/app/page.tsx`, `src/components/room/RoomCard.tsx`
> (이식 기록에 없던 `src/components/layout/TabScreen.tsx`, `src/components/ui/EmptyState.tsx` 변경도 함께 봤다)

## 판정: 조건부 통과

막아야 할 것 2건. 둘 다 한 줄짜리 수정이고, 그 밖의 경계면은 전부 깨끗하다.

기계 검사는 통과했다 — 이 두 건은 기계가 못 잡는 종류다.
| 검사 | 결과 |
|---|---|
| `residue-scan.mjs` | 73개 파일, 막음 0 / 확인필요 0 (직접 실행 확인) |
| `tsc --noEmit` | exit 0 (직접 실행 확인) |
| 브라우저 콘솔 (홈/사서함/마이) | error·warn 0건 (직접 확인) |

---

## 막아야 할 것 (고치기 전엔 다음 화면 금지)

### 1. 카드 오른쪽 위 연속일수 배지가 "방 들어가기" 탭을 삼킨다 — 이번 수정으로 생긴 회귀

- **파일:** `src/components/room/RoomCard.tsx:111` (`z-10`)
- **재현:** 홈 → 관계방 카드 커버의 오른쪽 위 알약(`오늘부터 시작해요` / `연속 N일`)을 누른다 → **아무 일도 일어나지 않는다.** 이번 수정 전(`z-10` 없던 상태)에는 같은 자리를 누르면 방으로 들어갔다.
- **실제 확인:** 로그인 상태 홈에서 `document.elementFromPoint(배지 중앙)` → `SPAN`, `closest('a')` = `null`. 같은 요소에서 `z-10` 클래스만 제거하면 같은 지점이 `<a href="/rooms/{id}">`로 잡힌다. 배지 크기 **143×44px**, 커버 클릭 면적의 약 **9%**가 죽은 자리가 된다(4px 격자로 커버 전체 히트테스트).
- **원인:** 카드 전체를 누를 수 있게 만든 장치는 제목 링크의 `after:inset-0` 오버레이(`z-index: auto`)다. 배지에 `z-10`을 주면 이 오버레이보다 위에 쌓이는데, 배지는 링크도 아니고 아무 동작도 없어서 탭이 그냥 사라진다.
  `초대` 칩은 자기 자신이 링크라 `z-10`이 필요하지만(`:99`), 배지는 필요가 없다 — 오버레이는 투명(`content:''`, 배경 없음)이라 `z-10` 없이도 배지는 그대로 다 보인다. 즉 이 `z-10`은 **보이는 것에는 아무 기여를 안 하고 누르는 것만 막는다.**
- **고치는 법:** 배지에서 `z-10`만 뺀다(높이 맞춤용 `min-h-[44px]`는 그대로 둬도 된다). 그러면 오버레이가 다시 위로 와서 배지 자리도 방으로 들어간다.
- **왜 중한가:** 시니어가 주 사용자다. 커버 위에서 가장 눈에 띄는 알약이 "눌러도 안 되는 것"이 되면 "내가 잘못 눌렀나"가 그대로 생긴다. 이건 이식가가 알림 종을 뺀 이유(`01_home_port.md` §2)와 정확히 같은 문제다.

### 2. 방이 하나도 없을 때 빈 화면 위쪽이 잘리고, 스크롤로도 못 올라간다

- **파일:** `src/app/page.tsx:140` (`isEmpty ? 'flex flex-col justify-center' : ''`)
- **재현:** 방이 0개인 계정으로 홈에 들어간다 → 세로가 짧은 기기(iPhone SE 375×667, 사파리 실사용 높이 ≈ 553px)이거나, 브라우저 글자 크기를 '크게'로 올린 상태 → **empty-hero의 위쪽(118px 동그라미)이 잘려 나가고, 위로 스크롤해도 나타나지 않는다.**
- **실제 측정** (실 페이지의 `<main>`에 빈 화면 분기를 그대로 재현해 측정):
  | 조건 | hero 블록 | main 높이 | 위쪽 잘림 | 스크롤로 복구 |
  |---|---|---|---|---|
  | 폭 390 · 기본 글자(17px) | 397px | — | 뷰포트 **602px 이상 필요** (header 53 + action-bar 82 + 탭 70 = 205px가 늘 먹는다) | — |
  | 뷰포트 667 · root 20px | 442px | 432px | 5px | 불가 |
  | 뷰포트 667 · root 24px | 502px | 390px | **56px** | 불가 |
  `main.scrollTop`은 이미 0인데 `scrollHeight`(437·446)가 콘텐츠 높이(442·502)보다 작다 — 넘친 부분이 스크롤 영역 밖이라는 뜻이다.
- **원인:** 스크롤 컨테이너(`overflow-y-auto`)에 `justify-center`를 주면, 내용이 넘칠 때 위·아래로 똑같이 밀려나는데 **위로 밀린 부분은 스크롤 가능 영역에 포함되지 않는다.** 프로토타입의 `.body.center`는 내용이 절대 넘치지 않는 고정 목업이라 이 문제가 안 보였다.
- **고치는 법:** `justify-center` 대신 안쪽 `<div>`에 `my-auto`를 주거나 `justify-safe center`를 쓴다. 가운데 정렬 의도는 그대로 유지되면서, 넘칠 때는 위에서부터 쌓이고 스크롤이 된다.
- **왜 못 잡혔나:** 이식가가 브라우저로 확인할 때 계정에 방이 3개 있었고(아래 §확인 필요 3), 빈 화면은 390×844에서만 봤다. 그 크기에서는 안 잘린다.

---

## 확인 필요 (판단이 갈릴 수 있음)

### 1. 커버 서명 URL 1시간 TTL × 페이지 캐싱 — 실질적으로 문제 없다고 봤다

- **결론:** 캐시된 페이지가 만료된 URL을 들고 있는 경로는 없다. `requireUser()` → `cookies()`를 타므로 홈은 동적 렌더이고, 전체 라우트 캐시에 들어가지 않는다. 렌더될 때마다 `createSignedUrls`로 새로 서명한다. 동적 세그먼트의 클라이언트 라우터 캐시 staleTime은 기본 0이라 재진입 시에도 다시 받아온다.
- **남는 경우:** 홈 탭을 **1시간 넘게 열어둔 채** 뒤로가기로 복원(bfcache)하면 DOM에 남은 만료 URL이 그대로 쓰인다. 이때 `coverStyle`의 프리셋 폴백은 서버에서 이미 결정된 뒤라 되돌아가지 못하고, 커버가 회색 면(`bg-surface-soft`)으로만 남는다. 깨진 이미지 아이콘은 안 뜬다.
- **왜 확신이 덜한가:** 직접 올린 커버를 쓰는 방이 아직 DB에 없어 실제로 만료 상태를 재현하지 못했다(현재 3개 방 모두 프리셋 그라데이션). 실사용 빈도가 낮다고 보고 막을 일로 세지 않았다.

### 2. 공용 부품에 붙었지만 아무도 안 쓰는 prop 2개 — 런타임 영향은 없다

- `src/components/layout/TabScreen.tsx:34` `align?`, `src/components/ui/EmptyState.tsx:14` `icon?`
- 홈이 두 부품 사용을 끊으면서, 홈을 위해 붙였던 확장만 남았다. **호출부는 아무도 안 넘긴다**(`align`: 0곳, `icon`: 0곳 — mailbox/my/my.blocks/my.contact/rooms.[roomId]/message-list 전부 확인).
- **깨지지 않는다는 근거:** 둘 다 optional이고, `align`의 기본식 `align ?? (leading ? 'center' : 'start')`은 아무도 안 넘길 때 기존 `leading ? 'center' : 'start'`와 완전히 동일하다. 브라우저로 `/mailbox`, `/my` 렌더까지 확인했다(제목 정렬 `start` 유지, 콘솔 0건).
- **다만:** `01_home_port.md`의 '대상'에 이 두 파일이 없다. 실제로는 4개 파일이 바뀌었는데 기록은 2개다. 다음 화면에서 이 두 부품을 다시 손볼 때 헷갈릴 수 있다.

### 3. 확인용 방 3개가 DB에 남아 있다 (이식가가 스스로 밝힘)

- `엄마`/가족, `여보`/연인, `대학 동기 모임`/친구 — 지금도 홈에 그대로 보인다(직접 확인).
- 지적으로 세지는 않는다. 다만 **이것 때문에 빈 화면 분기가 실기기 확인에서 빠졌고**, 그래서 위 지적 2가 남았다. detail·mailbox 확인에도 방이 필요하니 지금 지우자는 말은 아니고, **빈 화면을 봐야 하는 검증은 방이 있는 계정에서 못 한다는 점만 기억해 두자.**

### 4. 홈 앱바 여백이 다른 탭 화면과 1~2px 어긋난다

- 홈 `page.tsx:123`: `px-screen-x`(20px) `pt-1.5`(6.4px) / `AppBar.tsx:32`: `px-5`(21.25px) `pt-2`(8.5px)
- 홈↔사서함↔마이를 탭으로 오갈 때 제목 줄이 미세하게 움직인다. 잔여데이터·런타임 문제는 아니고 디자인 판단이라 지적으로 세지 않았다. `01_home_port.md` §5가 "세 화면이 같은 모양"이라고 적었는데 실제로는 아직 아니라는 것만 남긴다.

---

## 대조한 경계

| 경계 | 파일 A | 파일 B | 결과 |
|---|---|---|---|
| DB ↔ 화면 | `page.tsx:32` `select('… daily_streaks(best_count)')` | `types/database.ts:76` `isOneToOne: true` | 통과 — 객체로 와서 `row.daily_streaks?.best_count` 성립 |
| DB ↔ 화면 | `page.tsx:33` select 컬럼 | `RoomCard`가 읽는 필드 전부 | 통과 — select에 없는 컬럼을 읽는 곳 없음 |
| 화면 ↔ 부품 props | `page.tsx:169-184` | `RoomCard.tsx:42-59` `RoomCardProps` | 통과 — 필수 prop 누락 없음, `as="li"` 일치 |
| 인덱스 정합 | `page.tsx:52` `rows.map` (rpc) | `page.tsx:175` `streakCounts[index]` | 통과 — 같은 `rows` 순서, 중간 `return null`이 인덱스를 밀지 않음 |
| 서버 ↔ 클라이언트 | `page.tsx` (서버 컴포넌트) | `BottomNav.tsx` `'use client'` | 통과 — `shrink-0`이지 `fixed`가 아니라 3단 셸의 형제로 정상 배치(실제 화면 확인) |
| 공용부품 ↔ 다른 화면 | 변경된 `TabScreen`·`EmptyState` | mailbox / my / my.blocks / my.contact / rooms.[roomId] / message-list | 통과 — 추가 prop 전부 optional, 기본 동작 동일. `/mailbox`·`/my` 실제 렌더 확인 |
| 액션 ↔ 홈 재검증 | `rooms.ts:94`, `members.ts:163`, `messages.ts:185`, `invitations.ts:354` | `page.tsx` | 통과 — 방 만들기·나가기·마음 보내기·초대 수락 모두 `/` 재검증 있음 |
| 클릭 레이어 | `RoomCard.tsx:129` `after:inset-0` | `RoomCard.tsx:111` 배지 `z-10` | **실패 — 지적 1** |
| 클릭 레이어 | `RoomCard.tsx:129` `after:inset-0` | `RoomCard.tsx:99` 초대 링크 `z-10` / `:116` 아바타 | 통과 — 초대는 `/invite`로, 아바타 자리는 방으로 들어감(히트테스트 확인) |
| 스크롤 ↔ 정렬 | `page.tsx:139` `overflow-y-auto` | `page.tsx:140` `justify-center` | **실패 — 지적 2** |
| 커버 ↔ 캐시 | `page.tsx:97` TTL 3600초 | 홈의 렌더 방식(동적) | 통과 — §확인 필요 1 |
| 토큰 | `page.tsx`·`RoomCard.tsx` 클래스 | `globals.css` | 통과 — `screen-x`/`screen-b`/`card`/`chip`/`hairline`/`canvas`/`surface-soft`/`radius-*`/`shadow-chip` 전부 정의됨. `before:` 그라데이션도 실제로 그려짐(계산된 `::before` 확인) |

## 재현에 쓴 도구

- 로그인 상태의 실제 홈(`localhost:3000`)에서 `elementFromPoint` 히트테스트 — 지적 1
- 실제 `<main>`에 빈 화면 분기를 그대로 재현해 높이·`scrollHeight` 측정 (뷰포트 667 / root 17·20·24px) — 지적 2
- 화면 캡처: `.screenshots/qa-home-01.png`
