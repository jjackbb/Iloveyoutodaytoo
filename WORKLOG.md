## 2026-09-06 — 인프라·버그·앱 전환 (구현 세션)

**한 것**
- **Supabase 프로젝트가 멈춰 있던 것을 되살렸다.** 무료 플랜 미사용으로 INACTIVE 였고
  도메인이 NXDOMAIN 이라 **배포된 앱의 로그인·가입이 전부 죽어 있었다.** 90초 만에 복구.
- 스키마를 저장소로 내렸다(`frontend/supabase/schema/`, 7개 파일). 개수를 DB 실제와 대조해 일치.
- 보호자 인증 행 24시간 자동 정리(pg_cron). HANDOFF 6번은 **이걸로 끝났다.**
- 서버 버그 2건: 탈퇴 시 파일이 RPC 앞에서 지워지던 것, 조용히 실패하던 액션 4곳.
- 죽은 파일 정리(1.7G → 625M).
- **APP-01: Capacitor 안드로이드 껍데기.** 에뮬레이터에서 서버 액션 왕복까지 확인.

**결정과 이유**
- 패키지명 **`app.oneuldo.android`**, 앱 이름 **"오늘도 사랑해"**(사용자 확정).
  패키지명은 스토어 등록 후 못 바꾼다.
- 마이그레이션 파일이 저장소에 **하나도 없었다** — 스키마 원본이 라이브 DB 한 곳뿐이었다.
  앞으로 DB 변경은 `supabase/schema/` 에 파일로 먼저 남기고 적용한다(`07_cron.sql` 이 첫 사례).
- 사서함의 "치운 id 를 전부 URL 에 싣는" 문제는 **안 고쳤다.** 안티조인으로 바꾸면 되고
  문법도 200 으로 통과하지만 `heart_messages` 가 0행이라 실제로 걸러지는지 검증할 수 없다.
  사서함에 무엇이 보일지 정하는 쿼리라 검증 없이 바꾸지 않았다.

**함정**
- **Android Studio 내장 JDK 25 로는 빌드가 안 된다** — Gradle 8.14.3 이 "Unsupported class
  file major version 69" 로 죽는다. `JAVA_HOME=/opt/homebrew/opt/openjdk@21` 로 빌드할 것.
  `ANDROID_HOME=~/Library/Android/sdk`, `android/local.properties` 에 `sdk.dir` 필요(gitignore 됨).
- `.next` 를 지우면 Next.js 전역 타입(`PageProps`·`LayoutProps`)이 사라져 타입 검사가 18곳에서
  깨진다. `verify.sh` 는 타입 검사를 빌드보다 **먼저** 돌리므로, 캐시를 비운 뒤에는
  `npm run build` 를 한 번 돌리고 verify 할 것.
- 커밋할 때 `git add -A` 를 쓰지 말 것. 사용자가 PRD 를 편집 중이면 딸려 들어간다(실제로 한 번 그랬다).

**다음**
- **WIDGET-01 이 이제 안 막힌다** — 네이티브 프로젝트가 생겼다. 다만 시작 전에
  **위젯이 어떻게 인증하느냐**를 정해야 한다(권한 범위 결정이라 임의로 못 정한다).
- 딥링크 수단 선택(Firebase Dynamic Links 종료됨) → 그다음 FCM.
- WRITE-01 손글씨 → WRITE-02 타임랩스 → DAILY-01.

---

## 2026-09-06 — 로고 재작업 준비 (Recraft로 넘김)

**한 것**
- 기존 로고 진단: 사진 카드가 주인공(제품은 목소리), 인스타 연상, 로고 색을 UI에 못 씀
  (globals.css에 "버튼에 쓰지 마세요 — AA 미달"), PNG라 단색·크기 변형 불가.
- 안드로이드 전환으로 새로 생긴 제약 3개 확정: 적응형 아이콘 **가운데 66dp 안전영역**,
  **모노크롬 레이어(단색 실루엣으로 성립)**, **48dp 가독**. → 요소 1~2개·획 굵게가 통과 기준.
- superdesign으로 3안(A 파형 / B 보관·되살아남 / C 쌓임) 생성 → **3안 전부 반려**.
  A=보이스메모, B=촛불·향로(추모 연상), C=텍스트 정렬 아이콘. 82크레딧 소모.
- Recraft 프롬프트 역설계 → `frontend/_workspace/recraft-prompting.md`

**결정과 이유**
- 조형은 Recraft, 제약검증·SVG 코드화는 이쪽. 1차 실패로 역할 분담이 실증됨.
- **브리프에 명사를 주면 그 명사의 관습적 아이콘이 나온다.** 기하 구조로 지시할 것.
- 부정어("~로 보이면 안 됨")는 역효과 — 그 단어가 형태에 반영된다. 공식 문서도 같은 경고.

**함정**
- Recraft 스타일 검색창에 `logo` → **Geometric Logo** 를 반드시 고를 것. 스타일 미선택 시
  기본값이 나오고 그게 "AI스러움"의 정체다. 프롬프트로는 못 막는다.
- negative prompt 칸은 프롬프트 패널 **설정(톱니)** 안. V4 지원 여부는 미검증.

**다음**
- Recraft에서 4안(A 호 / B 그릇+알약 / C 띠 / D 닫히지 않은 하트) 뽑아오면
  → 66dp·모노크롬·48dp 검증 → BrandMark.tsx 인라인 SVG → 적응형 3레이어 + Play 512
  → globals.css 강조색 4줄 확정(219곳 따라옴) → /start 가운데 채우기 → design.md 작성

## 2026-09-06 (밤) — 로고·강조색 확정, 코드 반영 완료

**한 것**
- Recraft에서 나온 로고(봉투에서 나오는 하트)를 원본 픽셀 기준으로 벡터화 — 일치율 98.6%.
  하트 로브 원 r74.2·d48.4, 아래 변 45°, 플랩 밴드 18px, 꼭짓점 필렛 20, 모서리는 실측 스쿼클 프로파일.
- 강조색 **선명한 번트 #BF3F0D** 확정 → `globals.css` 4줄 + 버튼 그림자 + 브랜드 토큰, themeColor, manifest.
- `BrandMark.tsx` 인라인 SVG. `public/brand/`(logo.svg·mark.svg·playstore-512·logo-512), public 아이콘 3종.
- 안드로이드: mipmap 5밀도 × 3종, `values/ic_launcher_background.xml`, 모노크롬 벡터 드로어블 + adaptive xml.
- 루트 `design.md` 신설. tsc·lint 통과. 실행 중인 dev 서버 `/start` 스크린샷으로 확인.

**결정과 이유**
- 두 톤은 앞면 밝기 −1.5(#B83D0D) — "자세히 봐야 보이는" 정도. 사용자 결정.
- 하트·플랩은 투명 컷아웃이 아니라 **크림 면**(#F8F2EC) — 안드로이드 아이콘은 배경이 뭐가 될지 모른다.
- Pro 요금제: 루틴 3종 미실행 + 실사용 $346/주 → 전환해도 됨(Opus 주간 버킷만 미지수). 사용자 결정 대기.

**함정**
- Recraft 원본은 하트가 뚫린 투명이었고 #C17753 은 AA 미달(3.48:1) — 그대로 못 쓴다.
- 시안 브리프에 명사를 주면 관습 아이콘이 나온다(파형→보이스메모). 메모리 `logo-brief-geometry-not-nouns`.
- superdesign 무료 크레딧 소진(82cr, 전부 반려). 결제하지 않기로.
- chrome-devtools MCP가 "browser already running"으로 막힘 → 헤드리스 크롬 CLI로 스크린샷.

**다음**
- DESIGN-03: 아이콘 한 벌(63개 SVG·획 9종 → 1종), 모서리 하드코딩 6종 정리 — `design.md` §5.
- 안드로이드 실기기/에뮬레이터에서 런처·테마 아이콘 확인(Gradle 빌드는 openjdk@21).
- `/start`는 웹 폐기 랜딩으로 바뀌어 있어 "가운데 빈자리" 숙제는 소멸 — 앱 안 홈(`/`) 상단 마크만 확인하면 됨.
