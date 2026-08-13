'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * 화면 아래 탭. 홈 / 사서함 / 마이 세 개뿐이다.
 *
 * 시니어 사용자가 주요 대상이라 아이콘만 두지 않고 글자 라벨을 반드시 함께 보여준다.
 * 라벨도 화면의 다른 글자와 같은 17px(text-base)이다 — 탭 글자라고 작게 줄이지 않는다.
 * 탭을 늘리지 않는다 — 네비게이션이 단순해야 한다(04_PROJECT_SPEC.md).
 *
 * 직접 부르지 말고 TabScreen을 쓸 것. 이 탭은 화면 위에 떠 있는 게 아니라
 * TabScreen이 만든 세로 배치의 맨 아래 칸이다. 혼자 갖다 쓰면 자리를 못 잡는다.
 */

type NavItem = {
  href: string
  label: string
  icon: ReactNode
  /** 하위 경로까지 현재 탭으로 볼지. 홈(/)만 정확히 일치할 때 켠다. */
  exact?: boolean
}

const iconProps = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: '홈',
    exact: true,
    icon: (
      <svg {...iconProps}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V20h13V9.5" />
      </svg>
    ),
  },
  {
    href: '/mailbox',
    label: '사서함',
    icon: (
      <svg {...iconProps}>
        <path d="M3 7.5h18v12H3z" />
        <path d="m3 8 9 6 9-6" />
      </svg>
    ),
  },
  {
    href: '/my',
    label: '마이',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 20c0-3.6 3.4-5.5 7.5-5.5s7.5 1.9 7.5 5.5" />
      </svg>
    ),
  },
]

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function BottomNav() {
  const pathname = usePathname() ?? '/'

  return (
    <nav
      aria-label="주요 메뉴"
      className="shrink-0 border-t border-hairline bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex w-full max-w-md">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item)

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  // 라벨이 17px이라 아이콘까지 합치면 68px쯤 된다.
                  'flex min-h-[68px] flex-col items-center justify-center gap-1 py-2',
                  'text-base leading-tight transition-colors',
                  // 지금 보고 있는 탭을 색만으로 알리지 않는다.
                  // 색을 구분하기 어려운 분도 알아볼 수 있게 글자 굵기까지 함께 바꾼다(WCAG 1.4.1).
                  active ? 'font-bold text-primary' : 'font-medium text-muted',
                ].join(' ')}
              >
                {item.icon}
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
