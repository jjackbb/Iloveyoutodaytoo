'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { DatePickerModal } from '@/app/rooms/[roomId]/date-picker-modal'
import { formatKstFullDate, kstTodayKey } from '@/lib/format'

/**
 * 피드에서 찾기 — 카카오톡 채팅방 검색과 같은 방식 (노션 IA 3.4 · 6.8).
 *
 * **목록을 거르지 않는다.** 조건에 맞는 게시물이 어느 것인지만 알아내고,
 * 화면은 그 자리로 데려간다(∧∨로 앞뒤 결과 이동). 피드는 늘 전체가 그대로 보인다.
 * (사용자 결정 2026-08-20 — "결과로 이동으로 ㄱㄱ, 걸러서 보기는 필요없어")
 *
 * 거르지 않기로 한 이유: 찾는 사람이 알고 싶은 것은 "그 말이 어디 있었나"이지
 * "그 말이 든 목록"이 아니다. 걸러버리면 앞뒤 맥락이 사라져서, 찾고 나서 다시
 * 전체 목록으로 돌아가 그 자리를 또 찾아야 한다.
 *
 * 찾는 일 자체는 서버가 한다. 고른 값은 주소(?q=&who=&on=)에 실려 가고,
 * 서버가 걸린 게시물 번호를 돌려준다 — 화면이 30개를 받아놓고 자기가 뒤지지 않는다.
 * 주소에 실리니 뒤로가기로 되돌아가고, 그 화면을 그대로 다시 열 수도 있다.
 *
 * 잔여데이터가 아닌 이유: 이 부품이 들고 있는 것은 입력칸의 초안과
 * "달력이 열려 있는가"뿐이다. 고른 조건은 전부 주소에 있다.
 */

export type FeedAuthor = { id: string; name: string }

export function FeedSearch({
  authors,
  /** 지금 걸려 있는 작성자 필터(users.id). 없으면 전체. */
  who,
  /** 지금 걸려 있는 날짜 필터(KST, YYYY-MM-DD). */
  on,
  /** 지금 걸려 있는 검색어. */
  q,
  /** 조건이 없어도 찾기 칸을 열어둘지. 주소의 ?find=1 이 정한다. */
  open,
  /** 이 조건으로 몇 개를 찾았는지. 0이면 안내가 달라진다. */
  matchCount,
}: {
  authors: FeedAuthor[]
  who: string | null
  on: string | null
  q: string | null
  open: boolean
  matchCount: number
}) {
  const router = useRouter()
  const [calendarOpen, setCalendarOpen] = useState(false)

  /** 입력칸의 초안. 엔터를 누르거나 [찾기]를 눌러야 주소에 반영된다. */
  const [draft, setDraft] = useState(q ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  /*
    서버가 새 결과를 내려주면 입력칸도 그 값에 맞춘다.
    뒤로가기로 이전 검색으로 돌아왔는데 칸에 옛 글자가 남아 있으면,
    화면에 보이는 목록과 칸의 내용이 서로 다른 말을 하게 된다.

    효과(useEffect)가 아니라 **그리는 중에** 맞춘다. 효과로 고치면 한 번 옛 값으로
    그린 뒤에 다시 그려서 글자가 깜빡인다. 직전에 받은 검색어를 따로 기억해 두고
    달라졌을 때만 갈아끼운다(React가 권하는 방식).
  */
  const [lastQ, setLastQ] = useState(q)
  if (q !== lastQ) {
    setLastQ(q)
    setDraft(q ?? '')
  }

  // 찾기 칸을 열면 바로 칠 수 있게 커서를 둔다. 카톡 돋보기도 그렇게 동작한다.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  /** 조건 하나를 갈아 끼운 주소로 옮긴다. 나머지 조건은 그대로 둔다. */
  function apply(next: {
    who?: string | null
    on?: string | null
    q?: string | null
  }) {
    const params = new URLSearchParams()
    const nextWho = next.who === undefined ? who : next.who
    const nextOn = next.on === undefined ? on : next.on
    const nextQ = next.q === undefined ? q : next.q

    if (nextQ) params.set('q', nextQ)
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

  const filtered = who !== null || on !== null || q !== null

  return (
    <section
      aria-label="추억 찾아보기"
      className="mt-2 flex flex-col gap-3 rounded-card bg-card px-4 py-4 shadow-card"
    >
      {/*
        글자로 찾기 — 카카오톡 채팅방의 돋보기와 같은 자리다.
        form으로 감싸는 이유: 모바일 자판의 [검색] 키가 그대로 동작하고,
        엔터로도 찾아진다. 버튼만 두면 자판을 내렸다가 다시 눌러야 한다.
      */}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          apply({ q: draft.trim() || null })
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor="feed-q" className="text-base font-medium text-ink">
          어떤 말이 들어 있나요
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id="feed-q"
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="문구나 댓글 속 한 마디"
            enterKeyHint="search"
            className="min-h-11 min-w-0 flex-1 rounded-inner border border-hairline-strong bg-card px-3.5 text-base text-ink"
          />
          <button
            type="submit"
            className="min-h-11 shrink-0 rounded-inner bg-primary px-4 text-base font-bold text-white active:bg-primary-active"
          >
            찾기
          </button>
        </div>
        {q ? (
          <button
            type="button"
            onClick={() => apply({ q: null })}
            className="min-h-11 self-start px-1 text-base font-medium text-primary active:bg-primary-soft"
          >
            ‘{q}’ 지우기
          </button>
        ) : null}
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-medium text-ink">누가 올린 것에서</h2>
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
        <h2 className="text-base font-medium text-ink">언제 올린 것에서</h2>
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
        찾은 결과를 말해준다. 목록은 그대로라 아무것도 안 바뀐 것처럼 보이기 때문에,
        **찾았는지 못 찾았는지는 반드시 글자로 알려야 한다.**
        몇 번째를 보고 있는지는 아래 떠 있는 줄이 이어서 말한다.
      */}
      {filtered ? (
        <p role="status" className="text-base leading-relaxed break-keep text-muted">
          {matchCount > 0
            ? `${matchCount}개를 찾았어요. 아래 화살표로 하나씩 볼 수 있어요.`
            : '이 조건에 맞는 추억을 찾지 못했어요.'}
        </p>
      ) : null}

      <div className="flex justify-between gap-2 border-t border-hairline pt-3">
        {filtered ? (
          <button
            type="button"
            onClick={() => apply({ who: null, on: null, q: null })}
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
