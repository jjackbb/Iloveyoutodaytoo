'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { DatePickerModal } from '@/app/rooms/[roomId]/date-picker-modal'
import { formatKstFullDate, kstTodayKey } from '@/lib/format'

/**
 * 피드 찾아보기 — 누가 올렸는지 / 언제 올렸는지로 좁혀 보기 (노션 IA 3.4 · 6.8).
 *
 * **고르는 일만 여기서 하고, 거르는 일은 서버가 한다.** 고른 값은 주소(?who=&on=)에
 * 실려 서버로 가고, 서버가 그 조건으로 다시 읽어 내려준다.
 * 화면이 30개를 받아놓고 자기가 걸러 보여주지 않는다 — 그러면 "화면에 보이는 목록"과
 * "실제 데이터"가 어긋나고, 걸러낸 만큼 목록이 짧아진다.
 *
 * 주소에 실리니 뒤로가기로 되돌아가고, 그 화면을 그대로 다시 열 수도 있다.
 *
 * 잔여데이터가 아닌 이유: 이 부품이 들고 있는 것은 "달력이 열려 있는가" 하나뿐이다.
 * 고른 조건은 전부 주소에 있다.
 */

export type FeedAuthor = { id: string; name: string }

export function FeedSearch({
  authors,
  /** 지금 걸려 있는 작성자 필터(users.id). 없으면 전체. */
  who,
  /** 지금 걸려 있는 날짜 필터(KST, YYYY-MM-DD). */
  on,
  /** 조건이 없어도 찾기 칸을 열어둘지. 주소의 ?find=1 이 정한다. */
  open,
  /** 이 조건으로 찾은 결과가 몇 개인지. 0이면 안내가 달라진다. */
  resultCount,
}: {
  authors: FeedAuthor[]
  who: string | null
  on: string | null
  open: boolean
  resultCount: number
}) {
  const router = useRouter()
  const [calendarOpen, setCalendarOpen] = useState(false)

  /** 조건 하나를 갈아 끼운 주소로 옮긴다. 나머지 조건은 그대로 둔다. */
  function apply(next: { who?: string | null; on?: string | null }) {
    const params = new URLSearchParams()
    const nextWho = next.who === undefined ? who : next.who
    const nextOn = next.on === undefined ? on : next.on

    if (nextWho) params.set('who', nextWho)
    if (nextOn) params.set('on', nextOn)
    // 조건을 다 지워도 찾기 칸은 열린 채로 둔다 — 지우자마자 칸이 사라지면
    // 다시 고르려고 처음부터 찾아 들어가야 한다.
    params.set('find', '1')

    router.push(`?${params.toString()}`)
  }

  function closeSearch() {
    router.push('?')
  }

  if (!open) return null

  const filtered = who !== null || on !== null

  return (
    <section
      aria-label="추억 찾아보기"
      className="mt-2 flex flex-col gap-3 rounded-card bg-card px-4 py-4 shadow-card"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-medium text-ink">누가 올렸나요</h2>
        <div className="flex flex-wrap gap-2">
          <Chip selected={who === null} onClick={() => apply({ who: null })}>
            모두
          </Chip>
          {authors.map((author) => (
            <Chip
              key={author.id}
              selected={who === author.id}
              onClick={() => apply({ who: author.id })}
            >
              {author.name}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-medium text-ink">언제 올렸나요</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCalendarOpen(true)}
            className="flex min-h-11 items-center gap-2 rounded-chip border border-hairline-strong px-4 text-base font-medium text-ink active:bg-surface-soft"
          >
            <CalendarIcon />
            {on ? formatKstFullDate(`${on}T00:00:00+09:00`) : '날짜 고르기'}
          </button>

          {on ? (
            <button
              type="button"
              onClick={() => apply({ on: null })}
              className="min-h-11 px-3 text-base font-medium text-primary active:bg-primary-soft"
            >
              날짜 지우기
            </button>
          ) : null}
        </div>
      </div>

      {/*
        결과가 없을 때 목록 자리만 비면 "고장 났나" 싶어진다. 무엇으로 찾았는지와
        되돌리는 길을 여기서 함께 말해준다.
      */}
      {filtered && resultCount === 0 ? (
        <p role="status" className="text-base leading-relaxed break-keep text-muted">
          이 조건에 맞는 추억이 없어요.
        </p>
      ) : null}

      <div className="flex justify-between gap-2 border-t border-hairline pt-3">
        {filtered ? (
          <button
            type="button"
            onClick={() => apply({ who: null, on: null })}
            className="min-h-11 px-2 text-base font-medium text-primary active:bg-primary-soft"
          >
            조건 지우기
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={closeSearch}
          className="min-h-11 px-2 text-base font-medium text-muted active:bg-surface-soft"
        >
          찾기 닫기
        </button>
      </div>

      {calendarOpen ? (
        <DatePickerModal
          selected={on}
          today={kstTodayKey()}
          onCancel={() => setCalendarOpen(false)}
          onPick={(date) => {
            setCalendarOpen(false)
            apply({ on: date })
          }}
        />
      ) : null}
    </section>
  )
}

/** 고른 것은 색과 글씨 굵기 **둘 다**로 알린다 — 색만으로 알리지 않는다. */
function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        'min-h-11 rounded-chip border px-4 text-base',
        selected
          ? 'border-primary bg-primary-soft font-bold text-primary'
          : 'border-hairline-strong font-medium text-ink active:bg-surface-soft',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function CalendarIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
    </svg>
  )
}
