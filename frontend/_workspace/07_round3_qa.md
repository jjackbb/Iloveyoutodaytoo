# 이번 라운드 통합 검증 — 잔여데이터·경계면

> 대상: 커밋 안 된 변경 전부 (`git status` 기준 수정 30개 + 새 파일 11개)
> 기준 커밋: `cc2e5e0` (이번 라운드는 아직 커밋 전)
> 기계 검사: `residue-scan` 86개 파일 깨끗, `npx tsc --noEmit` 무출력, `npx next build` 통과
> 실제 확인: Supabase 실제 스키마 조회, 브라우저(localhost:3000) 실측

## 판정: 조건부 통과

경계 자체는 대부분 맞물려 있다. 타입·빌드·마이그레이션·DB 컬럼은 전부 일치했고,
세 번 갈아엎었다는 생년월일 3종 파일도 서로 어긋난 참조가 없다.
다만 **네 갈래가 서로 모르는 채 만든 어긋남 2건**은 사용자가 바로 마주친다.

---

## 막아야 할 것

### B-1. 사서함 [마음 보내기]가 갈 곳이 없다 — 그 흐름이 이번 라운드에 사라졌다

작업 4(사서함 CTA 문구)와 작업 2(앨범방 이식)가 정확히 반대로 움직였다.

- 작업 2가 `/rooms/[roomId]/compose`를 **heart_messages 쓰기 → memories 쓰기**로 갈아탔다.
  (`compose/page.tsx`의 "1:1로 보내는 마음은 사서함의 [마음 보내기]로 옮겨 갔다 — 4단계")
- 그 결과 `src/lib/actions/messages.ts`의 `createMessage`를 부르는 곳이 **0개**다.
  `grep -rn "actions/messages\|createMessage" src/` 결과 없음.
  `next build` 라우트 목록에도 마음 보내기 화면이 없다(`/mailbox` 하나뿐).
- 작업 4는 그 상태에서 빈 화면 버튼을 "관계방 보러 가기" → **"마음 보내기"**로 바꿨다.

**재현**: 사서함 → [보낸 마음] 탭(비어 있음) → **[마음 보내기]** → 홈 → 아무 방 →
아래 [마음 표현하기] → 사진·녹음 담아 저장 → 방 피드에는 게시물이 뜨지만
**사서함은 그대로 비어 있다.** 버튼이 약속한 일을 할 수 있는 화면이 앱에 없다.

링크(`actionHref="/"`)가 깨진 것은 아니다. `/`는 실재하는 라우트이고 `EmptyState`도
`ButtonLink`로 정상 렌더된다. 깨진 것은 **문구가 약속한 동작**이다.

→ 4단계에서 마음 보내기 화면이 생기기 전까지는 문구를 지금 할 수 있는 일에 맞춰야 한다.
   (예: "앨범방에서 마음 표현하기" / 목적지도 방 목록임을 드러내는 말)

### B-2. 커버 자르기는 2:1인데 홈 카드 커버는 2.76:1 — 세로 27.5%가 잘려 나간다

`cover-crop-dialog.tsx:26`의 주석은 이렇게 말한다.

```
/** 홈 카드 커버의 비율(가로/세로). RoomCard의 h-[158px] 커버와 같은 모양이다. */
const COVER_ASPECT = 2
```

`06_cover_crop_port.md` §1도 "커버는 홈 카드와 같은 **2:1 고정**"을 전제로 손잡이 로직을 짰다.
그런데 `RoomCard`의 커버 칸은 **높이만 158px로 고정이고 가로는 화면 폭을 따라간다.**
2:1이 되는 것은 콘텐츠 폭이 정확히 316px일 때뿐이다.

**실측**(브라우저, `getBoundingClientRect`):

| 뷰포트 | 커버 칸 | 실제 비율 | 2:1 크롭에서 잘려 나가는 세로 |
|---|---|---|---|
| 500px | 436 × 158 | **2.759** | **27.5%** (위·아래 각 약 14%) |

`coverStyle()`이 `background-size: cover`라, 2:1로 자른 그림이 2.76:1 칸에 들어가면
가로를 채우느라 세로가 잘린다. 자르기 창은 "밝은 틀 안이 커버가 돼요"라고 적어 두었는데
**틀 위아래 14%씩은 홈 카드에서 보이지 않는다.** 얼굴을 틀 위쪽에 맞춰 자른 사진이 특히 상한다.

작업 3이 좌표 계산을 전부 다시 쓰면서 이 상수를 그대로 물려받았고,
같은 라운드에 작업 1이 `RoomCard` 커버 높이를 168px → 158px로 줄여 어긋남이 더 커졌다.

→ 둘 중 하나를 골라야 한다.
   (가) `RoomCard` 커버를 `aspect-[2/1]`로 바꿔 진짜 2:1로 만든다(158px 실측값은 포기).
   (나) `COVER_ASPECT`를 실제 카드 비율에 맞추고 크롭 틀·출력 크기를 함께 고친다.
   프리셋 그라데이션만 쓰는 방은 영향이 없다 — 직접 올린 커버에서만 드러난다.

---

## 확인 필요

### C-1. 부르는 곳이 사라진 모듈 4개 — 특히 살아 있는 Server Action 하나

작업 2가 화면을 갈아타면서 뒤에 남았다. 전부 import 0건이다.

| 파일 | 상태 |
|---|---|
| `src/lib/actions/messages.ts` | `'use server'` — **화면은 없는데 엔드포인트는 살아 있다** |
| `src/lib/prompts.ts` | 오늘의 질문. 부르는 곳 0 |
| `src/components/message/MessageBubble.tsx` | 주석에서만 언급됨 |
| `src/components/room/StreakBadge.tsx` | `RoomCard`가 연속일수 배지를 뺀 뒤 고아 |

`nav/BackLink.tsx`도 `layout.tsx`가 머리띠를 걷어내며 함께 고아가 됐다.

4단계에서 되살릴 예정이라면 그 계획을 파일 첫 주석에 적어 두는 편이 낫다.
지금은 "어디서 쓰나" 검색이 계속 헛돌고, `createMessage`는 화면 없이도 호출 가능한 상태로 남는다.

### C-2. Server Action 본문 1MB vs `COVER_MAX_BYTES` 5MB — 5MB 검사는 도달할 수 없다

`rooms.ts:38`의 `COVER_MAX_BYTES = 5 * 1024 * 1024`는 covers 버킷 설정(실측 5,242,880)과 같다.
그런데 커버 파일은 **Server Action의 FormData로** 간다. `next.config.ts`에
`serverActions.bodySizeLimit` 설정이 없어 기본값 1MB다.

지금은 실제로 안 터진다 — 자르기 창이 1200×600 JPEG(q0.85)로 구워 보내므로 대개 300KB 안쪽이다.
다만 "커버 사진이 너무 커요" 문구는 영영 뜨지 않고, 1MB를 넘기는 경우가 생기면
우리 한국어 안내 대신 Next.js의 본문 초과 오류가 뜬다.

### C-3. 음성 재생바가 두 개다

- `src/components/media/VoicePlayer.tsx` (이번 라운드 신규, props: `src` / `durationSec` / `label` / `levels`)
- `src/app/mailbox/message-list.tsx:232`의 로컬 `VoicePlayer` (props: `url` / `durationSec`)

이름이 같고 props가 다르다. 타입 오류는 안 난다(로컬 함수라 서로 안 만난다).
같은 서비스 안에서 사서함의 재생바와 앨범방 게시물의 재생바가 다른 모양·다른 동작이 된다.

### C-4. `residue-scan`의 PRD 제외 규칙이 좁아졌다 — 근거는 확인됨

`prd-excluded-feature` 규칙이 `좋아요·댓글·공지·용량그래프·시니어폰트토글` 5종에서
관계유형 UI 하나로 바뀌었다. 스킬 스크립트 자체가 이번 라운드 수정 대상이라 근거를 확인했다.

`_workspace/03_capture_flow.md` §43이 그 5종을 **포함 대상으로 뒤집어 놓았다**
("좋아요 · 댓글 · 사진 업로드 · 용량 그래프 · 큰 글자 토글 …"). 규칙 변경은 정당하다.
다만 이제 스캐너의 그물이 관계유형 하나로 줄었다는 점은 알고 있어야 한다 —
앞으로 PRD에서 빠지는 것이 생기면 규칙에 다시 넣어야 걸린다.

### C-5. 작은 것들

- `MemoryCard`의 `likeCount` / `commentCount`는 방 화면에서 `0` 하드코딩이다.
  지금은 담을 곳이 없어 실제로도 0이라 거짓은 아니지만, 3단계 전까지 늘 0으로 보인다.
- `EmptyState`에 `icon` prop이 새로 생겼는데 넘기는 곳이 없다(홈은 자체 `EmptyHero`를 쓴다).

---

## 대조한 경계

### 공유 부품 — 어긋난 참조 없음

**`BirthDateField` ↔ `WheelPicker` ↔ `birth-date.ts` (세 번 갈아엎었다는 그것)**

- `WheelPicker`가 내보내는 것: `WHEEL_ITEM_HEIGHT`, `WheelColumn`, `WheelGroup`, `WheelSelect`.
  `BirthDateField`가 쓰는 것과 정확히 일치. `WHEEL_YEAR_SPAN` 같은 **없어진 이름을 붙잡고 있는
  import는 없다**(`grep -rn "WHEEL_" src/` 전수 확인).
- `birth-date.ts`가 내보내는 9개 중 `BirthDateField`가 8개, 서버(`auth.ts`)가
  `validateBirthDate` 하나를 쓴다. 죽은 export 없음.
- `birthYearOptions()` 하한(1900)과 `validateBirthDate` 하한(`MIN_BIRTH_YEAR`)이 같은 상수를 본다 —
  휠에 없는 해를 서버가 거절하는 어긋남이 없다.
- **브라우저 실측**: 생년월일 시트가 가입 `<form>` 안에 있어 시트의 숫자 칸에서 Enter를 치면
  폼이 새어 나가는지 실제로 눌러 봤다. `submit` 이벤트 리스너를 걸고 확인 → **새지 않는다.**
  `showModal()`이 제출 버튼을 top layer 밖으로 밀어내 암묵적 제출이 일어나지 않는다.
- `Button`의 기본 `type`이 `"button"`이라, 시트와 크롭 모달의 [취소]/[완료]/[선택]이
  바깥 폼을 제출하지 않는다.

**`Toast`** — 두 곳(`room-form`, `rooms/[roomId]/page`)이 `key`/`offsetClassName` 규약을 지켜 쓴다.

### DB ↔ 타입 — 전부 일치 (실제 스키마 조회)

| 확인한 것 | 결과 |
|---|---|
| `memories.media_url` nullable, `voice_path`·`voice_duration_sec` 추가 | 실제 컬럼과 일치 |
| `memories_voice_pair` CHECK (3~60초) | `VOICE_MIN_SEC`/`VOICE_MAX_SEC`와 같은 값 |
| `memory_photos` (sort_order < 10, memory_id+sort_order UNIQUE) | `PHOTO_MAX_COUNT = 10`과 일치 |
| `memories_description_length` ≤ 300 | `CAPTION_MAX_LENGTH = 300`과 일치 |
| `room_members.favorited` NOT NULL DEFAULT false | 일치 |
| `rooms.relationship_type` nullable | 일치. `relationshipTypeLabel(null)`이 `''`을 돌려주고 사서함이 `.filter(Boolean)`으로 걸러 "null"이 화면에 뜨지 않는다 |
| `users.username` + `users_username_key` UNIQUE 인덱스 | **실재한다.** `auth.ts`의 "DB가 한 번 더 막는다" 주석이 사실 |
| `users_username_format` CHECK `^[a-z0-9]{4,16}$` | `USERNAME_PATTERN`과 같은 값 |
| `handle_new_user` 트리거 | `username`을 넣고 `%@id.oneuldo.local`은 `users.email`에서 null로 걸러낸다 — 코드 주석과 일치 |
| covers 버킷 5MB / jpeg·png·webp | `COVER_MIME_TYPES`와 일치 (크기는 C-2 참고) |

### 마이그레이션 순서 — 중복·충돌 없음

이번 라운드에 6개가 서로 다른 손에서 들어왔고 순서가 어긋나지 않았다.

```
20260809100610 add_room_member_favorited
20260809100622 rooms_relationship_type_optional
20260809104535 memories_voice_and_caption
20260809104553 memory_photos
20260809110155 add_username_to_users
20260809110208 handle_new_user_username
20260810040442 drop_duplicate_memories_room_created_idx
```

마지막 하나가 실제로 여러 손이 만든 중복 인덱스를 정리한 것이다.
지금 `memories`의 인덱스는 `idx_memories_room_created` 하나뿐 — 중복이 남아 있지 않다.

### 이메일 노출 지점 — 한 곳뿐

`isInternalEmail`이 빠진 노출 지점이 있는지 전수 검색했다.
`user.email`을 화면에 그리는 곳은 **`src/app/my/page.tsx` 하나뿐**이고 거기서 걸러진다.

- `my/contact/page.tsx` — "가입할 때 적은 이메일 주소" → "가입할 때 만든 아이디"로 바뀌어
  이메일을 아예 묻지 않는다. 걸러낼 값이 없다.
- `my/withdraw/withdraw-form.tsx` — 안내 문구에서 "이메일" → "아이디".
- `signup-form.tsx` / `login-form.tsx` — 이메일 칸 자체가 없어졌다.

`user.username ?? usernameFromEmail(user.email)` 순서라, 트리거가 username을 못 넣은 계정도
내부 주소에서 아이디만 꺼내 보여주고 주소 전체는 어디에도 뜨지 않는다.

### 서버 ↔ 클라이언트

- `next build` 통과 — 서버 전용 모듈이 클라이언트 번들로 새는 곳 없음.
- `birth-date.ts` · `username.ts` · `age.ts` · `waveform.ts` · `image.ts` 모두 서버 전용 import 없음.
  (`image.ts`는 브라우저 전용이지만 부르는 곳이 `'use client'`인 `compose-form` 하나다)
- `FavoriteButton`만 `'use client'`이고 `RoomCard`·홈은 서버 컴포넌트로 남았다.
  `toggleRoomFavorite`는 `Promise<void>`, 호출부도 반환값을 안 쓴다 — 구조분해 불일치 없음.
- `createMemory`의 `CreateMemoryResult`(`{ok:true} | {ok:false, error, retryable}`)와
  `compose-form`의 분기(`result.ok` / `result.retryable` / `result.error`)가 일치.
- `createRoom`의 `CreateRoomState.field`가 `'name' | 'cover'`로 바뀌었고
  `room-form`도 같은 두 값만 본다(`relationship_type` 잔재 없음).

### 5건 버그 수정 — 코드에 실제로 반영됨

- 사진 정확히 2장: `PhotoGrid`가 `rest.length === 1`이면 `grid-rows-1` — 빈 회색 칸이 생기지 않는다.
- 고아 파일: `discardUploads`가 언마운트·사진 빼기·재녹음 세 경로에서 다 돈다.
  성공 시 `committedRef`로 막아 저장된 파일은 지우지 않는다.
- AudioContext: `stopMetering()`이 `close()`까지 하고, 언마운트·`onstop`·`onerror` 세 곳에서 불린다.
- `hiddenPhotoCount`를 DB 원본 수가 아니라 **서명에 성공한 수**로 세는 것도 맞게 들어가 있다.
