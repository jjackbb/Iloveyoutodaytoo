'use client'

import { useRef, useState } from 'react'

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
}

export function VoicePlayer({
  src,
  durationSec,
  label,
  levels: givenLevels = null,
}: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)

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
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setElapsed(0)
        }}
        onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
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
        파형. 장식이 아니라 "얼마나 남았는지"를 알려주는 진행 표시라
        낭독기에는 진행률을 값으로 전한다.
      */}
      <div
        role="progressbar"
        aria-label="재생 위치"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="relative min-w-0 flex-1"
      >
        <Bars levels={levels} className="text-ink/60" />
        {/*
          지나간 만큼만 강조색으로 덮는다. 같은 막대를 한 벌 더 그리고
          clip-path로 잘라내면 두 층의 막대 위치가 어긋날 수 없다.
        */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}
        >
          <Bars levels={levels} className="text-primary" />
        </div>
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
