# Recraft 프롬프트 역설계 (2026-09-06 조사)

출처: Recraft 공식 프롬프트 엔지니어링 가이드(logos-and-icons / prompting-with-recraft-v4),
Ropewalk V4 가이드, Phygital+ V4 가이드, Toolchase 가이드, MindStudio V4 Vector, PixelDojo V4.1 가이드.

## 1. 모델·티어 선택

| 모델 | 용도 |
| :--- | :--- |
| V4 (raster, 1cr) | 프롬프트·구도 탐색. ~1024px |
| V4 Pro (5cr) | 최종 렌더. ~2048px |
| **V4 Vector (SVG)** | **로고·아이콘은 이것.** 진짜 패스가 나온다(래스터 트레이싱 아님) |
| V4 Pro Vector | 구조가 복잡한 벡터 |

규율: **Standard로 프롬프트를 확정하고, 확정된 뒤에만 Pro로 최종본.** 탐색 단계에 5cr 태우지 않는다.

## 2. 프롬프트 6단 공식 (Ropewalk 실측)

```
[에셋 타입/심볼] + [스타일 서술] + [팔레트] + [배경] + [포맷·용도] + [품질 태그]
```

Phygital+ 의 표 버전 — 브리프를 이 6칸으로 쪼개서 쓴다:

| 칸 | 넣을 것 |
| :--- | :--- |
| Asset type | logo / icon / poster / packaging — **문장 첫 단어** |
| Subject | 무엇을 상징하는가 |
| Layout | 구도·계층 (centered, circular badge, 3x2 grid) |
| Typography | 정확한 문자열을 **큰따옴표**로. 서체 카테고리명 |
| Style system | flat vector / monoline / geometric |
| Constraints | 빼야 할 것 |

## 3. 핵심 규칙 8개

1. **디자인 타입으로 문장을 연다.** "Flat vector logo for…", "App icon for…", "Icon set representing…".
   Recraft는 첫 단어를 강한 조종 신호로 읽는다. 제네릭하게 열면 제네릭하게 나온다.
2. **짧게.** 로고 프롬프트는 **200자 이내**가 긴 것과 성능이 같거나 낫다(Ropewalk).
   **40단어를 넘으면 모델이 초점을 잃는다**(Toolchase). 세부는 프롬프트가 아니라
   생성 후 **edit/fine-tune 으로** 잡는다.
3. **감정이 아니라 기하.** "specificity about geometry beats specificity about feeling."
   → 우리 1차 실패(2026-09-06, [[logo-brief-geometry-not-nouns]])와 같은 결론.
4. **색은 hex로.** "using only #0F5F57" 이 "deep teal" 보다 훨씬 정확하다.
   팔레트 크기도 명시 — monochromatic / two-tone.
5. **배경을 반드시 명시.** white background 또는 transparent background.
6. **금지어는 본문이 아니라 negative prompt 칸에.** 본문에 "no A, no B, no C"를 잔뜩 넣으면
   그 단어들이 오히려 형태에 반영된다. 상비 블록:
   `photorealistic, photo, 3D render, shadows, gradients, watermark, text, complex background, noise, blurry edges, multiple objects`
7. **스타일 참조를 올린다.** 참조 3~5장을 업로드해 style lock. 안 올리면 Recraft 기본
   "제네릭 모던 플랫"이 나온다 — 이게 AI스러움의 주범.
8. **시드 고정 + 한 세션 안에서 배치 생성.** 세션이 갈리면 스타일이 조용히 드리프트한다.

## 4. 로고 작업 순서 (Recraft 권장)

1. **브리프** — 이름 + 업종 + 성격(3~4단어) + 색 1~3개. 이걸 건너뛰면 모델이 성격을 대신 고른다.
2. **심볼만** 6~10개 생성. `[업종] logo mark, [심볼 개념], [스타일], [색], white background, no text`
3. 고른 뒤 **워드마크 결합**: `logo for "NAME", [심볼 설명] + wordmark, [서체 카테고리], vector style`
4. **변형 요청**: dark background version / horizontal vs stacked / logomark only
5. **fine-tune 탭**에서 유사도 조절해 재생성, in-context edit으로 세부 수정
   ("remove the flames", "change the stroke to 3px")

## 5. 한계 — 알고 들어갈 것

- **Recraft는 80%다.** SVG를 Figma/Illustrator에서 반드시 정리해야 한다.
- 약한 곳: 커스텀 레터링 워드마크, **정확한 기하 구성(그리드·황금비)**, 문화적 레퍼런스.
  → 우리 케이스의 **66dp 안전영역·모노크롬 검증은 Recraft가 못 한다. 받아와서 이쪽에서 한다.**
- 30개 아이콘 세트 기준 약 20%는 2~3회 재생성해야 맞는다.
