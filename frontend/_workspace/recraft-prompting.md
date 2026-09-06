# Recraft 프롬프트 역설계 (2026-09-06 조사)

공식: https://www.recraft.ai/docs — 특히 `how-to-generate-a-logo`, `prompt-panel`,
`working-with-text-and-prompts/negative-prompts`, `recraft-models/recraft-v4-1`.
보조: Ropewalk / Phygital+ / Toolchase / MindStudio / PixelDojo 가이드(3자, 교차확인용).

## 1. 스튜디오 실제 순서 (공식 문서 기준)

| | 할 것 |
| :--- | :--- |
| 1 | Create 탭 → 생성 타입 **Vector** |
| 2 | 모델 **V4.1 Vector**($0.08/장). 확정 후에만 **Vector Pro**($0.30) |
| 3 | 스타일 검색창에 `logo` → **Geometric Logo** (그 외 Sharp Drawn Logo, Playful Typographic) |
| 4 | **Colors 컨트롤**에 hex 지정 — 프롬프트에 박는 것보다 정확하고 프롬프트가 짧아진다 |
| 5 | 프롬프트는 짧게 (아래 3절) |
| 6 | Generation count 4~6 |
| 7 | 좋은 결과 클릭 → **Generation recipe**로 설정 재사용 (시드 고정 대신 이것) |

**3번을 건너뛰면 안 된다.** 스타일 미선택 시 Recraft 기본값이 나오고, 그것이 우리가
"AI스럽다"고 느끼는 것의 정체다. 프롬프트로는 못 막는다.

## 2. 모델 티어

| 모델 | 용도 |
| :--- | :--- |
| V4.1 (raster) | 구도 탐색 |
| **V4.1 Vector** | **로고·아이콘은 이것.** 진짜 패스가 나온다(래스터 트레이싱 아님) |
| V4.1 Vector Pro | 확정본 |
| Utility 계열 | 목업·상품컷용. 로고에는 안 씀 |

## 3. 프롬프트 규칙

1. **디자인 타입으로 문장을 연다** — `Flat vector logo mark,` / `App icon for` / `Icon set representing`.
   Recraft는 첫 단어를 강한 조종 신호로 읽는다.
2. **짧게.** V4.1은 공식적으로 "짧은 프롬프트에서 더 잘 나오게" 만든 모델이다.
   3자 실측으로도 로고는 200자 이내가 긴 것과 같거나 낫고, 40단어를 넘으면 초점을 잃는다.
   세부는 프롬프트가 아니라 생성 후 **자연어 편집·Generation recipe**로 잡는다.
3. **감정이 아니라 기하.** "specificity about geometry beats specificity about feeling."
   → 1차 실패의 교훈과 동일. [[logo-brief-geometry-not-nouns]]
4. **색은 Colors 컨트롤로.** 프롬프트에 넣어야 한다면 `using only #0F5F57` 처럼 hex로.
5. **배경 명시** — transparent background / white background.
6. **부정어를 쓰지 마라.**
   - Negative prompt 칸은 **프롬프트 패널의 설정(톱니) 안**에 있다. 기본 컨트롤 목록에 없어서
     안 보인다. API 호환성 표 기준 **V2/V3 전용**이라 V4에서 먹는지는 불확실.
   - 공식 팁 ① `no apples`가 아니라 `apples`(이중부정이 반대 효과) ② **원하지 않는 것은
     아예 언급하지 않는 게 낫다** — 언급하면 오히려 나온다.
   - → 클리셰는 금지하는 게 아니라 **기하를 조여 들어갈 자리를 없앤다.**
     (1차 실패에서 "메뉴로 보이면 안 됨"이라 썼더니 메뉴 아이콘이 나왔다.)
   - `Avoid text in image` 토글은 별개 스위치.
7. **텍스트는 큰따옴표로.** `"오늘도 사랑해"` — 워드마크 단계에서.
8. **레퍼런스 첨부**: 캔버스에서 이미지를 한 번 클릭하면 선택, **한 번 더 클릭해야** Add references에 붙는다.

## 4. 로고 작업 순서

1. **심볼만** 4~6개 생성 (텍스트 없이)
2. 고른 뒤 **워드마크 결합**: `logo for "NAME", [심볼 설명] + wordmark, [서체 카테고리]`
3. **변형**: dark background version / horizontal vs stacked / logomark only
4. 자연어 편집으로 세부 수정 ("change the stroke to 3px")

## 5. 한계 — 알고 들어갈 것

- **Recraft는 80%다.** SVG를 Figma/Illustrator 또는 코드에서 정리해야 한다.
- 약한 곳: 커스텀 레터링, **정확한 기하 구성(그리드·안전영역)**, 문화적 레퍼런스.
  → **66dp 안전영역·모노크롬·48dp 검증은 Recraft가 못 한다. 받아와서 이쪽에서 한다.**

## 6. 오늘도사랑해용 프롬프트 4종 (2026-09-06)

색은 Colors 컨트롤에 넣는다: A `#0F5F57` / B `#1F4E79` / C `#8A3B2E` / D `#1B3A5C`
(전부 흰 글자 대비 AA 통과 — 7.5 / 8.7 / 7.7 / 11.6 : 1)

A) Flat vector logo mark, two thick rounded arcs curving toward each other,
   overlapping at the center into one solid mass, both outer ends open,
   heavy uniform stroke, transparent background, app icon

B) Flat vector logo mark, one thick rounded rectangle with a shallow notch cut
   into its top edge, one small horizontal rounded lozenge floating above the
   notch offset to the right, bold geometric, transparent background, app icon

C) Flat vector logo mark, three thick rounded horizontal bands of different
   lengths and thicknesses joined at the left by a short vertical spine forming
   one connected object, transparent background, app icon

D) Flat vector logo mark, a heart formed by two thick monoline strokes that cross
   near the bottom and extend slightly past each other, rounded terminals,
   uniform weight, transparent background, app icon

### negative prompt (칸은 프롬프트 패널 설정 안에 있다)

**명사만, 부정어 없이, 짧게.** `no candle`이 아니라 `candle` — "no"를 붙이면 반대로 작동한다.

| 안 | negative prompt |
| :--- | :--- |
| A | `shadow, gradient, text, frame` |
| B | `candle, flame, bowl, spoon, shadow, text` |
| C | `menu icon, list, bar chart, equalizer, text` |
| D | `sparkle, photo frame, shadow, gradient, text` |

V4에서 실제로 먹는지는 B에 `candle`을 넣고 촛불이 사라지는지로 판정한다. 안 먹으면 비운다.

---

B는 촛불 오독을 막으려 눈물방울 → 가로 알약 + 오른쪽 오프셋.
C는 정렬 아이콘 오독을 막으려 왼쪽 세로 척추로 이어 한 덩어리.
D는 "닫히지 않은 하트" — 아직 다 못 한 말이 남았다는 뜻.
