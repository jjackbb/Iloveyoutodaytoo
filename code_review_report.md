# Frontend Code Review Report

백엔드 연동(Phase 4)으로 넘어가기 전, 현재 프론트엔드 코드베이스의 안정성, 성능, 그리고 확장성을 평가하기 위해 전체적인 코드 리뷰 및 린트(Lint) 검증을 진행했습니다.

## 1. 정적 분석 (Lint & Type Check) 결과
Next.js 빌드 및 린트 결과, 치명적인 빌드 에러는 없었으나 몇 가지 코드 품질 경고와 잠재적 버그 요소가 발견되었습니다.

### 주요 이슈
- **상태 동기화 패턴 경고 (React Hooks)**: `useEffect` 내부에서 동기적으로 `setState`를 호출하여 Hydration(SSR -> CSR) 상태를 관리하는 부분(`isMounted` 패턴 등)이 React의 엄격한 순수성(Purity) 규칙에 의해 경고를 받고 있습니다. (예: `page.tsx`, `VoiceRecorderDialog.tsx`)
- **비순수 함수 렌더링 (`Math.random`)**: `Waveform.tsx`에서 `useMemo` 내부에 난수 생성 로직이 들어가 있습니다. `useMemo`는 순수(Pure)해야 하므로 렌더링 최적화 과정에서 문제가 발생할 수 있습니다. `useState` 지연 초기화로 변경이 필요합니다.
- **특수문자 이스케이프 누락**: `invite/[token]/page.tsx`에서 쌍따옴표(`"`)를 직접 사용해 React 렌더링 경고가 발생했습니다. (`&quot;` 사용 필요)
- **미사용 변수 (Unused Variables)**: 일부 파일에서 `duration`, `useMockStore` 등 선언만 하고 사용하지 않은 변수들이 있습니다.
- **이미지 최적화 권장**: 일반 `<img>` 태그가 사용된 곳이 있습니다. 성능 최적화(LCP 개선)를 위해 가급적 `next/image`의 `<Image />` 태그 도입을 고려해야 합니다.

## 2. 아키텍처 및 폴더 구조 평가
- **컴포넌트 분리도**: 모달(`Dialog`)과 같은 공통 UI가 `VoiceRecorderDialog`처럼 적절히 모듈화되어 재사용성이 뛰어납니다. 다만, `albums/[id]/page.tsx`와 같이 여러 기능이 섞인 복잡한 페이지는 향후 `FeedItem`, `ReplyInput` 등으로 더 잘게 쪼개는 것(Refactoring)이 유리합니다.
- **상태 관리 구조**: Zustand 기반의 `useMockStore` 설계가 잘 구성되어 있어, 백엔드 연동 시 이 Store의 내부 로직만 API 호출로 교체(Swap)하면 쉽게 실제 데이터를 반영할 수 있습니다.
- **디자인 시스템**: Tailwind v4 방식과 Airbnb CSS 변수(`--color-primary` 등)가 `globals.css`를 통해 Shadcn 컴포넌트에 잘 매핑되어 있어, 향후 다크모드나 테마 변경 시에도 유연하게 대처할 수 있습니다.

## 3. 백엔드 연동 전 권장 개선 사항 (Action Items)
1. **Lint 에러 수정 (즉시 진행 예정)**: 빌드 안정성을 위해 발견된 사소한 린트 에러(특수문자, `useMemo` 난수, 미사용 변수 등)를 클린업합니다.
2. **이미지 컴포넌트 마이그레이션**: 스토리지 연동(Firebase Storage 등) 시, 업로드된 이미지를 렌더링할 때 `next/image`를 도입하여 로딩 성능을 최적화합니다.
3. **컴포넌트 세분화**: 백엔드 로직이 길어지는 것에 대비해, 앨범 피드 등 무거운 페이지의 UI 컴포넌트화를 추가 진행합니다.

> [!TIP]
> 백엔드로 넘어가기 전, 제가 즉각적으로 1번(Lint 에러 수정 및 최적화) 작업을 자동 수행하여 코드를 더욱 깨끗하게 정리해 드릴 수 있습니다.
