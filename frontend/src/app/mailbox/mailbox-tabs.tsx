'use client'

import {
  useCallback,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from 'react'

import { MessageList } from './message-list'
import {
  fetchMailboxPage,
  hideHeartMessages,
  type MailboxBox,
  type MailboxFilter,
  type MailboxItem,
  type MailboxPage,
} from '@/lib/actions/mailbox'

/**
 * "받은 마음" / "보낸 마음" 두 탭 + 그 아래 칩 줄 (캡처 38).
 *
 * 첫 화면은 서버에서 미리 받아 오고, 나머지는 눌렀을 때 가져온다.
 * 한 번 가져온 탭은 그대로 두어서 왔다 갔다 해도 다시 기다리지 않는다.
 *
 * **칩을 바꾸면 쌓아둔 목록을 버린다.** 거르는 조건이 달라졌으니 예전 목록은
 * 더 이상 그 조건의 답이 아니다 — 남겨두면 "♡"를 눌렀는데 ♡가 아닌 카드가
 * 그대로 보이는, 프로토타입이 폐기된 바로 그 잔여 화면이 된다.
 */

const TABS: { box: MailboxBox; label: string }[] = [
  { box: 'received', label: '받은 마음' },
  { box: 'sent', label: '보낸 마음' },
]

/**
 * 칩 줄 (캡처 38 — 전체·♡·초대·일대일·랜덤).
 *
 * "초대"는 빠져 있다. 사서함에 쌓이는 것은 heart_messages뿐인데 초대는 `invitations`
 * 테이블의 일이라, 그 칩은 눌러도 늘 빈 목록이 된다. 이유는 actions/mailbox.ts와
 * _workspace/11_mailbox_send_port.md에 적었다.
 */
const FILTERS: { value: MailboxFilter; label: string; accessibleLabel: string }[] =
  [
    { value: 'all', label: '전체', accessibleLabel: '전체 보기' },
    { value: 'favorite', label: '♡', accessibleLabel: '♡ 표시한 마음만 보기' },
    { value: 'direct', label: '일대일', accessibleLabel: '한 분에게 보낸 마음만 보기' },
    { value: 'random', label: '랜덤', accessibleLabel: '랜덤으로 오간 마음만 보기' },
  ]

type BoxState = MailboxPage & {
  loading: boolean
  /** 한 번이라도 불러온 적 있는지. "비어 있음"과 "아직 안 불러옴"을 구분한다. */
  loaded: boolean
  /**
   * 서버에서 지금까지 건네받은 줄 수. "더 보기"의 시작 위치로 쓴다.
   * 화면에 그린 개수(items.length)를 쓰면, 겹쳐 온 메시지를 걸러낸 만큼
   * 시작 위치가 앞당겨져 같은 자리를 계속 다시 읽게 된다.
   */
  fetched: number
}

const EMPTY_BOX: BoxState = {
  items: [],
  hasMore: false,
  error: null,
  loading: false,
  loaded: false,
  fetched: 0,
}

/**
 * 이미 있는 목록 뒤에 새로 받은 것을 이어 붙인다.
 *
 * "더 보기"를 누르기 직전에 새 마음이 도착하면 목록 전체가 한 칸씩 밀려서
 * 이미 보고 있던 메시지가 한 번 더 딸려 온다. 같은 id는 한 번만 남긴다
 * (그대로 두면 화면에 같은 카드가 두 장 그려진다).
 */
function mergeItems(
  previous: MailboxItem[],
  next: MailboxItem[],
): MailboxItem[] {
  if (next.length === 0) return previous
  const seen = new Set(previous.map((item) => item.id))
  return [...previous, ...next.filter((item) => !seen.has(item.id))]
}

/** 서버 액션 호출 자체가 실패했을 때 보여줄 문구. */
const CONNECTION_ERROR = '연결이 잠시 불안정했어요. 잠시 후 다시 시도해주세요.'

export interface MailboxTabsProps {
  /** 서버에서 미리 받아 온 첫 페이지 (거르지 않은 '전체') */
  initialPage: MailboxPage
  /** 그 첫 페이지가 어느 탭의 것인지. 마음을 보낸 직후에는 '보낸 마음'으로 온다. */
  initialBox: MailboxBox
}

export function MailboxTabs({ initialPage, initialBox }: MailboxTabsProps) {
  const [box, setBox] = useState<MailboxBox>(initialBox)
  const [filter, setFilter] = useState<MailboxFilter>('all')

  /*
    정리(편집) 모드 — 노션 IA 2.2.

    켜는 순간 카드가 링크 대신 고르는 칸이 된다. 고른 것을 [치우기]로 내 사서함에서
    감춘다. **지우는 게 아니라 치우는 것**이라 상대의 보낸함에는 그대로 남는다.
    잔여데이터가 아닌 이유: 고른 목록은 정리하는 동안만 쓰고, 끝나면 비운다.
  */
  const [editing, setEditing] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [hiding, startHiding] = useTransition()
  const [state, setState] = useState<Record<MailboxBox, BoxState>>(() => ({
    received: EMPTY_BOX,
    sent: EMPTY_BOX,
    [initialBox]: {
      ...initialPage,
      loading: false,
      loaded: true,
      fetched: initialPage.items.length,
    },
  }))

  // 이미 요청을 보낸 탭인지 기록해 둔다. 탭을 연달아 눌러도 중복 요청이 나가지 않는다.
  const requested = useRef<Set<MailboxBox>>(new Set<MailboxBox>([initialBox]))
  const tabRefs = useRef<Record<MailboxBox, HTMLButtonElement | null>>({
    received: null,
    sent: null,
  })

  const load = useCallback(
    async (target: MailboxBox, offset: number, chip: MailboxFilter) => {
      setState((prev) => ({
        ...prev,
        [target]: { ...prev[target], loading: true, error: null },
      }))

      let page: MailboxPage
      try {
        page = await fetchMailboxPage(target, offset, chip)
      } catch {
        // 서버 액션 호출 자체가 실패하는 경우(연결 끊김, 서버 오류)가 있다.
        // 여기서 잡지 않으면 "불러오고 있어요…"가 영원히 돌면서
        // 사용자에게는 아무 안내도 가지 않는다.
        page = { items: [], hasMore: false, error: CONNECTION_ERROR }
      }

      // 실패한 탭은 "이미 불러왔다" 표시를 지운다. 그래야 탭을 다시 눌러 재시도할 수 있다.
      // 반대로 성공했으면 다시 표시해 둔다. 표시를 지운 채로 두면, 한 번 실패했다가
      // "다시 시도"로 살아난 탭이 나중에 탭을 오갈 때 첫 페이지부터 새로 불러와
      // "더 보기"로 쌓아둔 목록이 통째로 사라진다.
      if (page.error) requested.current.delete(target)
      else requested.current.add(target)

      setState((prev) => {
        const previous = prev[target]

        return {
          ...prev,
          [target]: {
            // 실패했으면 보고 있던 목록을 지우지 않는다.
            // offset이 0이면 새로 불러온 것이고, 아니면 "더 보기"라 뒤에 이어 붙인다.
            items: page.error
              ? previous.items
              : offset === 0
                ? page.items
                : mergeItems(previous.items, page.items),
            // 실패했을 때 hasMore를 false로 덮으면 "더 보기"가 사라져 이어 볼 방법이 없어진다.
            hasMore: page.error ? previous.hasMore : page.hasMore,
            error: page.error,
            loading: false,
            loaded: true,
            fetched: page.error ? previous.fetched : offset + page.items.length,
          },
        }
      })
    },
    [],
  )

  const selectBox = useCallback(
    (next: MailboxBox) => {
      setBox(next)
      if (requested.current.has(next)) return
      requested.current.add(next)
      void load(next, 0, filter)
    },
    [filter, load],
  )

  /** 칩을 바꾼다. 쌓아둔 목록은 버리고 지금 보고 있는 탭만 새로 불러온다. */
  const selectFilter = useCallback(
    (next: MailboxFilter) => {
      if (next === filter) return
      setFilter(next)
      setState({ received: EMPTY_BOX, sent: EMPTY_BOX })
      requested.current = new Set<MailboxBox>([box])
      void load(box, 0, next)
    },
    [box, filter, load],
  )

  /** ♡를 눌러 서버 값이 바뀐 뒤. 첫 페이지부터 다시 읽어 화면과 DB를 맞춘다. */
  const refresh = useCallback(() => {
    void load(box, 0, filter)
  }, [box, filter, load])

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()

    const next: MailboxBox = box === 'received' ? 'sent' : 'received'
    selectBox(next)
    tabRefs.current[next]?.focus()
  }

  const current = state[box]

  return (
    <section className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="사서함 종류"
        onKeyDown={handleTabKeyDown}
        // 트랙은 가라앉히고 고른 칸만 흰색으로 띄운다 (프로토타입 .seg).
        className="grid grid-cols-2 gap-1 rounded-inner bg-hairline p-1"
      >
        {TABS.map((tab) => {
          const selected = tab.box === box

          return (
            <button
              key={tab.box}
              ref={(element) => {
                tabRefs.current[tab.box] = element
              }}
              type="button"
              role="tab"
              id={`mailbox-tab-${tab.box}`}
              aria-selected={selected}
              // 화면에 그려지는 목록은 지금 고른 탭 하나뿐이다.
              // 없는 요소를 가리키면 화면 낭독기가 관계를 읽지 못하므로, 고른 탭에만 붙인다.
              aria-controls={selected ? `mailbox-panel-${tab.box}` : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectBox(tab.box)}
              className={[
                'min-h-[48px] rounded-[11px] px-4 py-2 text-lg transition-colors',
                // 고른 칸을 색만으로 알리지 않는다 — 굵기와 그림자까지 함께 바뀐다(WCAG 1.4.1).
                selected
                  ? 'bg-card font-bold text-primary shadow-pill'
                  : 'bg-transparent font-bold text-muted hover:text-ink',
              ].join(' ')}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/*
        칩 줄 (캡처 38). 좁은 화면에서는 옆으로 민다 — 여러 줄로 접으면
        목록이 아래로 밀려 첫 카드가 화면 밖으로 나간다.
        -mx-screen-x + px-screen-x: 미는 줄이 화면 가장자리까지 이어지게 한다.
      */}
      <div
        role="group"
        aria-label="마음 거르기"
        className="-mx-screen-x flex gap-2 overflow-x-auto px-screen-x pb-1"
      >
        {FILTERS.map((chip) => {
          const selected = chip.value === filter

          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={selected}
              aria-label={chip.accessibleLabel}
              onClick={() => selectFilter(chip.value)}
              className={[
                'min-h-[44px] shrink-0 rounded-chip border px-4 text-base whitespace-nowrap transition-colors',
                // 고른 칩은 색뿐 아니라 테두리·굵기까지 바뀐다(WCAG 1.4.1).
                selected
                  ? 'border-primary bg-primary font-bold text-white'
                  : 'border-hairline-strong bg-card font-medium text-muted active:bg-surface-soft',
              ].join(' ')}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/*
        정리 줄 (노션 IA 2.2의 편집 모드).

        캡처에는 롱프레스로 들어가지만 버튼으로 뒀다. 이유가 바뀌었으니 다시 적는다 —
        그전에는 "시니어라 흔적 없는 제스처를 못 쓴다"였는데, 부모님도 카톡에서
        메시지를 꾹 눌러 답장하신다(_workspace/12_ux_baseline.md).
        지금 근거는 **여러 개를 고르는 일이라서**다. 롱프레스로 편집 모드에 들어가면
        "지금 고르는 중"이라는 상태가 어디에도 안 보인다. 버튼은 그 상태를 켜고 끄는
        자리를 만들어 준다. 나가는 길([취소])도 같은 줄에 생긴다.
      */}
      {current.items.length > 0 ? (
        <div className="mt-3 flex items-center justify-end gap-2">
          {editing ? (
            <>
              <button
                type="button"
                disabled={picked.length === 0 || hiding}
                onClick={() =>
                  startHiding(async () => {
                    await hideHeartMessages(picked)
                    setPicked([])
                    setEditing(false)
                    refresh()
                  })
                }
                className="min-h-[44px] rounded-chip px-3 text-base font-medium text-primary disabled:text-muted"
              >
                {hiding
                  ? '치우는 중…'
                  : picked.length > 0
                    ? `${picked.length}개 치우기`
                    : '치울 마음을 골라주세요'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setPicked([])
                }}
                className="min-h-[44px] rounded-chip px-3 text-base text-muted"
              >
                취소
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="min-h-[44px] rounded-chip px-3 text-base text-muted"
            >
              정리하기
            </button>
          )}
        </div>
      ) : null}

      <div
        role="tabpanel"
        id={`mailbox-panel-${box}`}
        aria-labelledby={`mailbox-tab-${box}`}
        tabIndex={0}
      >
        <MessageList
          box={box}
          items={current.items}
          hasMore={current.hasMore}
          loading={current.loading || !current.loaded}
          error={current.error}
          // 화면에 그린 개수(items.length)가 아니라 서버에서 받은 줄 수(fetched)를 넘긴다.
          // 겹쳐 온 메시지를 걸러낸 만큼 items.length가 작아져서, 그대로 쓰면
          // 이미 읽은 자리를 계속 다시 읽고 목록이 더 늘지 않는다.
          onLoadMore={() => void load(box, current.fetched, filter)}
          onRetry={() => void load(box, 0, filter)}
          onRefresh={refresh}
          editing={editing}
          picked={picked}
          onTogglePick={(id) =>
            setPicked((was) =>
              was.includes(id) ? was.filter((x) => x !== id) : [...was, id],
            )
          }
        />
      </div>
    </section>
  )
}
