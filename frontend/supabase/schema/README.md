# 스키마 스냅샷 (2026-09-06)

## 왜 이게 있나

**이 저장소에는 마이그레이션 SQL이 한 줄도 없었다.** 스무 건이 넘는 스키마 변경이
전부 운영 DB에 직접 적용됐고, `supabase_migrations.schema_migrations` 이력 테이블조차
없다. 즉 **스키마의 유일한 원본이 클라우드의 라이브 DB 하나뿐이었다.**

실제로 2026-09-06에 그 프로젝트가 **무료 플랜 미사용으로 일시정지(INACTIVE)** 되어
앱의 로그인·가입이 전부 죽어 있었다. 복구는 됐지만, 그때 스키마가 함께 날아갔다면
RLS 정책 63개·함수 28개·트리거 11개를 되살릴 방법이 없었다.

그래서 라이브 DB의 카탈로그를 읽어 SQL로 내려 적었다.

## 파일과 실행 순서

번호 순서대로 돌려야 한다. 뒤 파일이 앞 파일의 것에 기댄다.

| 파일 | 내용 | 개수 |
|---|---|---|
| `00_extensions_types.sql` | 확장 4, 열거형(enum) | 7 |
| `01_tables.sql` | 테이블 + PK/FK/UNIQUE/CHECK 제약 | 20 |
| `02_indexes.sql` | 제약이 안 만드는 인덱스만 | 37 |
| `03_functions.sql` | 함수 — RLS가 여기 기댄다 | 28 |
| `04_triggers.sql` | 트리거 (auth.users 것 1개 포함) | 11 |
| `05_rls_public.sql` | `enable row level security` + public 정책 | 56 |
| `06_storage.sql` | 버킷 4개 + storage.objects 정책 | 7 |
| `07_cron.sql` | pg_cron 예약 작업 | 1 |
| `08_knock_enum.sql` | 위젯 톡톡 알림 enum 값 | 후속 변경 |
| `09_widget_handwriting.sql` | 위젯·손글씨 확장 | 후속 변경 |
| `10_widget_token_errors.sql` | 무효 위젯 토큰 오류 처리 | 후속 변경 |
| `11_handwriting_pair_not_null.sql` | 손글씨 경로·길이 쌍 제약 수정 | 후속 변경 |
| `12_voice_no_minimum.sql` | 추억·댓글·사서함 음성 3초 하한 제거 | **로컬 준비, 원격 미적용** |

`12_voice_no_minimum.sql`은 이전 3초 제약이 실제 DB에 남아 있는지 먼저 검사하고, 다른 정의라면 중단한다. 길이가 없는 기존 음성 행이 발견돼도 중단한다. 사용자는 2026-09-25 기존 프로젝트를 삭제하고 `wdzzianhfnupmfbjqqac`를 새 대상으로 정정했다. 읽기 전용 MCP 카탈로그 조회에서 새 프로젝트의 `public` 테이블은 0개, `auth.users` 행과 Storage 버킷도 각각 0개였다. 따라서 `12`를 바로 적용할 수 없고, 빈 데이터의 실행 가능한 초기 마이그레이션부터 재구성해야 한다. 사용자는 과거 데이터 복구를 요구하지 않는다. 원격 스키마 반영·앱 배포는 아직 하지 않았다.

## 이 스냅샷의 한계 — 반드시 읽을 것

- **원본 마이그레이션이 아니다.** `pg_get_functiondef` 등으로 현재 상태를 재구성한 것이라,
  Postgres가 정규화한 표현으로 바뀌어 있다(예: `auth.uid()` → `( SELECT auth.uid() AS uid)`).
  동작은 같지만 사람이 처음 쓴 문장 그대로는 아니다.
- **한 번도 실행해서 검증하지 않았다.** 빈 DB에 순서대로 돌려 같은 스키마가 나오는지는
  확인하지 않았다(그러려면 별도 프로젝트가 필요하다). 급할 때 그대로 믿지 말고 한 번 돌려볼 것.
- **`01_tables.sql`을 그대로 실행하면 안 된다.** 첫 `blocks` 테이블이 아직 만들지 않은
  `users` 테이블을 외래 키로 참조하는 등 생성 순서가 맞지 않는다. 이 파일은 구조를
  내려 적은 자료이지 실행 가능한 초기 마이그레이션이 아니다. 새 프로젝트에서는
  테이블 생성과 외래 키 추가를 올바른 순서로 재구성하고 격리 환경에서 먼저 검증해야 한다.
- **auth · realtime · vault 스키마는 Supabase가 관리하므로 담지 않았다.** 단
  `auth.users` 에 붙은 `on_auth_user_created` 트리거는 우리 것이라 `04_triggers.sql` 에 넣었다.
  **이게 없으면 가입해도 `public.users` 행이 안 생긴다.**
- **데이터는 없다.** 스키마만이다.

## 앞으로

지금부터의 스키마 변경은 **여기에 파일로 먼저 남기고** DB에 적용한다.
그래야 다음에 같은 일이 나도 되살릴 수 있다.
`07_cron.sql` 이 그 첫 사례다.

## 내려 적으면서 눈에 띈 것

- `relationship_type` enum 과 `rooms.relationship_type` 컬럼이 **아직 살아 있다.**
  PRD는 2026-08-19에 관계 유형을 폐기했다. 컬럼은 nullable 이라 당장 해가 없지만,
  문서와 DB가 어긋난 자리다.
- `guardian_verifications` 는 RLS를 켜고 **정책을 하나도 두지 않았다.** 실수가 아니라
  "service_role 외에는 아무도 접근 못 함"의 표현이다. 지우지 말 것.
- `heart_messages.duration_matches_type` 은 영상을 **2~3초**로 묶고 있다.
  PRD §6-③은 영상 최대 30초로 개정됐는데 **DB는 아직 옛 규칙이다.**
  `lib/limits.ts` 에도 영상 길이 상수가 아예 없다 — 즉 30초 정책은 문서에만 있고
  DB에도 코드에도 반영된 적이 없다.
