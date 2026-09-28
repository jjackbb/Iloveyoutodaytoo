'use client'

import { useState } from 'react'
import { HandwritingPlayer } from './HandwritingPlayer'
import { MEMORY_PAPERS, MEMORY_PENS, type MemoryHandwritingStyle } from '@/lib/memory-expression'

/** 상세에 들어오면 한 번 그려지고, 오른쪽 위 ▶로 다시 처음부터 볼 수 있다. */
export function HandwritingReplay({ src, label, style }: { src: string; label: string; style: MemoryHandwritingStyle }) {
  const [round, setRound] = useState(0)
  return <div className="relative">
    <HandwritingPlayer key={round} src={src} label={label} autoPlay penWidth={MEMORY_PENS[style.pen].width} penColor={MEMORY_PENS[style.pen].color} paperColor={MEMORY_PAPERS[style.paper].color} />
    <button type="button" aria-label={`${label} 다시 재생`} onClick={() => setRound((current) => current + 1)} className="absolute top-2 right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm">▶</button>
  </div>
}
