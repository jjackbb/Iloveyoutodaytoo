'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { HandwritingView } from './HandwritingView'
import {
  HANDWRITING_H,
  HANDWRITING_PEN_WIDTH,
  HANDWRITING_W,
  isHandwritingDoc,
  playbackTimeline,
  type HandwritingDoc,
} from '@/lib/handwriting'

/**
 * 손글씨 재생기 — 타임랩스(WRITE-02) 와 다 쓴 그림을 한 부품에서.
 *
 * "손글씨만 있고 재생이 없으면 그냥 그림이고, 핵심 축 ③현장감은 빈 채로 남는다"(PRD).
 * 그래서 열람할 때 **쓰는 과정이 빠르게 지나간 뒤** 결과물이 남는다. 최대 4초(사용자 결정).
 *
 * 파일은 화면에 들어올 때 받는다(IntersectionObserver). 피드는 카드가 30장이라
 * 처음부터 다 받으면 보지도 않을 손글씨 30개를 내려받는다.
 *
 * 그리는 동안은 canvas(프레임마다 React 를 안 깨운다), 끝나면 SVG(HandwritingView)로
 * 바꿔 끼운다 — SVG 가 확대해도 선명하고 낭독기에 label 을 준다.
 * 다 그려진 뒤 누르면 다시 재생한다.
 */
export function HandwritingPlayer({
  src,
  label,
  autoPlay = false,
  className,
}: {
  /** 서명된 handwriting 버킷 주소 */
  src: string
  /** 낭독기용. "○○님의 손글씨" */
  label: string
  /** 화면에 들어오면 바로 재생할지. 상세는 true, 피드는 false(눌러서 본다). */
  autoPlay?: boolean
  className?: string
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)

  const [doc, setDoc] = useState<HandwritingDoc | null>(null)
  const [failed, setFailed] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle')
  // 화면에 들어왔는가. IntersectionObserver 가 없는 환경이면 처음부터 받는다.
  const [wanted, setWanted] = useState(
    () => typeof window !== 'undefined' && typeof IntersectionObserver === 'undefined',
  )

  // 화면에 들어오면 그때 받는다.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setWanted(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!wanted || doc || failed) return
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(src)
        if (!response.ok) throw new Error(`handwriting-fetch-${response.status}`)
        const json: unknown = await response.json()
        if (cancelled) return
        if (!isHandwritingDoc(json)) throw new Error('handwriting-shape')
        setDoc(json)
        // 피드는 다 쓴 그림부터 보여준다. 상세(autoPlay)는 아래 효과가 재생을 건다.
        if (!autoPlay) setPhase('done')
      } catch (cause) {
        console.error('[손글씨] 불러오기 실패:', cause)
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [wanted, doc, failed, src, autoPlay])

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  /** 타임랩스 한 번. canvas 에 시간표대로 점을 이어 그린다. */
  const play = useCallback(() => {
    if (!doc) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    stop()
    setPhase('playing')

    const { points, totalMs } = playbackTimeline(doc)
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth || HANDWRITING_W
    const height = (width * HANDWRITING_H) / HANDWRITING_W
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    const scale = (width / HANDWRITING_W) * dpr

    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.clearRect(0, 0, HANDWRITING_W, HANDWRITING_H)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = HANDWRITING_PEN_WIDTH
    ctx.strokeStyle =
      getComputedStyle(canvas).color || '#222222'

    let index = 0
    let prev: { x: number; y: number; strokeIndex: number } | null = null
    const startedAt = performance.now()

    const frame = (now: number) => {
      const elapsed = now - startedAt
      while (index < points.length && points[index].at <= elapsed) {
        const point = points[index]
        ctx.beginPath()
        if (point.first || !prev || prev.strokeIndex !== point.strokeIndex) {
          // 새 획: 톡 찍은 점도 보이게 아주 짧은 선.
          ctx.moveTo(point.x, point.y)
          ctx.lineTo(point.x + 0.01, point.y)
        } else {
          ctx.moveTo(prev.x, prev.y)
          ctx.lineTo(point.x, point.y)
        }
        ctx.stroke()
        prev = { x: point.x, y: point.y, strokeIndex: point.strokeIndex }
        index += 1
      }
      if (index < points.length || elapsed < totalMs) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        rafRef.current = null
        setPhase('done')
      }
    }
    rafRef.current = requestAnimationFrame(frame)
  }, [doc, stop])

  // 받자마자 자동 재생(상세). 다음 프레임에 걸어 캔버스가 자리를 잡은 뒤 그린다.
  useEffect(() => {
    if (!doc || !autoPlay) return
    const id = requestAnimationFrame(() => play())
    return () => {
      cancelAnimationFrame(id)
      stop()
    }
  }, [doc, autoPlay, play, stop])

  const boxClass = [
    'relative w-full overflow-hidden rounded-inner border border-hairline bg-card text-ink',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  if (failed) {
    return (
      <p className="text-sm text-muted">손글씨를 불러오지 못했어요. 잠시 후 다시 열어주세요.</p>
    )
  }

  return (
    <div
      ref={wrapRef}
      className={boxClass}
      style={{ aspectRatio: `${HANDWRITING_W} / ${HANDWRITING_H}` }}
    >
      {doc ? (
        <button
          type="button"
          onClick={play}
          disabled={phase === 'playing'}
          aria-label={phase === 'done' ? `${label} 다시 재생` : label}
          className="absolute inset-0 block h-full w-full"
        >
          {/* 그리는 동안은 canvas, 끝나면 SVG. 둘을 겹쳐 두고 보이는 쪽만 바꾼다. */}
          <canvas
            ref={canvasRef}
            aria-hidden
            className={[
              'absolute inset-0 h-full w-full',
              phase === 'done' ? 'invisible' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
          <HandwritingView
            doc={doc}
            label={label}
            className={[
              'absolute inset-0 h-full w-full',
              phase === 'done' ? '' : 'invisible',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        </button>
      ) : (
        <p
          role="status"
          className="absolute inset-0 flex items-center justify-center text-sm text-muted"
        >
          {wanted ? '손글씨를 불러오는 중…' : ''}
        </p>
      )}
    </div>
  )
}
