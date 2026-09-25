'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { VIDEO_MAX_MS, VIDEO_MIME_TYPES } from '@/lib/limits'
import {
  checkVideoDuration,
  checkVideoFile,
  describeCameraError,
  formatVideoDuration,
  normalizeVideoMime,
  type VideoMime,
} from '@/lib/video'

/**
 * 추억 영상 담기 (2026-09-26 사용자 결정 — 추억의 네 번째 수단).
 *
 * 두 길을 모두 연다: **파일에서 고르기**와 **바로 찍기**(앱 안 촬영).
 * 한 추억에 한 개뿐이라 담긴 뒤에는 미리보기와 [빼기]만 남는다.
 *
 * 올리기 전에 여기서 거르는 것: 형식(mp4·webm·mov), 빈 파일, 50MB 초과, 30초 초과,
 * 길이를 읽을 수 없는 파일. 걸리면 이유를 말하고 담지 않는다 — 다시 고르거나 찍게 한다.
 * 서버(createMemory)와 DB(memories_video_pair·버킷 상한)가 같은 규칙을 한 번 더 본다.
 *
 * 올리기·재시도·실패 뒤 정리는 작성 화면(compose-form)이 한다. 이 부품은 파일만 쥐고 있다.
 *
 * 겉모습은 기존 목소리·손글씨 칸과 같은 부품(Button·rounded-inner)으로만 짰다.
 * 영상 칸의 시각 설계는 디자인 관문을 거쳐 다시 정한다(인수인계 참고).
 */

export type PickedVideo = {
  /** 새로 고르거나 찍은 파일. 고치기로 들어온 원래 영상은 null. */
  blob: Blob | null
  /** 미리보기 주소. 새 파일이면 blob: 주소, 원래 영상이면 서명 URL. */
  previewUrl: string
  durationMs: number
  mime: VideoMime | null
  /** 이미 Storage에 있는 원래 영상의 경로(고치기). */
  path?: string
}

type PickerPhase = 'idle' | 'checking' | 'preparing' | 'live' | 'recording'

/** 브라우저가 녹화할 수 있는 형식 중 버킷이 받는 것을 고른다. 없으면 null. */
function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  return (
    candidates.find((type) => {
      try {
        return MediaRecorder.isTypeSupported(type)
      } catch {
        return false
      }
    }) ?? null
  )
}

/**
 * 파일에서 길이(초)를 읽는다. 못 읽으면 null.
 * MediaRecorder가 만든 webm은 길이를 Infinity로 알리는 일이 흔해 끝으로 한 번 밀어 본다.
 */
function readDurationSec(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const video = document.createElement('video')
    let settled = false
    const done = (value: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const timer = setTimeout(() => done(null), 10_000)

    video.preload = 'metadata'
    video.muted = true
    video.onerror = () => done(null)
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration)) {
        done(video.duration)
        return
      }
      video.ontimeupdate = () => {
        video.ontimeupdate = null
        done(Number.isFinite(video.duration) ? video.duration : null)
      }
      video.currentTime = Number.MAX_SAFE_INTEGER
    }
    video.src = url
  })
}

export function VideoPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: PickedVideo | null
  onChange: (next: PickedVideo | null) => void
  disabled?: boolean
}) {
  const [phase, setPhase] = useState<PickerPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const liveRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const releaseCamera = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    tickRef.current = null
    stopTimerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (liveRef.current) liveRef.current.srcObject = null
  }, [])

  // 화면을 떠나면 카메라를 끈다. 켜 둔 채 나가면 기기 불이 계속 켜져 있다.
  useEffect(() => () => {
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.stop()
    }
    releaseCamera()
  }, [releaseCamera])

  // 새 파일의 미리보기 주소는 바뀌거나 빠질 때 돌려준다(메모리).
  useEffect(() => {
    const url = value?.blob ? value.previewUrl : null
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [value])

  /** 파일·녹화 결과를 검사하고 통과하면 담는다. */
  const accept = useCallback(
    async (blob: Blob, name: string, fallbackSec: number | null) => {
      setPhase('checking')
      const fileCheck = checkVideoFile({ size: blob.size, type: blob.type, name })
      if (!fileCheck.ok) {
        setError(fileCheck.message)
        setPhase('idle')
        return
      }

      const measured = await readDurationSec(blob)
      const durationCheck = checkVideoDuration(measured ?? fallbackSec)
      if (!durationCheck.ok) {
        setError(durationCheck.message)
        setPhase('idle')
        return
      }

      setError(null)
      setPhase('idle')
      onChange({
        blob,
        previewUrl: URL.createObjectURL(blob),
        durationMs: durationCheck.durationMs,
        mime: fileCheck.mime,
      })
    },
    [onChange],
  )

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // 같은 파일을 다시 골라도 change가 일어나야 하므로 비운다.
    event.target.value = ''
    if (!file) return
    await accept(file, file.name, null)
  }

  async function openCamera() {
    setError(null)
    // 앱 안 촬영이 안 되는 브라우저면 이유를 말하고 파일 고르기로 안내한다(목소리 녹음기와 같은 방식).
    if (!navigator.mediaDevices?.getUserMedia || pickRecorderMime() === null) {
      setError('이 브라우저에서는 바로 찍을 수 없어요. 파일에서 골라 주세요.')
      return
    }
    setPhase('preparing')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      })
      streamRef.current = stream
      setPhase('live')
      // 미리보기는 그린 뒤에 붙인다(live 단계에서 video 요소가 생긴다).
      requestAnimationFrame(() => {
        if (liveRef.current) {
          liveRef.current.srcObject = stream
          void liveRef.current.play().catch(() => {})
        }
      })
    } catch (cameraError) {
      console.error('[추억 영상] 카메라를 켜지 못했다:', cameraError)
      releaseCamera()
      setError(describeCameraError(cameraError))
      setPhase('idle')
    }
  }

  function startRecording() {
    const stream = streamRef.current
    const mimeType = pickRecorderMime()
    if (!stream || !mimeType) {
      setError('이 브라우저에서는 바로 찍을 수 없어요. 파일에서 골라 주세요.')
      releaseCamera()
      setPhase('idle')
      return
    }

    chunksRef.current = []
    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      const elapsedSec = Math.min(Date.now() - startedAtRef.current, VIDEO_MAX_MS) / 1000
      const type = normalizeVideoMime(recorder.mimeType || mimeType) ?? 'video/webm'
      const blob = new Blob(chunksRef.current, { type })
      chunksRef.current = []
      recorderRef.current = null
      releaseCamera()
      void accept(blob, '', elapsedSec)
    }

    startedAtRef.current = Date.now()
    setElapsedMs(0)
    recorder.start()
    setPhase('recording')
    tickRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current)
    }, 250)
    // 30초가 되면 저절로 멈춘다 — 넘겨 찍고 나서 거절당하지 않게.
    stopTimerRef.current = setTimeout(() => stopRecording(), VIDEO_MAX_MS)
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  function cancelCamera() {
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder && recorder.state !== 'inactive') {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.stop()
    }
    releaseCamera()
    setPhase('idle')
  }

  const locked = disabled || phase === 'checking' || phase === 'preparing'

  // 담긴 영상 — 미리보기와 [빼기].
  if (value) {
    return (
      <div className="flex flex-col gap-2">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-inner bg-black">
          <video
            src={value.previewUrl}
            controls
            playsInline
            preload="metadata"
            aria-label="담은 영상 미리보기"
            className="h-full w-full object-contain"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-base text-muted tabular-nums">
            {formatVideoDuration(value.durationMs)}
            <span className="sr-only"> 길이 영상</span>
          </span>
          <Button
            variant="secondary"
            size="md"
            disabled={disabled}
            onClick={() => {
              setError(null)
              onChange(null)
            }}
          >
            영상 빼기
          </Button>
        </div>
      </div>
    )
  }

  // 카메라가 켜진 동안.
  if (phase === 'live' || phase === 'recording') {
    const recording = phase === 'recording'
    return (
      <div className="flex flex-col gap-2">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-inner bg-black">
          <video
            ref={liveRef}
            muted
            playsInline
            autoPlay
            aria-label="카메라 화면"
            className="h-full w-full object-cover"
          />
          {recording ? (
            <span
              role="timer"
              aria-live="off"
              className="absolute top-2 left-2 rounded-full bg-ink/80 px-3 py-1 text-sm font-bold text-white tabular-nums"
            >
              ● {formatVideoDuration(elapsedMs)} / {formatVideoDuration(VIDEO_MAX_MS)}
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="md" fullWidth onClick={cancelCamera}>
            그만두기
          </Button>
          {recording ? (
            <Button size="md" fullWidth onClick={stopRecording}>
              멈추고 담기
            </Button>
          ) : (
            <Button size="md" fullWidth onClick={startRecording}>
              찍기 시작
            </Button>
          )}
        </div>
        <p className="text-sm text-muted">30초가 되면 저절로 멈춰요.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="md"
          fullWidth
          disabled={locked}
          onClick={() => fileInputRef.current?.click()}
        >
          파일에서 고르기
        </Button>
        <Button
          variant="secondary"
          size="md"
          fullWidth
          disabled={locked}
          onClick={openCamera}
        >
          {phase === 'preparing' ? '카메라 켜는 중…' : '바로 찍기'}
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={VIDEO_MIME_TYPES.join(',')}
        onChange={handleFile}
        disabled={locked}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
      <p className="text-sm text-muted">30초 · 50MB까지 한 개를 담을 수 있어요.</p>
      {phase === 'checking' ? (
        <p role="status" className="text-base text-muted">
          영상을 확인하는 중이에요…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-base leading-relaxed break-keep text-primary">
          {error}
        </p>
      ) : null}
    </div>
  )
}
