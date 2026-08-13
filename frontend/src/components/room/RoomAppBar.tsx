import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * 앨범방 화면들의 머리띠 (캡처 10·12·22).
 *
 * 모양: [←] 제목 ………… [오른쪽 동작들]
 * 제목은 가운데가 아니라 뒤로 버튼 바로 옆에 붙는다(캡처 그대로).
 *
 * 왜 layout.tsx가 아니라 화면마다 두는가:
 * 화면마다 제목도 오른쪽 동작도 다르다(피드는 방 이름 + 멤버추가, 작성은 "마음 표현하기"만).
 * 레이아웃은 현재 경로를 모르므로 한 곳에서 그리려면 조건이 계속 늘어난다.
 * 대신 레이아웃은 "이 방의 멤버인가"만 확인하고, 머리띠는 이 부품을 각 화면이 부른다.
 *
 * 뒤로 버튼도 목적지를 props로 받는다. 어디로 돌아가는지는 화면마다 정해져 있어서
 * 브라우저 기록이나 현재 경로를 들여다볼 필요가 없다 — 그래서 이 부품은 서버 컴포넌트로 남는다.
 */
export function RoomAppBar({
  backHref,
  backLabel,
  title,
  children,
}: {
  backHref: string
  /** 낭독기에 읽힐 뒤로 버튼 이름. 예: "홈으로 돌아가기" */
  backLabel: string
  title: string
  /** 오른쪽에 붙는 동작들(멤버 추가 등). 없으면 제목이 그대로 남는다. */
  children?: ReactNode
}) {
  return (
    // 바탕색이 페이지와 같고 아래 선이 없다 — 캡처처럼 본문과 이어져 보인다.
    <header className="shrink-0 bg-canvas">
      <div className="mx-auto flex w-full max-w-md items-center gap-1 px-2 pt-1.5 pb-3">
        {/*
          꺾쇠만 있는 뒤로 버튼(캡처 그대로).
          이 앱은 아이콘만 두지 않는 것이 원칙이지만(BottomNav 참고) 여기만 예외다 —
          바로 옆에 제목이 붙어 있어 "어디에서 뒤로 가는지"가 글자로 드러나고,
          꺾쇠는 앱 머리띠에서 가장 굳어진 기호다. 낭독기에는 목적지를 이름으로 전한다.
        */}
        <Link
          href={backHref}
          aria-label={backLabel}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-surface-soft"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 5 8 12l7 7" />
          </svg>
        </Link>

        <h1 className="min-w-0 flex-1 truncate px-1 text-xl font-extrabold tracking-[-0.02em] text-ink">
          {title}
        </h1>

        {children}
      </div>
    </header>
  )
}

/**
 * 머리띠 오른쪽 아이콘 자리의 모양.
 *
 * 보이는 크기는 캡처와 같은 40px 남짓이지만 누르는 칸은 44px을 지킨다.
 * 링크가 아닌 것(더보기 서랍을 여는 버튼)도 같은 자리에 서므로 클래스를 밖으로 낸다 —
 * 두 벌로 적어두면 한쪽만 고쳐져 아이콘 높이가 어긋난다.
 */
export const ROOM_APP_BAR_ACTION_CLASS =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-surface-soft'

/**
 * 머리띠 오른쪽의 동그란 아이콘 링크 (캡처 10의 person+).
 */
export function RoomAppBarLink({
  href,
  label,
  children,
}: {
  href: string
  /** 아이콘만 있으므로 이름은 반드시 준다. */
  label: string
  children: ReactNode
}) {
  return (
    <Link href={href} aria-label={label} className={ROOM_APP_BAR_ACTION_CLASS}>
      {children}
    </Link>
  )
}
