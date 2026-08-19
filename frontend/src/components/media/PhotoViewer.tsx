'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 전체화면 사진 뷰어 (노션 IA 6.5).
 *
 * 피드·상세의 사진은 자리에 맞춰 잘려 있다(object-cover). 여기서는 **자르지 않고**
 * 화면에 꽉 차게 보여준다(object-contain) — "원본을 본다"는 말이 그런 뜻이다.
 *
 * 왜 별도 화면(라우트)이 아니라 덮개인가:
 * 사진을 닫으면 보던 자리(스크롤 위치, 읽던 댓글)로 그대로 돌아와야 한다.
 * 라우트를 옮기면 돌아올 때 그 자리를 다시 찾아 세워야 하고, 뒤로가기 이력에도
 * 사진 한 장마다 한 칸씩 쌓인다.
 *
 * 확대는 세 가지 길로 열어둔다 — 손가락 두 개(핀치), 두 번 톡톡(더블탭),
 * 그리고 [크게] 버튼. 주 사용자가 시니어라 **화면에 보이는 버튼이 반드시 하나는 있어야
 * 한다** — 핀치와 더블탭은 화면에 흔적이 없어서, 있는 줄 모르면 영영 못 쓴다.
 *
 * 잔여데이터가 아닌 이유: 확대 배율과 위치는 보는 동안만 쓰는 값이라 어디에도 저장하지
 * 않는다. 닫으면 사라지고, 다시 열면 처음 배율에서 시작한다.
 */

export type ViewerPhoto = {
  url: string
  alt: string
}

/** 두 번 톡톡·[크게] 버튼으로 커지는 배율. 손가락으로는 이보다 더 키울 수 있다. */
const STEP_SCALE = 2.5
/** 핀치로 키울 수 있는 최대 배율. 이보다 크면 사진이 뭉개져 보기만 나쁘다. */
const MAX_SCALE = 4

export function PhotoViewer({
  photos,
  startIndex = 0,
  onClose,
}: {
  photos: ViewerPhoto[]
  startIndex?: number
  onClose: () => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const [index, setIndex] = useState(startIndex)

  /** 지금 보고 있는 사진의 확대 상태. 사진을 넘기면 처음으로 돌아간다. */
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 })
  const zoomed = zoom.scale > 1

  /** 화면 위의 손가락들. pointer 하나로 마우스·손가락을 같이 다룬다. */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  /** 핀치를 시작한 순간의 두 손가락 거리와 그때의 배율. */
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null)
  /** 확대된 사진을 끌어 옮기는 중인지. */
  const panRef = useRef<{ x: number; y: number } | null>(null)

  /**
   * 손가락이 화면에 닿아 있는 동안인가.
   *
   * ref가 아니라 state인 이유: 이 값으로 **화면을 그리기** 때문이다(끄는 동안에는
   * 애니메이션을 끈다). ref는 바뀌어도 다시 그려지지 않아서, 값이 화면에 반영되지 않는다.
   */
  const [touching, setTouching] = useState(false)

  const reset = useCallback(() => setZoom({ scale: 1, x: 0, y: 0 }), [])

  // 열릴 때 시작 사진으로 보낸다. 스크롤 위치는 그려진 뒤에야 정할 수 있다.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    track.scrollLeft = track.clientWidth * startIndex
  }, [startIndex])

  // 열려 있는 동안 뒤 화면이 같이 스크롤되지 않게 잠근다.
  // 안 잠그면 사진을 끌 때 뒤의 피드가 함께 밀려 올라가 버린다.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // Esc로 닫는다. 닫기 버튼까지 찾아가지 않아도 되게.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // 열리자마자 닫기 버튼에 초점을 둔다 — 키보드·낭독기 사용자가 덮개 안에서 시작하도록.
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  /** 사진이 화면 밖으로 달아나지 않게 옮김 범위를 가둔다. */
  function clamp(next: { scale: number; x: number; y: number }) {
    const track = trackRef.current
    if (!track) return next
    const limitX = ((next.scale - 1) * track.clientWidth) / 2
    const limitY = ((next.scale - 1) * track.clientHeight) / 2
    return {
      scale: next.scale,
      x: Math.min(limitX, Math.max(-limitX, next.x)),
      y: Math.min(limitY, Math.max(-limitY, next.y)),
    }
  }

  function toggleZoom() {
    setZoom((current) =>
      current.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: STEP_SCALE, x: 0, y: 0 },
    )
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    setTouching(true)

    const points = [...pointersRef.current.values()]
    if (points.length === 2) {
      pinchRef.current = { distance: distanceOf(points), scale: zoom.scale }
      panRef.current = null
      return
    }
    // 확대된 상태에서만 끌어 옮긴다. 원래 크기일 때 끌면 사진을 넘기는 동작이어야 한다.
    if (points.length === 1 && zoomed) {
      panRef.current = { x: event.clientX - zoom.x, y: event.clientY - zoom.y }
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const points = [...pointersRef.current.values()]

    if (points.length === 2 && pinchRef.current) {
      const start = pinchRef.current
      const ratio = distanceOf(points) / (start.distance || 1)
      const scale = Math.min(MAX_SCALE, Math.max(1, start.scale * ratio))
      setZoom((current) => clamp({ ...current, scale }))
      return
    }

    if (panRef.current) {
      const from = panRef.current
      setZoom((current) =>
        clamp({
          scale: current.scale,
          x: event.clientX - from.x,
          y: event.clientY - from.y,
        }),
      )
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0) {
      panRef.current = null
      setTouching(false)
      // 손가락을 떼면서 원래 크기 밑으로 내려갔으면 가운데로 되돌린다.
      setZoom((current) => (current.scale <= 1 ? { scale: 1, x: 0, y: 0 } : current))
    }
  }

  const many = photos.length > 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사진 크게 보기"
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      {/*
        위 줄 — 몇 번째 사진인지와 닫기.
        검은 배경 위라 이 줄만 흰 글씨를 쓴다(본문 토큰과 다른 유일한 자리).
      */}
      <div className="flex shrink-0 items-center justify-between px-2 pt-[env(safe-area-inset-top)]">
        <span
          aria-hidden
          className="px-3 text-base font-bold tabular-nums text-white/90"
        >
          {many ? `${index + 1} / ${photos.length}` : ''}
        </span>

        <div className="flex items-center">
          {/*
            보이는 확대 버튼. 핀치·더블탭을 모르는 분도 이 버튼 하나로 크게 볼 수 있다.
            무엇이 일어날지 매번 바뀌므로 이름도 함께 바뀐다.
          */}
          <button
            type="button"
            onClick={toggleZoom}
            aria-pressed={zoomed}
            className="flex h-11 min-w-11 items-center justify-center px-3 text-base font-bold text-white"
          >
            {zoomed ? '원래대로' : '크게'}
          </button>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="사진 닫기"
            className="flex h-11 w-11 items-center justify-center text-white"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={toggleZoom}
        onScroll={(event) => {
          const track = event.currentTarget
          if (track.clientWidth === 0) return
          const next = Math.round(track.scrollLeft / track.clientWidth)
          if (next === index) return
          setIndex(Math.min(photos.length - 1, Math.max(0, next)))
          // 다른 사진으로 넘어가면 확대를 푼다. 확대한 채로 넘어가면
          // 다음 사진의 엉뚱한 구석이 화면을 채운다.
          reset()
        }}
        tabIndex={many ? 0 : undefined}
        role={many ? 'group' : undefined}
        aria-label={many ? `사진 ${photos.length}장` : undefined}
        className={[
          'flex min-h-0 flex-1 snap-x snap-mandatory overscroll-contain',
          // 확대 중에는 넘기기를 멈춘다 — 끌기가 "옮기기"여야 하기 때문이다.
          zoomed ? 'overflow-hidden touch-none' : 'overflow-x-auto',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        ].join(' ')}
      >
        {photos.map((photo, position) => (
          <div
            key={photo.url}
            className="flex h-full w-full shrink-0 snap-center snap-always items-center justify-center"
          >
            {/*
              next/image를 쓰지 않는다. 이건 비공개 버킷의 서명된 주소라
              최적화 서버가 손댈 수 없다(피드·상세와 같은 판단).
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.alt}
              draggable={false}
              className="max-h-full max-w-full object-contain select-none"
              style={
                position === index
                  ? {
                      transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
                      // 손가락을 떼기 전까지는 애니메이션 없이 즉시 따라와야 한다 —
                      // 끄는 동안 뒤늦게 따라오면 손과 사진이 어긋나 보인다.
                      transition: touching ? undefined : 'transform 120ms ease-out',
                    }
                  : undefined
              }
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function distanceOf(points: { x: number; y: number }[]): number {
  const [a, b] = points
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function CloseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
