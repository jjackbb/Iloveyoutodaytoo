'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 달력 모달 (노션 IA 6.8) — 추억을 찾을 날짜 하나를 고른다.
 *
 * **날짜 입력칸(`<input type="date">`)을 쓰지 않은 이유:** 기기마다 생김새가 완전히
 * 다르고, 어떤 기기에서는 숫자를 직접 타자로 넣어야 한다. 주 사용자가 시니어라
 * "달력에서 날짜를 눈으로 찾아 누르는" 동작이 훨씬 확실하다.
 *
 * 날짜는 **KST 기준의 날짜 키(YYYY-MM-DD)** 로만 다룬다. Date 객체로 주고받으면
 * 브라우저 시간대에 따라 하루가 밀린다 — 밤 11시에 올린 추억이 다음 날로 잡히는 식이다.
 * 그래서 여기서는 연·월·일 숫자만 다루고, 시각은 아예 만들지 않는다.
 *
 * 잔여데이터가 아닌 이유: 지금 보고 있는 달(年月)만 들고 있고, 고르면 부모에게 넘기고 닫힌다.
 */

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** "2026-08-20" → { year: 2026, month: 8, day: 20 } */
function parseKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number)
  return { year, month, day }
}

function toKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 그 달의 1일이 무슨 요일인지(0=일). UTC로 계산해 시간대에 흔들리지 않게 한다. */
function firstWeekdayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function DatePickerModal({
  /** 지금 골라져 있는 날짜(YYYY-MM-DD). 없으면 오늘이 있는 달을 연다. */
  selected,
  /** 오늘(KST). 표시용이자, 처음 열 달을 정하는 기준이다. */
  today,
  onPick,
  onCancel,
}: {
  selected: string | null
  today: string
  onPick: (dateKey: string) => void
  onCancel: () => void
}) {
  const start = parseKey(selected ?? today)
  const [view, setView] = useState({ year: start.year, month: start.month })
  const closeRef = useRef<HTMLButtonElement>(null)

  // Esc로 닫는다. 달력을 열어놓고 빠져나갈 길이 버튼 하나뿐이면 안 된다.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  function shiftMonth(step: number) {
    setView((current) => {
      const raw = current.month + step
      if (raw < 1) return { year: current.year - 1, month: 12 }
      if (raw > 12) return { year: current.year + 1, month: 1 }
      return { year: current.year, month: raw }
    })
  }

  const blanks = firstWeekdayOf(view.year, view.month)
  const total = daysInMonth(view.year, view.month)
  const days = Array.from({ length: total }, (_, i) => i + 1)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="날짜 고르기"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-6"
    >
      <div className="w-full max-w-sm rounded-card bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="이전 달"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-surface-soft"
          >
            <ChevronIcon />
          </button>

          <h2 aria-live="polite" className="text-lg font-bold text-ink">
            {view.year}년 {view.month}월
          </h2>

          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="다음 달"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-surface-soft"
          >
            <span className="rotate-180">
              <ChevronIcon />
            </span>
          </button>
        </div>

        <div aria-hidden className="mt-2 grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((label) => (
            <span key={label} className="py-1 text-sm font-medium text-muted">
              {label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {/* 1일이 시작하는 요일까지 빈 칸을 채운다. */}
          {Array.from({ length: blanks }, (_, i) => (
            <span key={`blank-${i}`} />
          ))}

          {days.map((day) => {
            const key = toKey(view.year, view.month, day)
            const isSelected = key === selected
            const isToday = key === today

            return (
              <button
                key={key}
                type="button"
                onClick={() => onPick(key)}
                aria-pressed={isSelected}
                className={[
                  'flex h-11 items-center justify-center rounded-full text-base tabular-nums',
                  isSelected
                    ? 'bg-primary font-bold text-white'
                    : isToday
                      ? 'font-bold text-primary underline underline-offset-4'
                      : 'text-ink active:bg-surface-soft',
                ].join(' ')}
              >
                {day}
              </button>
            )
          })}
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={onCancel}
          className="mt-3 h-12 w-full rounded-inner border border-hairline-strong text-base font-medium text-ink active:bg-surface-soft"
        >
          닫기
        </button>
      </div>
    </div>
  )
}

function ChevronIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}
