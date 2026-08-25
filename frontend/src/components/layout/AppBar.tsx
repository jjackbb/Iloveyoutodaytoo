import type { ReactNode } from 'react'

/**
 * 화면 맨 위에 붙어 있는 제목 줄.
 *
 * 왜 고정인가:
 * 목록을 아래로 내리다 보면 "내가 지금 어느 화면에 있었지"를 잃어버린다.
 * 시니어 사용자에게 특히 그렇다. 제목은 항상 보이는 자리에 둔다.
 *
 * 방 화면(rooms/[roomId]/layout.tsx)에도 같은 골격의 줄이 있다.
 * 그쪽은 방 이름·초대 버튼처럼 방에만 있는 사정이 얽혀 있어 따로 두었다.
 * 둘 중 하나를 고칠 때 다른 쪽도 같이 볼 것.
 */
export function AppBar({
  title,
  leading,
  trailing,
  align = 'start',
}: {
  title: string
  /** 왼쪽에 놓을 것 (뒤로 가기 등) */
  leading?: ReactNode
  /** 오른쪽에 놓을 것 */
  trailing?: ReactNode
  /** 제목 정렬. 뒤로 가기가 있는 화면은 'center'가 자연스럽다. */
  align?: 'start' | 'center'
}) {
  return (
    // 아래 구분선을 두지 않는다. 제목 줄이 페이지와 같은 바탕색이라 선이 없어야 이어져 보인다.
    // 대신 카드가 흰색이라 스크롤해 올라와도 경계가 저절로 드러난다. (프로토타입 .appbar)
    <header className="shrink-0 bg-canvas">
      <div className="mx-auto flex w-full max-w-md items-center gap-2 px-5 pt-2 pb-3">
        {leading}

        <h1
          className={[
            // 브랜드 자리(왼쪽 정렬)는 더 크고 굵게, 화면 제목(가운데)은 한 단계 낮춘다.
            // 프로토타입의 .brand(19px/900) : .pagetitle(17px/800) 관계를 그대로 옮겼다.
            'min-w-0 flex-1 truncate text-ink',
            align === 'center'
              ? 'text-center text-xl font-bold'
              : 'text-2xl font-bold tracking-[-0.02em]',
          ].join(' ')}
        >
          {title}
        </h1>

        {/*
          오른쪽에 놓을 게 없어도 왼쪽 뒤로 버튼과 같은 너비를 비워둔다.
          안 그러면 가운데 맞춘 제목이 뒤로 버튼만큼 오른쪽으로 밀려 보인다.
        */}
        {trailing ??
          (align === 'center' && leading ? (
            <div aria-hidden className="w-11 shrink-0" />
          ) : null)}
      </div>
    </header>
  )
}
