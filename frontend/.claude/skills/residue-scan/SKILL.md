---
name: residue-scan
description: 이식한 코드에 잔여데이터 구조·PRD 위반·경계면 버그가 있는지 검사한다. "검증해줘", "잔여데이터 확인", "빌드 전에 확인", "이거 문제없나", "QA", "검사 돌려줘" 같은 요청과, 화면 이식이 끝날 때마다 반드시 사용할 것. 검사 규칙을 고치거나 면제를 다는 후속 작업("이건 오탐이야", "규칙 추가")에도 사용한다.
---

# 잔여데이터·검증 관문

## 두 개의 도구

```bash
# 1. 잔여데이터·PRD 위반 검사 (1초)
node .claude/skills/residue-scan/scripts/residue-scan.mjs

# 2. 전체 관문: 잔여데이터 → 타입 → 린트 → 빌드
bash .claude/skills/residue-scan/scripts/verify.sh
bash .claude/skills/residue-scan/scripts/verify.sh --skip-build   # 작업 중엔 이걸로
```

순서에 이유가 있다. **빠르고 잘 걸리는 것부터** 돌린다.
앞에서 걸리면 뒤를 돌릴 이유가 없다 — 빌드는 가장 느리다.

## 검사 규칙

`BLOCK`은 고치기 전엔 다음 화면으로 넘어가지 않는다. `WARN`은 판단이 필요하다.

| 규칙 | 등급 | 잡는 것 |
|---|---|---|
| `dom-state-machine` | BLOCK | `getElementById`, `innerHTML=`, `classList.add('active')` — 프로토타입 화면 전환 방식 |
| `inline-handler` | BLOCK | `onclick="…"` — 마크업을 그대로 붙여넣은 신호 |
| `module-level-mutable` | BLOCK | 0번 칸의 `let`/`var` — 서버에서 요청 사이에 값이 남는다 |
| `mock-data` | BLOCK | `dummy`, `mockData`, `샘플데이터` — PRD "절대 하지 마" |
| `prd-excluded-feature` | BLOCK | 댓글·이모지·용량그래프·폰트토글 — 빼기로 한 기능 |
| `server-client-mix` | BLOCK | `'use client'`가 서버 전용 모듈 import |
| `service-role-key` | BLOCK | 이 키는 비워 두기로 했다 |
| `seeded-list-state` | WARN | `useState([{…}])` — 목록을 클라이언트 초기값에 |
| `physical-delete` | WARN | `.delete()` — 방 나가기/차단은 상태값만 (탈퇴는 예외) |
| `hardcoded-color` | WARN | 토큰에 없는 hex — WCAG 검증을 안 거친 색 |

## 오탐일 때 — 검사기를 끄지 말고 면제를 달아라

규칙은 대부분 옳지만 항상 옳지는 않다. 면제 수단이 없으면 사람들이 검사기 자체를 꺼버린다.

파일 안 아무 데나 (보통 머리말 주석에):

```js
// residue-scan-allow: hardcoded-color — 관계방 커버용 팔레트. 배경 전용이라 글자 대비 기준 대상이 아니다.
```

**이유를 반드시 적어라.** 규칙 id만 적고 넘어가면 6개월 뒤에 아무도 판단을 못 되짚는다.

면제가 아니라 규칙이 틀린 거라면 `scripts/residue-scan.mjs`의 `RULES`를 고쳐라.
같은 오탐이 두 번 이상 나오면 그건 규칙 문제다.

## 기계가 못 잡는 것 — 여기에 사람 시간을 쓴다

스크립트는 **패턴**을 잡는다. **동작**은 못 잡는다. 화면마다 직접 확인할 것:

- 화면을 나갔다 다시 들어오면 이전 값이 보이는가? → `revalidatePath` 누락
- 폼을 제출하고 뒤로 가면 입력값이 남는가?
- 방 A를 보다 방 B로 가면 A의 데이터가 잠깐 보이는가? → `key` 누락
- 목록을 클라이언트에서 수정해 서버 데이터와 어긋나는가?

**경계는 양쪽을 다 열어서 대조하라.** 한쪽만 보고 "맞겠지" 하면 놓친다:

| 경계 | 대조할 두 파일 |
|---|---|
| 서버 액션 ↔ 화면 | 액션의 반환 타입 / 화면의 구조분해 |
| DB ↔ 타입 | `src/types/database.ts` / 쿼리의 `select()` |
| 폼 ↔ 액션 | `<input name=…>` / `formData.get(…)` |

## 지적하는 법

재현 경로 없는 지적은 하지 마라. 이식가가 판단할 수 없다.

나쁨: "상태 관리가 불안정함"
좋음: "사서함에서 `보낸` 탭을 누르고 방 상세로 갔다 돌아오면 `보낸`이 선택된 채
`받은` 목록이 보인다. `mailbox-tabs.tsx:34`의 `useState` 초기값이 URL이 아니라 상수라서."

확신이 없으면 "확인 필요"에 넣고 **왜 확신이 없는지** 적어라.
애매한 걸 BLOCK에 넣으면 멀쩡한 코드를 고치다 진짜 버그가 생긴다.

지적할 게 없으면 없다고 하라. 미안해서 억지로 찾아내지 마라.
