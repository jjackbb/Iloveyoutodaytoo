'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { VoicePlayer } from '@/components/media/VoicePlayer'
import { formatClock } from '@/lib/format'
// 길이 제한은 @/lib/limits 한 곳에만 둔다. 서버 검증(memories.ts)도 같은 값을 본다.
import { VOICE_MAX_SEC, VOICE_MIN_SEC } from '@/lib/limits'
import { toBarLevels } from '@/lib/waveform'

/**
 * "함께 담을 목소리" 녹음기 (캡처 12·16·18·20).
 *
 * 캡처의 세 모습을 그대로 옮겼다:
 *   눌기 전  — 빨간 마이크 원 + "마이크를 눌러 녹음을 시작하세요"
 *   녹음 중  — 빨간 원(‖) + 0:00 카운트 + "녹음 중… 마이크를 눌러 멈추기"
 *   녹음 후  — 빨간 마이크 원 + 총 길이 + "녹음 완료 · 아래에서 들어볼 수 있어요" + 재생바
 * 카드 아래에는 상태 배지가 붙는다: ✕ 3초 이상 녹음해 주세요(빨강) → ✓ 3초 이상 충족 완료(초록).
 *
 * 규칙:
 * - 3초 미만은 저장할 수 없다. 60초를 넘길 수 없다(DB CHECK와 같은 값).
 * - 마이크를 못 쓰는 상황(권한 거부, 마이크 없음, 옛 브라우저)에서는 이유를 그대로 말해준다.
 *
 * 이 컴포넌트는 파일을 업로드하지 않는다. 녹음 결과(Blob)만 부모에게 넘긴다.
 * 업로드는 compose-form.tsx가 재시도까지 책임진다.
 */

export interface VoiceRecording {
  blob: Blob
  /** 녹음 길이(초, 정수). memories.voice_duration_sec에 그대로 들어간다. */
  durationSec: number
  /** 업로드할 때 쓸 contentType. codecs 부분을 뗀 값이라 Storage 허용 목록과 맞는다. */
  mimeType: string
  /** 파일 이름에 붙일 확장자. 예: 'webm' */
  extension: string
  /**
   * 파형 막대 높이(0~1). 녹음하는 동안 실제로 잰 소리 크기다.
   * 재생 미리듣기가 이 값을 그대로 쓴다 — 방금 만든 파일을 다시 해석할 이유가 없다.
   * 마이크 측정을 못 한 브라우저에서는 비어 있고, 그때는 재생바가 파일을 해석한다.
   */
  levels: number[] | null
}

/**
 * 브라우저마다 만들 수 있는 형식이 다르다.
 * voice 버킷이 허용하는 형식(audio/webm, audio/mp4, audio/ogg, audio/mpeg, audio/wav)만 고른다.
 */
const CANDIDATES: {
  recorderType: string
  mimeType: string
  extension: string
}[] = [
  {
    recorderType: 'audio/webm;codecs=opus',
    mimeType: 'audio/webm',
    extension: 'webm',
  },
  { recorderType: 'audio/webm', mimeType: 'audio/webm', extension: 'webm' },
  // 사파리(아이폰)는 보통 이쪽이다.
  {
    recorderType: 'audio/mp4;codecs=mp4a.40.2',
    mimeType: 'audio/mp4',
    extension: 'm4a',
  },
  { recorderType: 'audio/mp4', mimeType: 'audio/mp4', extension: 'm4a' },
  {
    recorderType: 'audio/ogg;codecs=opus',
    mimeType: 'audio/ogg',
    extension: 'ogg',
  },
  { recorderType: 'audio/ogg', mimeType: 'audio/ogg', extension: 'ogg' },
]

function pickCandidate(): (typeof CANDIDATES)[number] | null {
  if (typeof MediaRecorder === 'undefined') return null
  if (typeof MediaRecorder.isTypeSupported !== 'function') return null

  return (
    CANDIDATES.find((candidate) => {
      try {
        return MediaRecorder.isTypeSupported(candidate.recorderType)
      } catch {
        return false
      }
    }) ?? null
  )
}

/** getUserMedia가 던지는 오류를 사용자가 알아들을 말로 바꾼다. */
function describeMicError(error: unknown): string {
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name: unknown }).name)
      : ''

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return '마이크 사용이 허용되지 않았어요. 주소창 옆 자물쇠 아이콘에서 마이크를 "허용"으로 바꿔주세요.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return '이 기기에서 마이크를 찾지 못했어요.'
    case 'NotReadableError':
    case 'TrackStartError':
      return '다른 앱이 마이크를 쓰고 있는 것 같아요. 그 앱을 닫고 다시 눌러주세요.'
    case 'SecurityError':
      return '보안 설정 때문에 마이크를 쓸 수 없어요.'
    default:
      return '마이크를 켜지 못했어요. 잠시 후 다시 눌러주세요.'
  }
}

type RecorderPhase = 'idle' | 'preparing' | 'recording' | 'recorded'

export interface VoiceRecorderProps {
  /** 지금 녹음해 둔 것. 부모가 들고 있는다(전송 실패 후 재시도 때 다시 녹음시키지 않기 위해). */
  value: VoiceRecording | null
  onChange: (recording: VoiceRecording | null) => void
  /** 전송 중처럼 손대면 안 되는 동안 잠근다. */
  disabled?: boolean
}

export function VoiceRecorder({
  value,
  onChange,
  disabled = false,
}: VoiceRecorderProps) {
  const [phase, setPhase] = useState<RecorderPhase>(value ? 'recorded' : 'idle')

  /*
    부모가 **나중에** 녹음을 얹어주는 경우가 있다 — 추억 고치기 화면이 원래 목소리를
    받아와 넣어줄 때다(노션 IA 3.8). 위 useState는 처음 그려질 때 한 번만 보므로,
    그때는 아직 값이 없어 'idle'로 굳는다. 그러면 담긴 목소리가 있는데도
    "마이크를 눌러 녹음을 시작하세요"가 그대로 남는다.

    녹음하는 도중(preparing·recording)에는 건드리지 않는다 — 그건 이 부품이 주인이다.
  */
  useEffect(() => {
    if (value && phase === 'idle') setPhase('recorded')
  }, [value, phase])
  const [elapsedSec, setElapsedSec] = useState(0)
  const [error, setError] = useState<string | null>(null)
  /**
   * 최대 길이에 닿아 **저절로 멈춘** 경우.
   *
   * 아무 말 없이 멈추면 시니어 사용자에게는 고장으로 보인다 —
   * "내가 뭘 잘못 눌렀나" 하고 처음부터 다시 녹음하게 된다.
   */
  const [stoppedAtMax, setStoppedAtMax] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /*
    소리 크기 재기. MediaRecorder는 파일만 만들 뿐 크기를 알려주지 않으므로
    같은 마이크 소리를 AnalyserNode로 한 번 더 들으며 크기를 모아 둔다.
    이 값이 그대로 재생바의 막대 높이가 된다 — 지어낸 모양을 그리지 않기 위해서다.
  */
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const samplesRef = useRef<number[]>([])
  const frameRef = useRef<number | null>(null)

  /** 크기 재기를 멈추고 오디오 자원을 놓아준다. */
  const stopMetering = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    analyserRef.current = null
    void audioContextRef.current?.close()
    audioContextRef.current = null
  }, [])

  /** 마이크 점유를 반드시 놓아준다. 안 놓으면 브라우저 탭에 녹음 표시가 계속 남는다. */
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  /**
   * 마이크 소리의 크기를 화면 갱신마다 한 번씩 잰다.
   *
   * getByteTimeDomainData는 파형 그 자체(0~255, 가운데가 128)를 준다.
   * 여기서 128로부터 얼마나 떨어져 있는지를 제곱평균(RMS)으로 접으면
   * 그 순간 소리가 얼마나 큰지가 된다.
   */
  const startMetering = useCallback(
    (stream: MediaStream) => {
      const AudioContextClass =
        window.AudioContext ??
        (window as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!AudioContextClass) return

      let context: AudioContext
      try {
        context = new AudioContextClass()
        const source = context.createMediaStreamSource(stream)
        const analyser = context.createAnalyser()
        analyser.fftSize = 2048
        source.connect(analyser)
        audioContextRef.current = context
        analyserRef.current = analyser
      } catch {
        // 크기를 못 재도 녹음 자체는 된다. 그때는 재생바가 파일을 해석한다.
        return
      }

      const buffer = new Uint8Array(analyserRef.current.fftSize)

      const measure = () => {
        const analyser = analyserRef.current
        if (!analyser) return

        analyser.getByteTimeDomainData(buffer)
        let sum = 0
        for (let i = 0; i < buffer.length; i += 1) {
          const centered = (buffer[i] - 128) / 128
          sum += centered * centered
        }
        samplesRef.current.push(Math.sqrt(sum / buffer.length))

        frameRef.current = requestAnimationFrame(measure)
      }

      frameRef.current = requestAnimationFrame(measure)
    },
    [],
  )

  const clearTick = useCallback(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  // 화면을 떠날 때 뒷정리.
  useEffect(() => {
    return () => {
      clearTick()
      stopMetering()
      try {
        recorderRef.current?.stop()
      } catch {
        // 이미 멈춰 있으면 그냥 넘어간다.
      }
      releaseStream()
    }
  }, [clearTick, releaseStream, stopMetering])

  const stopRecording = useCallback(() => {
    clearTick()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
  }, [clearTick])

  const startRecording = useCallback(async () => {
    setError(null)
    setStoppedAtMax(false)

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setError('이 브라우저에서는 녹음을 쓸 수 없어요.')
      return
    }

    const candidate = pickCandidate()
    if (!candidate) {
      setError('이 브라우저에서는 녹음을 쓸 수 없어요.')
      return
    }

    setPhase('preparing')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (micError) {
      setError(describeMicError(micError))
      setPhase('idle')
      return
    }

    streamRef.current = stream
    chunksRef.current = []

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, { mimeType: candidate.recorderType })
    } catch {
      releaseStream()
      setError('녹음을 시작하지 못했어요. 잠시 후 다시 눌러주세요.')
      setPhase('idle')
      return
    }

    recorderRef.current = recorder

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
    }

    recorder.onerror = () => {
      clearTick()
      stopMetering()
      releaseStream()
      setError('녹음 중 문제가 생겼어요. 다시 한 번 눌러주세요.')
      setPhase('idle')
    }

    recorder.onstop = () => {
      clearTick()
      stopMetering()
      releaseStream()

      // MediaRecorder가 만든 파일은 길이 정보가 없는 경우가 많다.
      // 그래서 시작~정지 사이 실제 경과 시간을 길이로 삼는다.
      const elapsed = (performance.now() - startedAtRef.current) / 1000
      const blob = new Blob(chunksRef.current, { type: candidate.mimeType })
      chunksRef.current = []

      // 녹음하는 동안 잰 소리 크기를 막대 높이로 접는다.
      const measured = samplesRef.current
      samplesRef.current = []
      const levels = measured.length > 0 ? toBarLevels(measured) : null

      if (elapsed < VOICE_MIN_SEC) {
        // 배지가 이미 "3초 이상 녹음해 주세요"라고 말하고 있다.
        // 같은 말을 빨간 글씨로 한 번 더 하지 않고, 처음 상태로 돌려 다시 누르게 한다.
        onChange(null)
        setPhase('idle')
        setElapsedSec(0)
        return
      }

      onChange({
        blob,
        durationSec: Math.min(VOICE_MAX_SEC, Math.round(elapsed)),
        mimeType: candidate.mimeType,
        extension: candidate.extension,
        levels,
      })
      setPhase('recorded')
    }

    onChange(null)
    startedAtRef.current = performance.now()
    setElapsedSec(0)
    samplesRef.current = []
    startMetering(stream)
    recorder.start()
    setPhase('recording')

    tickRef.current = setInterval(() => {
      const elapsed = (performance.now() - startedAtRef.current) / 1000
      setElapsedSec(elapsed)
      // 최대 길이에 닿으면 알아서 멈춘다. 넘겨서 저장 못 하는 일이 없게.
      if (elapsed >= VOICE_MAX_SEC) {
        setStoppedAtMax(true)
        stopRecording()
      }
    }, 200)
  }, [
    clearTick,
    onChange,
    releaseStream,
    startMetering,
    stopMetering,
    stopRecording,
  ])

  const recording = phase === 'recording'
  const done = phase === 'recorded' && value !== null

  // 배지는 "지금 표현할 수 있는 상태인가"를 말한다(캡처 12 빨강 → 캡처 18 초록).
  const satisfied = done

  function handleMicClick() {
    if (recording) {
      stopRecording()
      return
    }
    void startRecording()
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* 카드 (캡처 12·16·18) — 흰 면, 가운데 마이크 원. */}
      <div className="flex w-full flex-col items-center gap-3 rounded-card bg-card px-5 py-7 shadow-card">
        {/*
          빨간 원 하나가 시작·정지·다시녹음을 모두 맡는다(캡처 그대로).
          누를 때마다 하는 일이 달라지므로 aria-label을 상태에 맞춰 바꾼다.
          바깥의 옅은 테두리(ring)는 캡처의 은은한 번짐을 대신한다.
        */}
        <button
          type="button"
          onClick={handleMicClick}
          disabled={disabled || phase === 'preparing'}
          aria-label={
            recording
              ? '녹음 멈추기'
              : done
                ? '다시 녹음하기'
                : '녹음 시작하기'
          }
          className="flex h-[68px] w-[68px] items-center justify-center rounded-full btn-primary-surface text-white ring-8 ring-primary-soft transition-transform active:scale-95 disabled:opacity-60"
        >
          {recording ? <StopIcon /> : <MicIcon />}
        </button>

        {/* 시간 — 녹음 중에는 흘러가는 시간, 녹음 후에는 총 길이. */}
        {recording || done ? (
          <p className="tabular-nums text-3xl font-extrabold text-ink">
            {formatClock(recording ? elapsedSec : (value?.durationSec ?? 0))}
          </p>
        ) : null}

        <p className="text-center text-base break-keep text-muted">
          {phase === 'preparing'
            ? '마이크를 켜는 중이에요…'
            : recording
              ? '녹음 중… 마이크를 눌러 멈추기'
              : done
                ? '녹음 완료 · 아래에서 들어볼 수 있어요'
                : '마이크를 눌러 녹음을 시작하세요'}
        </p>

        {/* 다 녹음하면 카드 안에서 바로 들어볼 수 있다 (캡처 18). */}
        {done ? (
          <div className="w-full">
            <RecordingPreview recording={value} />
          </div>
        ) : null}
      </div>

      {/*
        상태 배지 (캡처 12 빨강 / 캡처 18 초록).
        초록은 토큰에 없는 색이라 우리 팔레트로 표현한다 — 아래 주석 참고.
        모양(✕/✓)이 함께 바뀌므로 색을 구분하기 어려운 분도 알아볼 수 있다(WCAG 1.4.1).
      */}
      <p
        role="status"
        className={[
          'inline-flex items-center gap-1.5 rounded-chip px-3.5 py-2 text-sm font-extrabold',
          satisfied
            ? 'bg-surface-soft text-muted'
            : 'bg-primary-soft text-primary',
        ].join(' ')}
      >
        <span aria-hidden>{satisfied ? '✓' : '✕'}</span>
        {satisfied
          ? `${VOICE_MIN_SEC}초 이상 충족 완료`
          : `${VOICE_MIN_SEC}초 이상 녹음해 주세요`}
      </p>

      {stoppedAtMax ? (
        <p role="status" className="text-base leading-relaxed break-keep text-muted">
          한 번에 {VOICE_MAX_SEC}초까지 담을 수 있어요. 여기까지 녹음했어요.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-base leading-relaxed text-primary">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * 방금 녹음한 것 들어보기 (캡처 18).
 *
 * 왜 따로 뺐나: 녹음 파일을 들려주려면 blob 주소를 만들어야 하고, 그 주소는 다 쓰면
 * 반드시 되돌려줘야 한다(안 하면 파일이 메모리에 계속 남는다).
 * 만들기는 마운트할 때 한 번, 되돌리기는 사라질 때 한 번 — 부품 하나의 삶과 정확히 겹친다.
 * 부모 안에 두면 "녹음이 바뀌었나"를 매번 견줘야 하고 거기서 죽은 주소가 생긴다
 * (커버 자르기에서 실제로 겪었다 — _workspace/01_home_port.md §6-5).
 *
 * 이 부품은 녹음이 있을 때만 그려지고, 다시 녹음하면 부모가 먼저 값을 비우므로
 * 사라졌다가 새 blob으로 다시 생긴다.
 */
function RecordingPreview({ recording }: { recording: VoiceRecording }) {
  // 초기값 함수는 마운트할 때 딱 한 번만 돈다.
  const [url] = useState(() => URL.createObjectURL(recording.blob))

  useEffect(() => () => URL.revokeObjectURL(url), [url])

  return (
    <VoicePlayer
      src={url}
      durationSec={recording.durationSec}
      label="방금 녹음한 목소리"
      // 녹음하면서 이미 잰 값이다. 방금 만든 파일을 다시 해석할 이유가 없다.
      levels={recording.levels}
    />
  )
}

function MicIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="2.6" width="6" height="11.4" rx="3" fill="currentColor" stroke="none" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3.2" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6.5" y="5" width="4" height="14" rx="1.4" />
      <rect x="13.5" y="5" width="4" height="14" rx="1.4" />
    </svg>
  )
}
