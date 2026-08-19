'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 피드의 스크롤 칸 + 맨 아래(또는 맨 위)로 한 번에 가는 떠 있는 버튼 (노션 IA 3.4).
 *
 * 피드는 새 추억이 위, 오래된 추억이 아래다. 추억이 쌓일수록 "처음에 뭐가 있었지"를
 * 보려면 한참을 밀어야 한다 — 시니어 사용자에게는 그 자체가 벽이다.
 *
 * **한 방향 버튼으로 만들지 않았다.** 내려가는 길만 있으면 내려간 사람이 돌아올 방법이
 * 없어서 결국 손으로 다 밀어 올려야 한다. 그래서 맨 아래에 닿으면 같은 자리의 버튼이
 * [맨 위로]로 바뀐다. 자리와 크기는 그대로라 손이 헤매지 않는다.
 *
 * 스크롤할 것이 거의 없으면 아예 뜨지 않는다 — 눌러도 아무 일이 없는 버튼을 두지 않는다.
 *
 * **왜 스크롤 칸까지 이 부품이 그리나:** 버튼이 움직여야 할 칸을 ref로 직접 쥐기 위해서다.
 * id로 찾아 쓰면(document.getElementById) 프로토타입의 DOM 조작 방식으로 되돌아간다.
 * 카드 목록은 `children`으로 받는다 — 서버에서 그려진 그대로 꽂히므로
 * 피드 내용은 브라우저 번들에 들어가지 않는다.
 *
 * 잔여데이터가 아닌 이유: 스크롤 위치를 읽기만 하고 아무것도 저장하지 않는다.
 */

/** 이만큼도 스크롤할 게 없으면 버튼을 띄우지 않는다(대략 한 화면 반). */
const MIN_SCROLLABLE_PX = 400
/** 끝에서 이 정도 안쪽이면 "다 왔다"고 본다. */
const EDGE_SLACK_PX = 80

export function FeedScroll({
  children,
  /** 카드가 하나도 없으면 버튼을 만들지 않는다. */
  showJump = true,
}: {
  children: ReactNode
  showJump?: boolean
}) {
  const scrollRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const [atBottom, setAtBottom] = useState(false)

  useEffect(() => {
    const target = scrollRef.current
    if (!target) return

    function update() {
      if (!target) return
      const scrollable = target.scrollHeight - target.clientHeight
      setVisible(scrollable > MIN_SCROLLABLE_PX)
      setAtBottom(target.scrollTop >= scrollable - EDGE_SLACK_PX)
    }

    update()
    target.addEventListener('scroll', update, { passive: true })

    /*
      사진이 늦게 그려지면 피드 길이가 나중에 늘어난다. 그때 다시 재지 않으면
      "스크롤할 게 없다"고 판단한 첫 결과가 그대로 굳는다.
    */
    const observer = new ResizeObserver(update)
    observer.observe(target)

    return () => {
      target.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [])

  function jump() {
    const target = scrollRef.current
    if (!target) return
    target.scrollTo({
      top: atBottom ? 0 : target.scrollHeight,
      // 화면이 통째로 갈아끼워지면 어디로 온 건지 알 수 없다. 흐르듯 움직여야
      // "아래로 갔구나"가 읽힌다. 움직임을 줄여 달라고 설정한 분에게는 즉시 옮긴다.
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    })
  }

  return (
    <>
      <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {children}
      </main>

      {showJump && visible ? (
        <button
          type="button"
          onClick={jump}
          /*
            아래 고정 줄([마음 표현하기])과 탭 위로 떠 있다. bottom-36은 그 둘의 높이를
            피한 자리다. 오른쪽에 붙여 카드 글을 가리지 않는다.
          */
          className="fixed right-4 bottom-36 z-30 flex h-12 items-center gap-1.5 rounded-chip bg-card pr-4 pl-3 text-base font-bold text-ink shadow-card active:bg-surface-soft"
        >
          <span aria-hidden className={atBottom ? 'rotate-180' : undefined}>
            <ArrowDownIcon />
          </span>
          {atBottom ? '맨 위로' : '맨 아래로'}
        </button>
      ) : null}
    </>
  )
}

function ArrowDownIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  )
}
