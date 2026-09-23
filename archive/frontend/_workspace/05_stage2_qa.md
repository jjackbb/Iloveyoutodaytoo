# 2단계(아이디·생년월일·피드) 검증 결과 — 잔여데이터·경계면

> 검증일: 2026-08-10 · 대상: `_workspace/04_auth_port.md`(가입·로그인), `_workspace/02_detail_port.md`(피드·표현하기)
> 방법: 두 보고서의 주장을 믿지 않고 소스와 **운영 DB(qsqjknxrsysjgzidjinm)를 직접 조회**해 대조했다.
> 기계 검사(`residue-scan.mjs`): 86개 파일, 막음 0 · 확인필요 0 — **깨끗하다고 나왔다.**
> 아래 지적은 전부 그 검사가 못 잡는 것들이다.

## 판정: 조건부 통과

두 이식가가 확인했다고 적은 것은 대체로 사실이다. 아이디↔이메일 변환의 대칭성, `memory_photos`
RLS의 조건 재명시, 대표사진 순서, 작성 화면 상태 초기화, 마이크 권한 거부 경로 — **요청받은
확인 항목 6개 중 5개는 코드에서 실제로 확인됐다**(§대조한 경계).

막는 이유는 다른 데 있다. **피드가 게시물 1개로만 검증됐다.** 게시물이 여러 개인 방을 열면
카드마다 오디오 컨텍스트를 새로 만들고 음성 파일 전체를 내려받는다. 그리고 **표현하기가 실패한
뒤 화면을 떠나면 올라간 파일이 스토리지에 영영 남는데, 지금 버킷에 그 상태인 파일이 실제로
하나 있다** — 아무도 눈치채지 못한 채 사흘째다.

---

## 막아야 할 것

### 1. 피드에 음성 게시물이 쌓이면 카드마다 AudioContext를 만들어 터진다 (미처리 프라미스 거부)

- 파일: `src/components/media/VoicePlayer.tsx:69-81`, `src/lib/waveform.ts:67-88`
- 재현: 한 방에 **음성이 든 추억을 6개 이상** 남긴 뒤 그 방을 연다
  → 카드마다 `levelsFromUrl(src)`가 `new AudioContext()`를 만든다. 30개 카드의 effect가 동시에
  뜨므로 컨텍스트가 동시에 살아 있다. 크롬은 문서당 6개가 상한이라 7번째부터 생성자가 예외를
  던진다(사파리/iOS는 더 낮다).
  → 결과: 파형이 납작한 줄로 남고, 콘솔에 **unhandled promise rejection**이 뜬다.
- 원인 두 겹:
  1. `waveform.ts:76`의 `const context = new AudioContextClass()`가 **try 블록 바깥**에 있다.
     아래 `catch { return null }`이 이 예외를 못 잡아 `levelsFromUrl`이 reject된다.
  2. `VoicePlayer.tsx:73`의 `void (async () => { await levelsFromUrl(src) ... })()`에 try/catch가
     없다. reject가 그대로 새어나간다.
- 함께 볼 것: 누르지도 않은 카드마다 **음성 파일 전체를 fetch**한다. `<audio preload="none">`(:105)을
  무의미하게 만들고, `MEMORY_PAGE_SIZE = 30`이면 방을 한 번 여는 데 음성 30개를 내려받는다.
  02 보고서 §2가 내세운 "서명 요청은 버킷당 한 번씩, 게시물 수만큼 늘어나지 않는다"는 절약 논리와
  정면으로 어긋난다 — 서명은 2회지만 실제 다운로드는 게시물 수만큼이다.
- 왜 안 잡혔나: 02 보고서 §5의 브라우저 확인은 **게시물 1개**로 했다. 이 구조는 2개부터 보이고
  6개부터 깨진다.

### 2. 사진이 **정확히 2장**인 게시물은 카드 오른쪽 아래가 빈 회색 칸으로 남는다

- 파일: `src/components/memory/MemoryCard.tsx:140-190`
- 재현: 작성 화면에서 사진 **2장** + 녹음 → [표현하기] → 피드 카드를 본다
  → 오른쪽 아래 1/4이 사진 없이 `bg-surface-soft` 회색으로 비어 있다.
- 원인: `photos.length === 1` 분기(:140)를 못 타고 격자 분기로 간다. 오른쪽 열이
  `grid-rows-2`(:163)인데 `rest`에는 사진이 1장뿐이라 두 번째 행이 빈 채로 남는다.
  `hiddenPhotoCount = Math.max(0, 2 - 3) = 0`이라 `+N` 배지도 안 붙어 그냥 빈 칸이다.
  3장 이상은 `rest`가 2장이라 정상, 1장도 정상 — **2장만** 깨진다.

### 3. 사진 주소를 못 만들면 사진 자리가 통째로 사라진다 (음성에는 있는 대체 문구가 사진에는 없다)

- 파일: `src/app/rooms/[roomId]/page.tsx:153-157` · `src/components/memory/MemoryCard.tsx:134`
- 재현: `media` 버킷 서명이 실패하거나(정책·네트워크), 사진 경로가 `{roomId}/`로 시작하지 않는
  게시물을 연다 → `visible`이 빈 배열 → `PhotoGrid`가 `return null` → **카드에 사진 영역 자체가
  없어진다.** 사용자는 원래 사진 없는 글로 읽는다.
- 원인: 음성은 같은 상황에서 "목소리를 불러오지 못했어요"를 띄우는데(`MemoryCard.tsx:89-94`)
  사진에는 그 갈래가 없다. `page.tsx:64`의 주석은 "규칙에 안 맞으면 서명하지 않고, 화면에는
  '불러오지 못했어요'로 흐른다"고 적혀 있지만 **사진 경로에 그 문구는 존재하지 않는다.**
- 덤: `hiddenPhotoCount`(:165)는 서명에 성공한 수가 아니라 DB 원본 수(`photos.length`)로 센다.
  10장 중 4장만 서명되면 3장을 보여주며 "+7"이라고 적는데, 실제로 볼 수 있는 건 1장 더뿐이다.

### 4. 표현하기가 실패한 뒤 화면을 떠나면 올라간 사진·음성이 스토리지에 영영 남는다

- 파일: `src/app/rooms/[roomId]/compose/compose-form.tsx:191-216`(업로드) · `:145-149`(빼기) · `:244-258`(실패 처리)
- 재현: 사진 3장 + 녹음 → [표현하기] → 업로드는 끝났는데 `createMemory`가 실패
  (방에서 빠졌거나 CHECK 위반 등 `retryable: false`) → "다시 표현하기" 상태 →
  **사용자가 뒤로 나간다** → `media` 3개 + `voice` 1개가 어떤 `memories`·`memory_photos` 행에도
  연결되지 않은 채 버킷에 남는다.
  변형: 실패 후 사진을 ×로 빼고 재시도해도 `removePhoto`(:145)는 `uploadedPhotoPathsRef`에서
  경로만 지울 뿐, 이미 올라간 파일은 그대로다. "다시 녹음하기"도 같다 —
  `handleRecordingChange`(:98)는 ref만 비운다.
- **실제 증거 (운영 DB 조회)**: `voice` 버킷의
  `70e586d7-c222-444a-a88c-6b00191a5684/86aceef3-4e56-4843-a3a3-f96d30a8ec9b.webm`
  (2026-08-07 업로드)이 정확히 이 상태다. `heart_messages`는 **0행**이고 `memories.voice_path`
  어디에도 없다. 참조하는 행이 하나도 없는 파일이 사흘째 남아 있는데 아무 검사도 이걸 못 본다.
- 원인: 02 보고서 §4-(2)는 "고를 때 올리면 ×로 뺀 사진이 고아로 남는다"며 표현할 때 올리기로
  정했는데, **표현하기가 실패하는 경로에서 같은 고아가 생긴다.** 정리 수단이 코드에도 DB에도 없다.

### 5. 같은 인덱스를 두 번 만들었다 — 두 마이그레이션이 충돌한 지점

- `memories_voice_and_caption`(20260809104535)이 만든 `memories_room_created_idx`와,
  1단계 `optimize_rls_initplan_and_fk_indexes`(20260807133529)의 `idx_memories_room_created`가
  **완전히 동일**하다 — 둘 다 `btree (room_id, created_at DESC)`.
- Supabase 린터도 `duplicate_index` **WARN**으로 잡는다.
- 결과: 게시물을 하나 넣을 때마다 같은 인덱스를 두 번 쓴다. 02 보고서 §1은 이 인덱스를 새로
  추가한 것으로 적어두었으나 이미 있던 것이다.
- 조치: `drop index public.memories_room_created_idx;` (나중에 만든 쪽을 지운다)

---

## 확인 필요

### A. 합성 이메일 도메인이 TS와 SQL 두 곳에 따로 박혀 있다

`src/lib/username.ts:34` `USERNAME_EMAIL_DOMAIN = 'id.oneuldo.local'` 와
DB 트리거 `handle_new_user()` 안의 `new.email ilike '%@id.oneuldo.local'` 가 **각자 적힌 사본**이다.
TS 쪽 주석은 "이 값이 바뀌면 기존 계정이 로그인하지 못한다"고만 경고하고 SQL 사본을 언급하지 않는다.
한쪽만 고치면 새 계정의 `users.email`에 내부 주소가 그대로 저장되고(04 보고서 §3의
"users.email은 사용자가 실제로 적어준 이메일만 담는다"가 깨진다), 마이 화면이 그 주소를 보여준다.
→ `username.ts` 주석에 "이 값은 `handle_new_user()` SQL에도 박혀 있다"를 한 줄 남겨둘 것.

### B. 아이디 계정이 DB에 0개 — 로그인 경로가 실증 상태로 남아 있지 않다

`select count(*) from users where username is not null` = **0**.
04 보고서 §4의 브라우저 확인은 사실이지만 테스트 계정 2개를 지운 뒤라 지금 DB에는 아이디로
로그인할 수 있는 계정이 없다. 남은 계정 2개는 이메일 계정이다(보고서 내용과 일치).
signIn↔signUp 대칭 자체는 코드로 확인했다 — 아래 대조표 참고.

### C. 휠 시트를 닫을 때 `dialog.close()`를 부르지 않아 초점이 문서 맨 앞으로 돌아간다

`src/components/ui/BirthDateField.tsx:237-247`. `showModal()`로 연 다이얼로그를 `close()` 없이
언마운트하면 브라우저의 초점 복원이 일어나지 않는다.
재현: 키보드만으로 [고르기] → [완료] → Tab → 초점이 [고르기] 다음이 아니라 문서 처음으로 간다.
`src/app/rooms/new/cover-crop-dialog.tsx`도 같은 구조다 — **이번 이식이 만든 문제가 아니라
프로젝트 전체의 패턴**이라 별도 판단이 필요하다.

### D. BirthDateField의 라벨·안내문이 낭독기에 전달되지 않는다

`FieldShell`은 `${id}-hint` / `${id}-error`를 그리기만 하고 `aria-describedby`를 붙이지 않는다
(`Field`만 붙인다 — `src/components/ui/Field.tsx:124-134`). BirthDateField는 세 칸에 `aria-label`만
주므로(`:177, :192, :213`) 낭독기는 "생년월일" 라벨도 "숫자로 직접 적거나…" 안내문도 못 읽는다.
오류만 `role="alert"`로 뜰 때 한 번 읽힌다.

### E. 유효하지 않은 날짜가 숨은 칸에 그대로 실려 서버까지 간다

`src/components/ui/BirthDateField.tsx:93-100, 166`. `isoDate`는 `validateBirthDate` 결과와
상관없이 채워진다.
재현: 년 `1899` · 월 `8` · 일 `9` → 화면에 "태어난 해는 1900년부터…" 오류가 뜨지만 세 칸이
전부 차 있어 브라우저 `required`가 제출을 막지 않고, 숨은 칸에 `1899-08-09`가 실려 나간다.
서버 `signUp`(`auth.ts:79`)이 다시 검사해 되돌리므로 잘못된 값이 DB에 들어가진 않는다.
다만 파일 상단 주석의 "반쪽짜리 날짜를 서버에 흘리지 않는다"는 **덜 채운 값에만** 해당하고
틀린 값에는 해당하지 않는다 — 주석과 동작이 어긋난다.

### F. `loading.tsx`·`error.tsx`가 앱 전체에 하나도 없다

`find src/app -name loading.tsx -o -name error.tsx` → 결과 없음.
방 피드는 DB 1회 + 스토리지 서명 2회를 기다린 뒤에야 그려지는데, 그동안 직전 화면이 멈춘 채로
남는다(눌렀는데 아무 반응이 없는 것으로 읽힌다).
→ **요청받은 "이전 방의 피드가 잠깐 보이는가"는 아니다.** `MemoryCard key={memory.id}`가 uuid라
카드가 재사용될 수 없고, 방에서 방으로 바로 가는 통로도 없다(반드시 홈을 거친다). key 누락 없음.

### G. 탈퇴·방 삭제가 스토리지를 건드리지 않는다

`withdraw_account()`는 혼자 쓰던 방을 `delete from rooms`로 지운다 → `memories` → `memory_photos`
까지 cascade로 사라지지만 `media`·`voice` 버킷 파일은 그대로 남는다.
이번 단계가 만든 문제는 아니다. 다만 사진이 `media_url` 한 칼럼에서 `memory_photos` 여러 행으로
늘면서 **탈퇴 한 건이 남기는 파일이 게시물당 최대 10배**가 됐다. §4와 같은 뿌리다.

---

## 대조한 경계

| 경계 | 대조한 것 | 결과 |
|---|---|---|
| **아이디 ↔ 합성 이메일 대칭** | `username.ts` `normalizeUsername`/`usernameToEmail`/`resolveLoginEmail` ↔ `auth.ts` signUp:105 / signIn:38 | **일치.** 양쪽 다 trim+소문자 → `^[a-z0-9]{4,16}$` 검사 → `{id}@id.oneuldo.local`. `@`는 규칙상 아이디에 못 들어가므로 이메일 통로와 겹치지 않는다. 로그인 실패 위험 없음 |
| 폼 ↔ 액션 (가입) | `signup-form.tsx` input name 9개 ↔ `auth.ts` signUp `formData.get()` | **전부 일치** (name·username·password·birth_date·agree_terms·guardian_name·guardian_phone·guardian_consented·next) |
| 폼 ↔ 액션 (로그인) | `login-form.tsx` ↔ signIn | **일치** (username·password·next) |
| **`memories` RLS ↔ `memory_photos` RLS** | `pg_policies` 실조회 | **보고서 주장이 사실.** `memory_photos_select`가 `is_room_member(m.room_id) AND NOT has_blocked(m.author_id)`를 그대로 재명시. insert/delete도 부모 조건 재명시 |
| DB ↔ 타입 | `information_schema.columns` ↔ `src/types/database.ts` | **일치.** `memories`(voice_path·voice_duration_sec·media_url nullable·media_type default) / `memory_photos` 5칼럼 / `users.username` 전부 반영됨 |
| DB ↔ 쿼리 select() | `page.tsx:51`, `page.tsx:76`, `auth.ts`, `getCurrentUser` | **없는 칼럼 읽는 곳 없음.** `my/page.tsx`의 `user.username`은 `getCurrentUser`가 `select('*')`라 안전 |
| 서버 ↔ 클라이언트 | `'use client'` 파일들의 import | **서버 전용 모듈 유입 없음.** `username.ts`·`birth-date.ts`는 순수, `image.ts`·`waveform.ts`는 브라우저 전용이며 클라이언트에서만 부른다 |
| 마이그레이션 순서 | `list_migrations` | memories(104535) → memory_photos(104553) → username(110155) → trigger(110208). **트리거·RLS 충돌 없음.** 유일한 충돌은 §5 중복 인덱스 |
| 상수 ↔ DB CHECK | `limits.ts` ↔ `pg_constraint` | **일치.** 3/60초 = `memories_voice_pair`, 300자 = `memories_description_length`, 10장 = `sort_order < 10` |
| 대표사진 순서 | `compose-form.tsx:191-203` ↔ `memories.ts:172-178` ↔ `page.tsx:76-79` | **안 꼬인다.** ×로 빼면 배열에서 빠지고 제출 때 `index`로 0부터 다시 매긴다. 피드는 `sort_order`로 다시 정렬한다 |
| 작성 화면 상태 초기화 | `compose-form.tsx:77-90` | **잔여 없음.** 전부 컴포넌트 상태·ref이고 모듈 최상단에 쌓는 것이 없다. `preview`는 data: URL이라 되돌릴 것도 없다 |
| 생년월일 상태 초기화 | `BirthDateField.tsx:80-86`, `237-247` | **잔여 없음.** 시트는 `sheetOpen`일 때만 마운트돼 `draft`가 열 때마다 새로 잡힌다. 가입 성공 시 `redirect`로 언마운트 |
| 마이크 권한 거부 경로 | `VoiceRecorder.tsx:89-111, 266-272` | **존재한다.** `describeMicError`가 NotAllowed/NotFound/NotReadable/Security를 각각 한국어로 안내하고 `setPhase('idle')`로 되돌린다. 02 보고서가 "사람이 확인 필요"로 남긴 부분이지만 **코드 경로는 갖춰져 있다** |
| 보고된 DB 상태 | 실조회 | **사실.** auth.users 2 · users 2 · memories 1 · memory_photos 3 · rooms 4. 테스트 계정 authtest01/02 정리 완료 확인 |
