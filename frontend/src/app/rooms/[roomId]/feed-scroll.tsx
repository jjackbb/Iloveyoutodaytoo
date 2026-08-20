'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/**
 * 피드의 스크롤 칸 — 여기에 두 가지가 붙는다.
 *
 * 1. **맨 아래(또는 맨 위)로 한 번에 가기** (노션 IA 3.4)
 * 2. **찾은 결과로 데려가기** — 카카오톡 채팅방 검색과 같은 방식이다.
 *    목록을 거르지 않고, 걸린 게시물로 옮겨가며 그 카드를 표시해 준다
 *    (사용자 결정 2026-08-20 — "걸러서 보기는 필요없어").
 *
 * **왜 스크롤 칸까지 이 부품이 그리나:** 움직여야 할 칸을 ref로 직접 쥐기 위해서다.
 * id로 찾아 쓰면(document.getElementById) 프로토타입의 DOM 조작 방식으로 되돌아간다.
 * 카드 목록은 `children`으로 받는다 — 서버에서 그려진 그대로 꽂히므로
 * 피드 내용은 브라우저 번들에 들어가지 않는다.
 *
 * 카드가 어디 있는지도 DOM을 뒤져 찾지 않는다. 카드마다 감싸는 `FeedItem`이
 * 자기 자리를 알려주고(register), 자기가 지금 결과인지도 스스로 안다.
 *
 * 잔여데이터가 아닌 이유: 스크롤 위치와 "몇 번째 결과를 보는 중인가"만 들고 있고,
 * 어디에도 저장하지 않는다. 찾은 결과 자체는 서버가 매번 다시 알려준다.
 */

/** 이만큼도 스크롤할 게 없으면 [맨 아래로]를 띄우지 않는다(대략 한 화면 반). */
const MIN_SCROLLABLE_PX = 400
/** 끝에서 이 정도 안쪽이면 "다 왔다"고 본다. */
const EDGE_SLACK_PX = 80

type FeedMatch = {
  /** 지금 데려간 게시물. 그 카드만 표시가 붙는다. */
  currentId: string | null
  register: (memoryId: string, element: HTMLElement | null) => void
}

const FeedMatchContext = createContext<FeedMatch>({
  currentId: null,
  register: () => {},
})

/**
 * 피드 카드 한 장을 감싸는 자리.
 *
 * 하는 일은 둘뿐이다 — 자기 자리를 위에 알려주는 것, 그리고 자기가 지금 결과일 때
 * 테두리를 두르는 것. 카드 내용은 서버가 그린 그대로 지나간다.
 */
export function FeedItem({
  memoryId,
  children,
}: {
  memoryId: string
  children: ReactNode
}) {
  const { currentId, register } = useContext(FeedMatchContext)
  const isCurrent = currentId === memoryId

  return (
    <li
      ref={(element) => register(memoryId, element)}
      // 결과 표시는 테두리로만 한다 — 카드 안의 사진이나 글을 가리지 않는다.
      // scroll-mt는 데려갔을 때 머리띠에 가려지지 않을 만큼의 여유다.
      className={[
        'scroll-mt-4 rounded-card transition-shadow',
        isCurrent ? 'ring-2 ring-primary ring-offset-2 ring-offset-canvas' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </li>
  )
}

export function FeedScroll({
  children,
  /** 카드가 하나도 없으면 [맨 아래로]를 만들지 않는다. */
  showJump = true,
  /** 찾은 게시물 번호들 — 화면에 놓인 순서 그대로. 비어 있으면 찾는 중이 아니다. */
  matchIds = [],
}: {
  children: ReactNode
  showJump?: boolean
  matchIds?: string[]
}) {
  const scrollRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const [atBottom, setAtBottom] = useState(false)

  /** 카드 번호 → 그 카드의 자리. FeedItem이 채워 넣는다. */
  const nodesRef = useRef(new Map<string, HTMLElement>())

  const register = useCallback((memoryId: string, element: HTMLElement | null) => {
    if (element) nodesRef.current.set(memoryId, element)
    else nodesRef.current.delete(memoryId)
  }, [])

  /** 지금 몇 번째 결과인가. */
  const [cursor, setCursor] = useState(0)
  const matchKey = matchIds.join(',')

  /*
    새로 찾으면 첫 결과부터 다시 센다.

    효과가 아니라 **그리는 중에** 되돌린다. 효과로 고치면 옛 번호로 한 번 그린 뒤에
    다시 그려서 "3개 중 2번째"가 잠깐 스쳐 지나간다.
    직전에 받은 결과를 따로 기억해 두고 달라졌을 때만 되돌린다(React가 권하는 방식).
  */
  const [lastMatchKey, setLastMatchKey] = useState(matchKey)
  if (matchKey !== lastMatchKey) {
    setLastMatchKey(matchKey)
    setCursor(0)
  }

  /*
    새로 찾았으면 첫 결과로 데려간다.

    이건 효과가 제자리다 — 상태를 고치는 게 아니라 **바깥(스크롤 위치)을 맞추는** 일이고,
    실제로 화면을 움직이는 일은 그려진 다음에야 할 수 있다.
  */
  useEffect(() => {
    if (!matchKey) return
    const first = matchKey.split(',')[0]
    const node = nodesRef.current.get(first)
    if (!node) return
    node.scrollIntoView({
      block: 'center',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [matchKey])

  const currentId = useMemo(() => matchIds[cursor] ?? null, [matchIds, cursor])

  const contextValue = useMemo<FeedMatch>(
    () => ({ currentId, register }),
    [currentId, register],
  )

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
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  /** 이전(위)·다음(아래) 결과로. 끝에서 반대쪽 끝으로 감는다 — 카톡도 그렇게 돈다. */
  function step(direction: 1 | -1) {
    if (matchIds.length === 0) return
    const next = (cursor + direction + matchIds.length) % matchIds.length
    setCursor(next)

    const node = nodesRef.current.get(matchIds[next])
    node?.scrollIntoView({
      block: 'center',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }

  const searching = matchIds.length > 0

  return (
    <FeedMatchContext.Provider value={contextValue}>
      <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {children}
      </main>

      {/*
        찾는 중에는 결과 사이를 오가는 줄이, 아닐 때는 [맨 아래로]가 뜬다.
        둘이 같이 뜨면 같은 자리에서 서로 다른 곳으로 데려가 헷갈린다.
      */}
      {searching ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 bottom-36 z-30 flex items-center gap-1 rounded-chip bg-card py-1 pr-1 pl-4 shadow-card"
        >
          <span className="text-base font-bold tabular-nums text-ink">
            {matchIds.length}개 중 {cursor + 1}번째
          </span>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="이전 결과로"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-surface-soft"
          >
            <span className="rotate-180">
              <ArrowDownIcon />
            </span>
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="다음 결과로"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-surface-soft"
          >
            <ArrowDownIcon />
          </button>
        </div>
      ) : showJump && visible ? (
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
    </FeedMatchContext.Provider>
  )
}

/** 움직임을 줄여 달라고 설정한 분에게는 흐르는 애니메이션 대신 즉시 옮긴다. */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
      aria-hidden
    >
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  )
}
