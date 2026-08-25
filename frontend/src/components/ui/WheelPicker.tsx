'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * 드럼(휠) 선택기.
 *
 * 굴려서 고르는 그 모양이다. 가운데 줄에 걸린 값이 선택된 값이고,
 * 손을 떼면 가장 가까운 줄에 딱 맞춰 선다.
 *
 * 왜 라이브러리를 안 쓰나:
 * 브라우저에 이미 들어 있는 것(스크롤 + scroll-snap)으로 되는 일이다.
 * 스크롤을 직접 흉내 내면 관성·튕김·접근성을 전부 다시 만들어야 하고,
 * 그렇게 만든 것은 대개 진짜 스크롤보다 못하다.
 *
 * 접근성 — 휠은 굴려야만 쓸 수 있어서 화면 낭독기·키보드에는 통하지 않는다.
 * 그래서 **같은 값을 고르는 진짜 <select>**를 함께 둔다(WheelSelect).
 * 휠 쪽은 aria-hidden으로 감춰 같은 값이 두 번 읽히지 않게 했다.
 * 두 부품을 나란히 놓는 일은 쓰는 쪽(BirthDateField)이 한다 — 그래야
 * 초점이 왔을 때 select가 펼쳐지며 밀리는 자리를 강조 띠와 함께 맞출 수 있다.
 */

/** 한 줄 높이. 터치 목표 최소 44px 규칙과 같은 값이다. */
export const WHEEL_ITEM_HEIGHT = 44

/** 한 번에 보이는 줄 수. 홀수라야 가운데 줄이 생긴다. */
const VISIBLE_ROWS = 5

const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * VISIBLE_ROWS
/** 첫 줄·마지막 줄도 가운데까지 올라올 수 있도록 위아래에 두는 빈칸. */
const WHEEL_PADDING = (WHEEL_HEIGHT - WHEEL_ITEM_HEIGHT) / 2

/** 스크롤이 멈췄다고 보기까지 기다리는 시간(ms). 짧으면 굴리는 도중에 값이 튄다. */
const SETTLE_DELAY = 110

export interface WheelColumnProps {
  /** 고를 수 있는 값들. 위에서 아래 순서 그대로 늘어놓는다. */
  options: number[]
  value: number
  onChange: (value: number) => void
  /** 화면에 보일 글자. 예: (1985) => "1985년" */
  format: (value: number) => string
}

/** 휠 한 칸 (보이기 전용 — 낭독기에는 WheelSelect가 대신 읽힌다). */
export function WheelColumn({
  options,
  value,
  onChange,
  format,
}: WheelColumnProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedIndex = options.indexOf(value)

  /*
    바깥에서 값이 바뀌면(예: 2월을 고르는 바람에 31일이 28일로 밀렸을 때)
    휠도 그 자리로 옮긴다.

    이미 그 줄에 서 있으면 아무것도 하지 않는다. 이 확인을 빼면 사용자가
    굴려서 값을 바꿀 때마다 이 효과가 다시 끌어당겨 휠이 덜덜 떨린다.
  */
  useEffect(() => {
    const list = listRef.current
    if (!list || selectedIndex < 0) return

    const current = Math.round(list.scrollTop / WHEEL_ITEM_HEIGHT)
    if (current === selectedIndex) return

    list.scrollTo({ top: selectedIndex * WHEEL_ITEM_HEIGHT })
  }, [selectedIndex])

  // 화면에서 사라질 때 남은 타이머를 정리한다.
  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current)
    }
  }, [])

  function handleScroll() {
    if (settleTimer.current) clearTimeout(settleTimer.current)

    settleTimer.current = setTimeout(() => {
      const list = listRef.current
      if (!list) return

      const index = Math.min(
        options.length - 1,
        Math.max(0, Math.round(list.scrollTop / WHEEL_ITEM_HEIGHT)),
      )
      const next = options[index]
      if (next !== undefined && next !== value) onChange(next)
    }, SETTLE_DELAY)
  }

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      aria-hidden
      style={{
        height: WHEEL_HEIGHT,
        paddingTop: WHEEL_PADDING,
        paddingBottom: WHEEL_PADDING,
        scrollSnapType: 'y mandatory',
        /*
          원근. 이게 없으면 줄이 눕어도 그냥 납작하게 눌린 것으로만 보인다.
          값이 작을수록 드럼이 급하게 휜다 — 640px 정도가 손목만 한 드럼으로 읽힌다.
        */
        perspective: '640px',
      }}
      className="min-w-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map((option) => {
        const selected = option === value
        return (
          <div
            key={option}
            style={{ height: WHEEL_ITEM_HEIGHT, scrollSnapAlign: 'center' }}
            className={[
              'wheel-row flex items-center justify-center text-lg tabular-nums',
              /*
                고른 줄은 **굵기와 색**으로 알린다. 크기는 건드리지 않는다 —
                글자 크기를 바꾸면 줄 높이가 흔들려 scroll-snap 이 가운데를 놓친다.
                커 보이는 효과는 .wheel-row 의 scale 이 대신 낸다(높이는 그대로 두고).
              */
              selected ? 'font-extrabold text-ink' : 'text-muted',
            ].join(' ')}
          >
            {format(option)}
          </div>
        )
      })}
    </div>
  )
}

/**
 * 휠 칸들을 나란히 두는 틀.
 * 가운데 선택 줄 강조 띠를 여기서 한 번만 그린다 — 칸마다 그리면 사이가 끊겨 보인다.
 */
export function WheelGroup({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div
        aria-hidden
        style={{ height: WHEEL_ITEM_HEIGHT, top: WHEEL_PADDING }}
        className="pointer-events-none absolute inset-x-0 rounded-inner bg-primary-soft"
      />
      <div className="relative flex gap-1">{children}</div>
    </div>
  )
}

export interface WheelSelectProps extends WheelColumnProps {
  id: string
  /** 이 칸이 무엇을 고르는지. 낭독기가 읽는다. 예: "태어난 해" */
  label: string
}

/**
 * 휠 대신 쓰는 진짜 선택 상자.
 *
 * 평소에는 보이지 않다가 초점이 오면 나타난다 — 키보드로 쓰는 분이
 * "지금 어디에 있는지" 모른 채 갇히는 상황을 만들지 않기 위해서다.
 */
export function WheelSelect({
  id,
  label,
  options,
  value,
  onChange,
  format,
}: WheelSelectProps) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="sr-only focus:not-sr-only focus:min-h-[44px] focus:w-full focus:rounded-inner focus:border focus:border-hairline-strong focus:bg-card focus:px-3 focus:py-2 focus:text-lg focus:text-ink"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {format(option)}
          </option>
        ))}
      </select>
    </>
  )
}
