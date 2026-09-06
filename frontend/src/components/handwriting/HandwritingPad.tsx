'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import {
  HANDWRITING_H,
  HANDWRITING_MAX_DURATION_MS,
  HANDWRITING_MAX_POINTS,
  HANDWRITING_PEN_WIDTH,
  HANDWRITING_W,
  countPoints,
  type HandwritingDoc,
  type HandwritingPoint,
  type HandwritingStroke,
} from '@/lib/handwriting'

/**
 * 손글씨 쓰는 판 (WRITE-01). 앨범방 작성 화면에만 붙는다(사용자 결정).
 *
 * ⚠️ 겉모습은 임시다. 브랜드(로고·색)가 미정이라 기존 토큰만 썼고, 디자인 관문은
 * 로고가 나온 뒤에 밟는다. 여기서 정한 것은 **동작**이다 —
 *  - 검정 한 색, 굵기 고정. 고를 게 없어 바로 쓰기 시작한다(Q6 "부담 없이 첫 마음").
 *  - 지우개 대신 [한 획 되돌리기] · [다 지우기]. 지우개는 획 좌표 모형과 맞지 않는다.
 *  - 배경(편지지) 고르기는 1차 제외.
 *
 * 좌표는 화면 크기와 무관하게 800×600 논리 좌표로 기록한다. 그래야 다른 폰에서 열어도
 * 같은 모양이고, 재생(타임랩스)도 같은 자리를 지나간다.
 *
 * 시각도 함께 기록한다 — 획 시작 시각(t)과 점마다의 경과(dt). 이것이 곧 타임랩스다.
 */
export function HandwritingPad({
  value,
  onChange,
  disabled = false,
}: {
  value: HandwritingDoc | null
  onChange: (next: HandwritingDoc | null) => void
  disabled?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  /** 지금까지 끝난 획들. value 가 바깥에서 바뀌면(고치기로 들어옴) 여기도 맞춘다. */
  const strokesRef = useRef<HandwritingStroke[]>(value?.strokes ?? [])
  /** 첫 획을 시작한 순간(performance.now). 모든 t 의 기준. */
  const originRef = useRef<number | null>(null)
  /** 지금 그리는 중인 획. 손을 떼면 strokesRef 로 옮긴다. */
  const liveRef = useRef<{ startedAt: number; points: HandwritingPoint[] } | null>(null)
  const pointerIdRef = useRef<number | null>(null)

  const [strokeCount, setStrokeCount] = useState(value?.strokes.length ?? 0)
  const [full, setFull] = useState(false)

  /** 캔버스 픽셀 ↔ 논리 좌표 비율. 화면 폭에 맞춰 바뀐다. */
  const scaleRef = useRef(1)

  const penColor = useCallback(() => {
    if (typeof window === 'undefined') return '#222222'
    const ink = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-ink')
      .trim()
    return ink || '#222222'
  }, [])

  /** 끝난 획 전부를 처음부터 다시 그린다(되돌리기·지우기·크기 변경 뒤). */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(scaleRef.current * dpr, 0, 0, scaleRef.current * dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = HANDWRITING_PEN_WIDTH
    ctx.strokeStyle = penColor()

    for (const stroke of strokesRef.current) {
      drawStroke(ctx, stroke.p)
    }
  }, [penColor])

  /*
    폭에 맞춰 캔버스를 잡는다. CSS 크기는 4:3 으로 부모가 정하고, 실제 픽셀은 DPR 만큼
    곱해 흐리지 않게 한다. 논리 좌표(800×600)와의 비율을 scaleRef 에 둔다.
  */
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    const fit = () => {
      const width = wrap.clientWidth
      if (width === 0) return
      const height = (width * HANDWRITING_H) / HANDWRITING_W
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      scaleRef.current = width / HANDWRITING_W
      redraw()
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [redraw])

  // 바깥에서 값이 통째로 바뀌면(고치기 화면이 원래 손글씨를 불러옴) 따라간다.
  useEffect(() => {
    strokesRef.current = value?.strokes ?? []
    setStrokeCount(strokesRef.current.length)
    setFull(false)
    redraw()
  }, [value, redraw])

  /** 지금까지의 획으로 문서를 만들어 바깥에 알린다. 획이 없으면 null. */
  const emit = useCallback(() => {
    const strokes = strokesRef.current
    if (strokes.length === 0) {
      onChange(null)
      return
    }
    const last = strokes[strokes.length - 1]
    const lastPoint = last.p[last.p.length - 1]
    const durationMs = Math.min(
      HANDWRITING_MAX_DURATION_MS,
      Math.round(last.t + (lastPoint?.[2] ?? 0)),
    )
    onChange({
      v: 1,
      w: HANDWRITING_W,
      h: HANDWRITING_H,
      strokes: strokes.map((s) => ({ t: s.t, p: s.p })),
      durationMs,
    })
  }, [onChange])

  const toLogical = (event: ReactPointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * HANDWRITING_W
    const y = ((event.clientY - rect.top) / rect.height) * HANDWRITING_H
    // 판 밖으로 살짝 나가도 가장자리에서 멈춘다. 검증(isHandwritingDoc)이 범위를 본다.
    return [
      Math.round(Math.min(HANDWRITING_W, Math.max(0, x)) * 10) / 10,
      Math.round(Math.min(HANDWRITING_H, Math.max(0, y)) * 10) / 10,
    ]
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled || full) return
    // 두 손가락 중 하나만 받는다. 둘 다 받으면 획이 서로 튄다.
    if (pointerIdRef.current !== null) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerIdRef.current = event.pointerId

    const now = performance.now()
    if (originRef.current === null) originRef.current = now
    const [x, y] = toLogical(event)
    liveRef.current = { startedAt: now, points: [[x, y, 0]] }

    const ctx = event.currentTarget.getContext('2d')
    if (ctx) {
      ctx.strokeStyle = penColor()
      ctx.lineWidth = HANDWRITING_PEN_WIDTH
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      // 톡 찍은 점도 보이게 아주 짧은 선을 긋는다(round cap 이 점이 된다).
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 0.01, y)
      ctx.stroke()
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const live = liveRef.current
    if (!live || event.pointerId !== pointerIdRef.current) return
    event.preventDefault()

    const [x, y] = toLogical(event)
    const prev = live.points[live.points.length - 1]
    // 같은 자리에서 떨리는 점은 버린다 — 파일만 커지고 그림은 그대로다.
    if (prev && Math.abs(prev[0] - x) < 0.5 && Math.abs(prev[1] - y) < 0.5) return

    const dt = Math.round(performance.now() - live.startedAt)
    live.points.push([x, y, dt])

    const ctx = event.currentTarget.getContext('2d')
    if (ctx && prev) {
      ctx.beginPath()
      ctx.moveTo(prev[0], prev[1])
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const live = liveRef.current
    if (!live || event.pointerId !== pointerIdRef.current) return
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // 이미 풀렸으면 그만.
    }
    pointerIdRef.current = null
    liveRef.current = null

    const origin = originRef.current ?? live.startedAt
    const stroke: HandwritingStroke = {
      t: Math.round(live.startedAt - origin),
      p: live.points,
    }

    const total = countPoints({ v: 1, w: HANDWRITING_W, h: HANDWRITING_H, strokes: strokesRef.current, durationMs: 0 })
    if (total + stroke.p.length > HANDWRITING_MAX_POINTS || stroke.t > HANDWRITING_MAX_DURATION_MS) {
      // 상한을 넘는 획은 버리고 판을 잠근다. 조용히 잘라 저장하면 쓴 것과 다른 것이 남는다.
      setFull(true)
      redraw()
      return
    }

    strokesRef.current = [...strokesRef.current, stroke]
    setStrokeCount(strokesRef.current.length)
    emit()
  }

  const undo = () => {
    if (disabled || strokesRef.current.length === 0) return
    strokesRef.current = strokesRef.current.slice(0, -1)
    if (strokesRef.current.length === 0) originRef.current = null
    setStrokeCount(strokesRef.current.length)
    setFull(false)
    redraw()
    emit()
  }

  const clear = () => {
    if (disabled || strokesRef.current.length === 0) return
    strokesRef.current = []
    originRef.current = null
    setStrokeCount(0)
    setFull(false)
    redraw()
    emit()
  }

  return (
    <div className="flex flex-col gap-2">
      {/*
        4:3 판. touch-action: none 이 없으면 손가락이 움직일 때 페이지가 같이 스크롤된다.
        aspect-[4/3] 은 폭만 정하면 높이가 따라오게 한다 — 캔버스 픽셀은 위 fit() 이 맞춘다.
      */}
      <div
        ref={wrapRef}
        className={[
          'relative w-full overflow-hidden rounded-inner border border-hairline bg-card',
          disabled ? 'opacity-60' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="손글씨 쓰는 판"
          className="block w-full touch-none"
          style={{ aspectRatio: `${HANDWRITING_W} / ${HANDWRITING_H}` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onPointerLeave={finishStroke}
        />
        {strokeCount === 0 && !disabled ? (
          <p
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-base text-muted"
          >
            손으로 적어보세요
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted" role="status">
          {full
            ? '여기까지만 담을 수 있어요'
            : strokeCount > 0
              ? `${strokeCount}획`
              : '검정 펜 하나예요. 바로 쓰면 돼요'}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={disabled || strokeCount === 0}
            className="min-h-[44px] rounded-chip px-3 text-base font-medium text-primary disabled:text-muted"
          >
            한 획 되돌리기
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={disabled || strokeCount === 0}
            className="min-h-[44px] rounded-chip px-3 text-base font-medium text-primary disabled:text-muted"
          >
            다 지우기
          </button>
        </div>
      </div>
    </div>
  )
}

function drawStroke(ctx: CanvasRenderingContext2D, points: HandwritingPoint[]) {
  const [first] = points
  if (!first) return
  ctx.beginPath()
  ctx.moveTo(first[0], first[1])
  if (points.length === 1) {
    ctx.lineTo(first[0] + 0.01, first[1])
  } else {
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i][0], points[i][1])
    }
  }
  ctx.stroke()
}
