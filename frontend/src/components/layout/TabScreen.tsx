import type { ReactNode } from 'react'

import { AppBar } from './AppBar'
import { BottomNav } from '@/components/nav/BottomNav'

/**
 * 아래 탭이 달린 화면(홈·사서함·마이)의 공통 껍데기.
 *
 * 세 칸으로 나뉜다.
 *   제목 줄  — 고정. 스크롤해도 사라지지 않는다.
 *   본문     — 여기만 스크롤된다.
 *   액션 줄  — 고정. 화면의 주요 버튼 하나를 둔다. 없으면 그리지 않는다.
 *   탭       — 고정.
 *
 * 왜 이렇게 묶었나:
 * 전에는 세 화면이 각자 BottomNav를 부르고, 탭에 가려지지 않도록 여백 클래스를
 * 손으로 붙이고 있었다. 화면을 하나 더 만들 때 그걸 빠뜨리면 마지막 항목이
 * 탭 아래에 깔려 안 보인다. 여백을 계산하는 대신 아예 세로로 쌓아서
 * 그런 실수가 나올 자리를 없앴다.
 */
export function TabScreen({
  title,
  leading,
  trailing,
  align,
  action,
  children,
}: {
  title: string
  /** 제목 줄 왼쪽에 놓을 것 (뒤로 가기 등). 있으면 제목을 가운데로 맞춘다. */
  leading?: ReactNode
  /** 제목 줄 오른쪽에 놓을 것 */
  trailing?: ReactNode
  /**
   * 제목 정렬. 안 주면 leading이 있을 때 'center'가 된다 — 뒤로 가기가 붙는 화면의 기본값이다.
   * 홈처럼 leading이 뒤로 가기가 아니라 **브랜드 아이콘**인 화면은 'start'를 직접 준다.
   */
  align?: 'start' | 'center'
  /** 화면 아래 고정할 주요 버튼. 목록 끝까지 스크롤하지 않아도 누를 수 있다. */
  action?: ReactNode
  children: ReactNode
}) {
  return (
    // 100dvh: 모바일 브라우저 주소창이 접혔다 펴져도 높이가 흔들리지 않는다.
    <div className="flex h-[100dvh] flex-col">
      <AppBar
        title={title}
        leading={leading}
        trailing={trailing}
        align={align ?? (leading ? 'center' : 'start')}
      />

      <main className="min-h-0 flex-1 overflow-y-auto">
        {/* 좌우 20px·세로 간격은 프로토타입 값이다. 예전(24px)보다 살짝 좁다. */}
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 pt-1 pb-8">
          {children}
        </div>
      </main>

      {action ? (
        // 액션 줄은 바탕이 아니라 흰색이다 — 페이지에서 한 겹 들려 있어야 눈에 먼저 들어온다.
        <div className="shrink-0 border-t border-hairline bg-card px-5 py-3">
          <div className="mx-auto w-full max-w-md">{action}</div>
        </div>
      ) : null}

      <BottomNav />
    </div>
  )
}
