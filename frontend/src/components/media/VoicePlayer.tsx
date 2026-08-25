'use client'

import { useEffect, useRef, useState } from 'react'

import { formatClock, formatDuration } from '@/lib/format'
import { BAR_COUNT, levelsFromUrl } from '@/lib/waveform'

/**
 * 음성 재생바 (캡처 18·20·22).
 *
 * 모양: 둥근 알약 안에 [▶ 빨간 원] + 파형 + 오른쪽 시간.
 * 재생 중에는 지나간 만큼의 파형이 강조색으로 덮이고, 시간은 흘러간 시간을 보여준다.
 *
 * **파형 막대 높이는 실제 소리 크기다.** 높이를 다 같게 그리면 파형처럼 보이지만
 * 소리와 아무 상관이 없다 — 그건 그림이지 정보가 아니다.
 * 높이를 얻는 길은 두 가지고, 둘 다 실제 값이다:
 *   - `levels`를 받으면 그것을 쓴다. 방금 녹음한 소리는 녹음하면서 이미 재어 뒀다.
 *   - 안 받으면 파일을 내려받아 해석한다(피드에 저장된 음성).
 * 아직 값을 모르는 동안에는 파형 대신 납작한 막대 하나를 그린다.
 *
 * **해석은 재생을 누른 뒤에 시작한다.** 화면에 뜨자마자 해석하면 파일을 통째로 내려받게 되고,
 * 피드에 음성 게시물이 30개면 방을 한 번 여는 데 30개를 내려받는다 — `preload="none"`이
 * 무의미해진다. 안 들어볼 음성까지 미리 받아두는 값으로는 너무 비싸다.
 * 그래서 누르기 전에는 납작한 줄이고, 누르는 순간 실제 파형으로 바뀐다.
 *
 * 이 부품은 피드(추억 카드)와 작성 화면(녹음 미리듣기)이 함께 쓴다.
 * 두 곳이 각자 그리면 같은 소리가 화면마다 다르게 보인다.
 */

export interface VoicePlayerProps {
  /** 재생할 주소. 서명된 Storage 주소나 브라우저가 만든 blob 주소. */
  src: string
  /** 저장된 길이(초). 파일 메타데이터가 없어도 시간을 보여줄 수 있게 받아 둔다. */
  durationSec: number
  /** 낭독기에서 "누구의 목소리"인지 구분되도록. */
  label?: string
  /**
   * 이미 재어 둔 막대 높이(0~1). 녹음 화면처럼 소리를 만들면서 잰 값이 있으면 넘긴다.
   * 넘기면 파일을 다시 내려받아 해석하지 않는다.
   */
  levels?: number[] | null
  /**
   * 이 소리를 **처음 재생했을 때** 한 번만 부른다.
   *
   * 사서함이 답장 미션의 "들었다"를 찍는 데 쓴다(PRD [MISSION-01]).
   * 미션을 아는 것은 사서함뿐이라 이 부품에는 그 사정을 넣지 않고,
   * "처음 틀었다"는 사실만 알려준다 — 피드·상세도 같은 부품을 쓰기 때문이다.
   */
  onFirstPlay?: () => void
}

export function VoicePlayer({
  src,
  durationSec,
  label,
  levels: givenLevels = null,
  onFirstPlay,
}: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  /** 처음 한 번만 알리기 위한 표시. 멈췄다 다시 틀어도 다시 부르지 않는다. */
  const firstPlayDone = useRef(false)

  const trackRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  /** 지금 손끝으로 위치를 잡는 중인가. 그동안에는 소리 쪽 시간을 따라가지 않는다. */
  const scrubbingRef = useRef(false)
  /**
   * 아직 파일을 안 받아서 옮겨두지 못한 위치.
   * preload="none" 이라 한 번도 안 튼 소리는 currentTime 을 못 건드린다 —
   * 그 자리를 기억해 뒀다가 파일이 준비되면 그때 옮긴다.
   */
  const pendingSeekRef = useRef<number | null>(null)

  /** 파일을 해석해서 얻은 높이. 어느 주소의 것인지 함께 들고 있어야 섞이지 않는다. */
  const [decoded, setDecoded] = useState<{
    src: string
    levels: number[]
  } | null>(null)

  /*
    주소가 바뀌면(다시 녹음 등) 재생 상태를 처음으로 되돌린다.
    effect가 아니라 그리는 중에 맞춘다 — 리액트가 권하는 "prop이 바뀔 때 상태 맞추기"
    방식이다. effect로 하면 옛 상태가 한 번 그려진 뒤 지워져 화면이 깜빡인다.
  */
  const [renderedSrc, setRenderedSrc] = useState(src)
  if (renderedSrc !== src) {
    setRenderedSrc(src)
    setElapsed(0)
    setPlaying(false)
  }

  /** 어느 주소를 이미 해석하기 시작했는지. 같은 파일을 두 번 내려받지 않는다. */
  const decodeStartedForRef = useRef<string | null>(null)

  const levels =
    givenLevels ?? (decoded?.src === src ? decoded.levels : null)

  const total = durationSec > 0 ? durationSec : 0
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0

  /*
    재생 중에는 매 프레임 시간을 다시 읽는다.

    왜: <audio>의 timeupdate 는 **1초에 네 번쯤만** 온다(브라우저가 정하는 값이라
    우리가 못 바꾼다). 그 값으로 파형을 칠하면 250ms마다 한 칸씩 튀어서
    소리는 이어지는데 그림만 툭툭 끊긴다(사용자 신고 2026-08-26).
    화면을 그리는 박자(rAF)에 맞춰 읽으면 손끝과 눈이 같은 속도로 간다.

    멈춰 있을 때는 돌리지 않는다 — 피드에 음성 카드가 여럿이면 그만큼 헛돈다.
  */
  useEffect(() => {
    if (!playing) return

    const step = () => {
      const audio = audioRef.current
      // 문지르는 동안에는 손끝이 주인이다. 소리 쪽 시간이 끼어들면 위치가 튄다.
      if (audio && !scrubbingRef.current) setElapsed(audio.currentTime)
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing])

  /** 이 자리로 옮긴다. 화면은 즉시 따라가고, 소리는 준비된 만큼 따라간다. */
  function seekTo(sec: number) {
    const clamped = Math.max(0, Math.min(total, sec))
    setElapsed(clamped)

    const audio = audioRef.current
    if (!audio) return

    // 아직 파일이 없으면 지금은 못 옮긴다. 자리만 기억해 둔다.
    if (audio.readyState === 0) {
      pendingSeekRef.current = clamped
      return
    }
    try {
      audio.currentTime = clamped
    } catch {
      pendingSeekRef.current = clamped
    }
  }

  /** 손끝 x좌표 → 그 자리의 시간(초). */
  function timeFromPointer(clientX: number): number {
    const el = trackRef.current
    if (!el || total <= 0) return 0
    const box = el.getBoundingClientRect()
    if (box.width <= 0) return 0
    return ((clientX - box.left) / box.width) * total
  }

  /**
   * 파형 해석을 시작한다. 재생을 누른 순간에만 부른다.
   *
   * 실패해도 아무 일이 없어야 한다 — 파형은 못 그려도 소리는 들려야 한다.
   * `levelsFromUrl`은 스스로 reject하지 않지만, 여기서도 한 번 더 잡는다.
   * 이 자리를 비워두면 예외가 미처리 프라미스 거부로 콘솔까지 새어 나간다.
   */
  function startDecoding() {
    if (givenLevels) return
    if (decodeStartedForRef.current === src) return
    decodeStartedForRef.current = src

    void (async () => {
      try {
        const result = await levelsFromUrl(src)
        if (result) setDecoded({ src, levels: result })
      } catch (decodeError) {
        console.error('[음성] 파형을 만들지 못했습니다:', decodeError)
      }
    })()
  }

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      // 들어보기로 한 음성만 해석한다. 이 시점엔 파일을 어차피 내려받는다.
      startDecoding()
      // play()는 거절될 수 있다(자동재생 정책·파일 못 읽음). 잡지 않으면 콘솔로 샌다.
      audio.play().catch((playError) => {
        console.error('[음성] 재생하지 못했습니다:', playError)
        setPlaying(false)
      })
    } else {
      audio.pause()
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-chip bg-surface-soft px-3 py-2.5">
      {/*
        브라우저 기본 재생기를 쓰지 않는다 — 기기마다 생김새가 전부 달라서
        캡처의 알약 모양을 만들 수 없다. 소리만 이 요소가 맡고 화면은 아래가 그린다.
      */}
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => {
          setPlaying(true)
          if (!firstPlayDone.current) {
            firstPlayDone.current = true
            onFirstPlay?.()
          }
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setElapsed(0)
        }}
        onLoadedMetadata={(event) => {
          // 틀기 전에 문질러 둔 자리가 있으면 이제 옮긴다.
          const wanted = pendingSeekRef.current
          if (wanted === null) return
          pendingSeekRef.current = null
          event.currentTarget.currentTime = wanted
        }}
        /*
          멈춰 있을 때의 보정용으로만 남긴다. 재생 중에는 위의 rAF 루프가 읽는다 —
          이 이벤트만으로는 1초에 네 번이라 그림이 끊긴다.
        */
        onTimeUpdate={(event) => {
          if (playing || scrubbingRef.current) return
          setElapsed(event.currentTarget.currentTime)
        }}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={
          playing
            ? `${label ?? '음성'} 멈추기`
            : `${label ?? '음성'} 듣기, ${formatDuration(total)}`
        }
        className="btn-primary-surface flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/*
        파형 = 재생 위치를 **잡을 수 있는 손잡이**다(애플 음성 메모와 같은 방식).
        장식이 아니라 조작 대상이라 progressbar 가 아니라 slider 다 —
        progressbar 는 "보기만 하는 값"이라는 뜻이라 낭독기가 조작법을 안 알려준다.

        touch-action: pan-y 인 이유: 이 부품은 피드 카드 안에도 들어간다.
        여기서 세로 넘기기를 막으면 파형 위에 손가락이 닿는 순간 피드가 안 넘어간다.
        세로는 브라우저에 넘기고, 가로로 움직인 것만 위치 잡기로 받는다.
      */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="재생 위치"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(elapsed)}
        aria-valuetext={`${formatClock(elapsed)} / ${formatClock(total)}`}
        onPointerDown={(event) => {
          if (total <= 0) return
          event.currentTarget.setPointerCapture(event.pointerId)
          scrubbingRef.current = true
          // 파형을 누르면 그 자리로 바로 간다. 끌지 않고 톡 쳐도 옮겨져야 한다.
          seekTo(timeFromPointer(event.clientX))
        }}
        onPointerMove={(event) => {
          if (!scrubbingRef.current) return
          seekTo(timeFromPointer(event.clientX))
        }}
        onPointerUp={() => {
          scrubbingRef.current = false
        }}
        onPointerCancel={() => {
          scrubbingRef.current = false
        }}
        onKeyDown={(event) => {
          // 굴리거나 끌 수 없는 분(키보드·낭독기)도 같은 일을 할 수 있어야 한다.
          const step =
            event.key === 'ArrowLeft'
              ? -1
              : event.key === 'ArrowRight'
                ? 1
                : 0
          if (step !== 0) {
            event.preventDefault()
            seekTo(elapsed + step)
            return
          }
          if (event.key === 'Home') {
            event.preventDefault()
            seekTo(0)
          } else if (event.key === 'End') {
            event.preventDefault()
            seekTo(total)
          }
        }}
        // -my-3/py-3: 보이는 높이는 그대로 두고 **닿는 자리만** 위아래로 넓힌다.
        // 파형 자체는 32px이라 손끝으로 정확히 짚기 어렵다.
        className="relative -my-3 min-w-0 flex-1 cursor-pointer py-3 touch-pan-y"
      >
        <Bars levels={levels} className="text-ink/60" />
        {/*
          지나간 만큼만 강조색으로 덮는다. 같은 막대를 한 벌 더 그리고
          clip-path로 잘라내면 두 층의 막대 위치가 어긋날 수 없다.
        */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-3 bottom-3"
          style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}
        >
          <Bars levels={levels} className="text-primary" />
        </div>

        {/*
          재생 머리. 칠해진 부분의 끝이 어디인지 막대만으로는 반 칸 단위로만 보인다 —
          가는 선이 있어야 지금 자리가 정확히 읽힌다.
          transform 으로 옮긴다: left 를 매 프레임 바꾸면 레이아웃을 다시 계산한다.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-2 bottom-2 w-[2px] -translate-x-1/2 rounded-full bg-ink"
          style={{ left: `${progress * 100}%` }}
        />
      </div>

      {/* 숫자가 1초마다 바뀌어도 폭이 흔들리지 않도록 tabular-nums. */}
      <span className="shrink-0 tabular-nums text-sm font-medium text-muted">
        {formatClock(playing || elapsed > 0 ? elapsed : total)}
      </span>
    </div>
  )
}

/**
 * 막대 한 벌. 색은 부모가 text-* 로 정한다(currentColor를 쓴다).
 *
 * 높이를 아직 모르면 막대를 그리지 않고 납작한 줄 하나를 놓는다.
 * 높이가 다 같은 막대를 늘어놓으면 "이게 이 소리의 모양"이라는 거짓말이 된다.
 */
function Bars({
  levels,
  className,
}: {
  levels: number[] | null
  className: string
}) {
  if (!levels || levels.length === 0) {
    return (
      <div aria-hidden className={`flex h-8 w-full items-center ${className}`}>
        <span className="h-[3px] w-full rounded-full bg-current opacity-70" />
      </div>
    )
  }

  return (
    <div
      aria-hidden
      className={`flex h-8 w-full items-center gap-[1.5px] ${className}`}
    >
      {levels.slice(0, BAR_COUNT).map((level, index) => (
        <span
          key={index}
          className="min-w-[1.5px] flex-1 rounded-full bg-current"
          style={{ height: `${Math.round(level * 100)}%` }}
        />
      ))}
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="7" y="5.5" width="3.6" height="13" rx="1.2" />
      <rect x="13.4" y="5.5" width="3.6" height="13" rx="1.2" />
    </svg>
  )
}
