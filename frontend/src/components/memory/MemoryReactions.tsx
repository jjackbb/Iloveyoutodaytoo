'use client'

import { useState, useTransition } from 'react'
import { toggleMemoryLike, toggleMemoryReaction } from '@/lib/actions/memories'
import { MEMORY_REACTIONS, type MemoryReaction } from '@/lib/memory-expression'
import { Toast } from '@/components/ui/Toast'
import './memory-reactions.css'

type ReactionState = Record<MemoryReaction, { count: number; selected: boolean }>

/** 누군가 누른 표현만 보이고, 맨 왼쪽 [+]에서 숨은 표현을 고른다. */
export function MemoryReactions({ memoryId, authorName, likeCount, liked, reactions }: {
  memoryId: string
  authorName: string
  likeCount: number
  liked: boolean
  reactions: ReactionState
}) {
  const [picking, setPicking] = useState(false)
  const [pending, startTransition] = useTransition()
  const [failure, setFailure] = useState<{ text: string; key: number } | null>(null)
  const items: { kind: 'heart' | MemoryReaction; label: string; count: number; selected: boolean }[] = [
    { kind: 'heart', label: '하트 온기', count: likeCount, selected: liked },
    ...Object.entries(MEMORY_REACTIONS).map(([kind, label]) => ({ kind: kind as MemoryReaction, label, ...reactions[kind as MemoryReaction] })),
  ]
  const shown = picking ? items : items.filter((item) => item.count > 0)

  function toggle(kind: 'heart' | MemoryReaction) {
    startTransition(async () => {
      const result = kind === 'heart' ? await toggleMemoryLike(memoryId) : await toggleMemoryReaction(memoryId, kind)
      if (!result.ok) setFailure((current) => ({ text: result.error, key: (current?.key ?? 0) + 1 }))
      else setPicking(false)
    })
  }

  return <>
    <div className="memory-reactions" role="group" aria-label={`${authorName}님의 마음 표현`}>
      <span className="memory-reactions-add"><button type="button" disabled={pending} aria-expanded={picking} aria-label={picking ? '마음 표현 고르기 닫기' : '마음 표현 더하기'} onClick={() => setPicking((open) => !open)}>{picking ? '×' : '+'}{shown.length === 0 ? <span>마음 표현하기</span> : null}</button></span>
      <div className="memory-reactions-scroll">{shown.map((item) => <button key={item.kind} type="button" disabled={pending} aria-pressed={item.selected} aria-label={`${item.label} ${item.count}개`} className={item.selected ? 'selected' : ''} onClick={() => toggle(item.kind)}><ReactionIcon kind={item.kind} /><span>{item.label}</span><span className="tabular-nums">{item.count}</span></button>)}</div>
    </div>
    {failure ? <Toast key={failure.key} message={failure.text} /> : null}
  </>
}

function ReactionIcon({ kind }: { kind: 'heart' | MemoryReaction }) {
  const paths = {
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />,
    thanks: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></>,
    cheer: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>,
    miss: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />,
  }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[kind]}</svg>
}
