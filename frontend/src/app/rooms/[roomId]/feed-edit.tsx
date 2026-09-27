'use client'

import Link from 'next/link'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react'

import {
  ConfirmDeleteManyDialog,
  ConfirmPublishDialog,
} from '@/components/memory/MemoryMenu'
import { deleteMemories, publishMemories } from '@/lib/actions/memories'

/**
 * 앨범방 편집 (2026-09-28 사용자 결정).
 *
 * [편집]을 누르면 내가 남긴 추억을 여러 장 골라 **공개로 바꾸기·수정·삭제**를 할 수 있다.
 * - 고를 수 있는 것은 내 글뿐이다. 남의 글은 흐리게 두고 눌리지 않게 막는다.
 * - 공개로 바꾸기는 고른 것 중 '나만 보기'가 하나라도 있을 때만 켜진다.
 * - 수정은 한 장만 골랐을 때만 켜진다 — 여러 장을 한 번에 고치는 화면은 없다.
 *
 * 편집 중인지는 주소(?edit=1)에 있다. 뒤로가기·새로고침으로 자연스럽게 빠져나온다.
 * 무엇을 골랐는지는 이 화면에만 있고 어디에도 저장하지 않는다.
 */

type Picked = { isPrivate: boolean }

type FeedEdit = {
  editing: boolean
  roomId: string
  selected: Map<string, Picked>
  toggle: (memoryId: string, picked: Picked) => void
  clear: () => void
}

const FeedEditContext = createContext<FeedEdit | null>(null)

export function FeedEditProvider({
  roomId,
  editing,
  children,
}: {
  roomId: string
  editing: boolean
  children: ReactNode
}) {
  const [selected, setSelected] = useState<Map<string, Picked>>(() => new Map())

  // 편집을 끝내면(주소에서 edit이 빠지면) 고른 것도 비운다. 그리는 중에 되돌린다(React 권장 방식).
  const [wasEditing, setWasEditing] = useState(editing)
  if (wasEditing !== editing) {
    setWasEditing(editing)
    if (!editing) setSelected(new Map())
  }

  const toggle = useCallback((memoryId: string, picked: Picked) => {
    setSelected((current) => {
      const next = new Map(current)
      if (next.has(memoryId)) next.delete(memoryId)
      else next.set(memoryId, picked)
      return next
    })
  }, [])
  const clear = useCallback(() => setSelected(new Map()), [])

  const value = useMemo<FeedEdit>(
    () => ({ editing, roomId, selected, toggle, clear }),
    [editing, roomId, selected, toggle, clear],
  )
  return <FeedEditContext.Provider value={value}>{children}</FeedEditContext.Provider>
}

function useFeedEdit(): FeedEdit {
  const context = useContext(FeedEditContext)
  if (!context) throw new Error('FeedEditProvider가 필요합니다.')
  return context
}

/**
 * 카드 한 장을 감싼다. 편집 중이 아니면 카드를 그대로 지나보낸다.
 * 편집 중에는 카드 위에 투명한 버튼을 덮어 카드 안의 재생·링크가 눌리지 않게 하고,
 * 누르면 고르거나 뺀다.
 */
export function SelectableCard({
  memoryId,
  authorName,
  selectable,
  isPrivate,
  children,
}: {
  memoryId: string
  authorName: string
  /** 내가 남긴 글인가. 내 글만 고를 수 있다. */
  selectable: boolean
  isPrivate: boolean
  children: ReactNode
}) {
  const { editing, selected, toggle } = useFeedEdit()
  if (!editing) return <>{children}</>

  const isSelected = selected.has(memoryId)

  if (!selectable) {
    return (
      <div className="relative">
        {children}
        {/* 남의 글 — 고를 수 없다는 것을 흐림으로 보이고 누르기를 막는다. */}
        <div aria-hidden className="absolute inset-0 rounded-card bg-canvas/60" />
      </div>
    )
  }

  return (
    <div className="relative">
      {children}
      <button
        type="button"
        aria-pressed={isSelected}
        aria-label={`${authorName}님의 추억${isPrivate ? '(나만 보기)' : ''} 고르기`}
        onClick={() => toggle(memoryId, { isPrivate })}
        className={`absolute inset-0 rounded-card border-2 text-left transition-colors ${
          isSelected ? 'border-primary bg-primary/5' : 'border-transparent'
        }`}
      >
        {/* 카드의 프로필 원 자리를 그대로 덮는다(버튼 테두리 2px만큼 당김) — 편집 중에는 누구 글인지보다 골랐는지가 먼저다. */}
        <span aria-hidden className="absolute top-[14px] left-[14px] flex h-11 w-11 items-center justify-center rounded-full bg-card">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
              isSelected ? 'border-primary bg-primary text-white' : 'border-hairline-strong bg-card'
            }`}
          >
            {isSelected ? <CheckIcon /> : null}
          </span>
        </span>
      </button>
    </div>
  )
}

/** 편집 중 아래 고정 줄 — 고른 개수와 공개로 바꾸기·수정·삭제. */
export function FeedEditBar() {
  const { roomId, selected, clear } = useFeedEdit()
  const [dialog, setDialog] = useState<'none' | 'publish' | 'delete'>('none')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const ids = [...selected.keys()]
  const privateIds = ids.filter((id) => selected.get(id)?.isPrivate)
  const single = ids.length === 1 ? ids[0] : null

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) => {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        setDialog('none')
        clear()
        setNotice(done)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="shrink-0 border-t border-hairline bg-card px-screen-x py-3">
      <div className="mx-auto flex w-full max-w-md flex-col gap-2.5">
        <p role="status" aria-live="polite" className="text-base font-semibold text-ink">
          {ids.length > 0 ? `${ids.length}개 골랐어요` : (notice ?? '고칠 추억을 눌러 골라 주세요')}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={privateIds.length === 0 || pending}
            onClick={() => {
              setError(null)
              setNotice(null)
              setDialog('publish')
            }}
            className="h-12 rounded-button bg-primary px-2 text-[15px] font-semibold text-white disabled:bg-surface-soft disabled:text-muted"
          >
            공개로 바꾸기
          </button>
          {single ? (
            <Link
              href={`/rooms/${roomId}/memories/${single}/edit`}
              className="flex h-12 items-center justify-center rounded-button border border-hairline-strong bg-card px-2 text-[15px] font-semibold text-ink"
            >
              수정
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="한 개만 골랐을 때 고칠 수 있어요"
              className="h-12 rounded-button border border-hairline bg-card px-2 text-[15px] font-semibold text-muted"
            >
              수정
            </button>
          )}
          <button
            type="button"
            disabled={ids.length === 0 || pending}
            onClick={() => {
              setError(null)
              setNotice(null)
              setDialog('delete')
            }}
            className="h-12 rounded-button border border-hairline-strong bg-card px-2 text-[15px] font-semibold text-primary disabled:border-hairline disabled:text-muted"
          >
            삭제
          </button>
        </div>
        {ids.length > 1 ? (
          <p className="text-sm text-muted">수정은 한 개만 골랐을 때 할 수 있어요.</p>
        ) : null}
        {error && dialog === 'none' ? (
          <p role="alert" className="text-sm leading-relaxed text-primary">
            {error}
          </p>
        ) : null}
      </div>

      {dialog === 'publish' ? (
        <ConfirmPublishDialog
          count={privateIds.length}
          pending={pending}
          error={error}
          onCancel={() => setDialog('none')}
          onConfirm={() =>
            run(() => publishMemories(roomId, privateIds), `추억 ${privateIds.length}개를 공개했어요.`)
          }
        />
      ) : null}

      {dialog === 'delete' ? (
        <ConfirmDeleteManyDialog
          count={ids.length}
          pending={pending}
          error={error}
          onCancel={() => setDialog('none')}
          onConfirm={() => run(() => deleteMemories(ids), `추억 ${ids.length}개를 삭제했어요.`)}
        />
      ) : null}
    </div>
  )
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}
