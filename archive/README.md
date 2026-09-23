# 보관 자료

2026-09-22 사용자 요청에 따라 과거 분석·작업 기록·시안·참고 자료를 이 폴더에 모았다. **현재 작업의 입구는 [프로젝트 README](../README.md), 현재 계획은 [PLAN](../PLAN.md)**이다.

보관은 폐기나 결정 취소를 뜻하지 않는다. 특히 확정 카드 시안과 과거 의사결정·검증 자료는 계속 근거로 사용한다. 과거 문서의 ‘지금’, ‘다음 작업’, ‘완료’, ‘NOT_RUN’은 당시 시점의 기록이며 현재 실행 지시·검증 결과로 읽지 않는다.

## 자료 찾기

| 보관 자료 | 용도 |
|---|---|
| [PORTFOLIO_PLAN.md](PORTFOLIO_PLAN.md) | 초기 코드 분석·기술 설계와 당시 제안 |
| [WORKLOG.md](WORKLOG.md) · [HANDOFF_BUILD.md](HANDOFF_BUILD.md) · [결정 기록](DECISIONS_2026-09-06.md) | 과거 구현·선택·검증·인수인계 |
| [HANDOFF_LOGO.md](HANDOFF_LOGO.md) · [logo.png](logo.png) | 로고 작업 기록과 과거 원본 이미지. 현재 사용 자산은 `frontend/public/`에 유지 |
| [toss_DESIGN.md](toss_DESIGN.md) · [Senior UX_Spread.pdf](<Senior UX_Spread.pdf>) | 디자인 참고 자료. 현재 사용자의 특성을 입증하는 자료는 아님 |
| [과거 PRD 사본](app_Iloveyoutodaytoo/PRD.md) | 이전 사본 보존. 명세 참조는 [루트 PRD](../PRD.md) |
| [디자인 점검](design/AUDIT.md) · [점검 스크립트](design/audit.py) | 당시 점검 결과·도구. 재실행은 `frontend/`에서 `python3 ../archive/design/audit.py`; 이번 정리에서 실행하지 않음 |
| [디자인 캔버스](design/canvas/) | 시안·비교안·캔버스 데이터 묶음. [확정 카드 시안](design/canvas/components/Main.dc.html)은 현재 디자인 결정의 근거 |
| [이전 작업 공간](frontend/_workspace/) | 화면별 명세·기획·QA·로고 시안·선택 과정 |
| [이전 캡처](frontend/catch/) | 원본 화면 캡처와 크롭 이미지 |
| [협업 실험](안티그래비티협업_테스트/) | HTML 시안·캔버스·과거 편집 스크립트 |

## 이전 위치와 이동 원칙

이 폴더 안의 자료는 **기존 프로젝트 상대 경로 앞에 `archive/`를 붙인 위치**에 있다. 예: `frontend/_workspace/12_ux_baseline.md` → `archive/frontend/_workspace/12_ux_baseline.md`. 기존 코드 주석이나 과거 문서의 경로 표기를 만났을 때도 이 규칙으로 찾는다.

- 모든 이동 파일과 이동 전후 SHA-256은 [이동 목록](MOVE_MANIFEST.json)에 남겼다. 문서 안내·링크를 바꾼 파일은 별도로 표시한다.
- 과거 기록의 본문·당시 판단은 보존하고, 현재 문서로 안내하는 보관 표기와 이동에 따른 문서 링크만 정리했다.
- 폴더 내부의 상대 경로가 유지되도록 시안·이미지·캔버스는 묶음으로 이동했다. 일부 캔버스 HTML의 `support.js` 등은 이동 전부터 없었으며, 보관만으로 독립 실행을 검증한 것은 아니다.
- 과거 실험 스크립트에는 당시 절대 경로나 임시 경로가 남아 있을 수 있다. 원본으로 보존하며 현재 작업 자동화로 사용하지 않는다.
- 실행 의존성이 있는 앱·서버 코드(`frontend/src/`, `android/`, `supabase/`), 공용 자산·설정·데모 실행/검사 스크립트는 원래 위치에 유지했다.
- `.next/`, `node_modules/`, 환경 파일과 Git 이력은 이번 이동·삭제 대상이 아니다.

파일 정리는 서비스 구현·배포·사용자 테스트 결과를 추가하지 않는다. 외부 개인비서 자료함은 기존 기록 위치를 유지한다.
