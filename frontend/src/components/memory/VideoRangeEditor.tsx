'use client'

import { useEffect, useRef, useState } from 'react'

import type { PickedVideo } from './VideoPicker'
import { memoryVideoRange, type MemoryVideoRange } from '@/lib/memory-expression'
import { formatVideoDuration } from '@/lib/video'
import './video-range-editor.css'

/** 원본 파일을 바꾸지 않고 보일 구간과 대표 장면만 고른다. */
export function VideoRangeEditor({ video, value, onChange, disabled }: {
  video: PickedVideo
  value: MemoryVideoRange | null
  onChange: (next: MemoryVideoRange) => void
  disabled: boolean
}) {
  const [frames, setFrames] = useState<{ url: string; images: string[] } | null>(null)
  const [pickingPoster, setPickingPoster] = useState(false)
  const posterVideo = useRef<HTMLVideoElement>(null)
  const range = value ?? memoryVideoRange(video.durationMs, null, null, null)
  const { startMs, endMs, posterMs } = range
  const total = Math.max(video.durationMs, 1)

  useEffect(() => {
    const url = video.previewUrl
    let cancelled = false
    const media = document.createElement('video')
    media.crossOrigin = 'anonymous'
    media.preload = 'auto'
    media.muted = true
    media.src = url
    const makeFrames = async () => {
      await new Promise<void>((resolve, reject) => {
        if (media.readyState >= 2) { resolve(); return }
        media.addEventListener('loadeddata', () => resolve(), { once: true })
        media.addEventListener('error', () => reject(new Error('video load')), { once: true })
      })
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 72
      const context = canvas.getContext('2d')
      if (!context) return
      const images: string[] = []
      for (let index = 0; index < 8; index += 1) {
        if (cancelled) return
        await new Promise<void>((resolve) => {
          const done = () => { clearTimeout(timer); media.removeEventListener('seeked', done); resolve() }
          const timer = setTimeout(done, 1500)
          media.addEventListener('seeked', done)
          media.currentTime = ((index + 0.5) / 8) * video.durationMs / 1000
        })
        context.drawImage(media, 0, 0, canvas.width, canvas.height)
        images.push(canvas.toDataURL('image/jpeg', 0.7))
      }
      if (!cancelled) setFrames({ url, images })
    }
    void makeFrames().catch(() => { if (!cancelled) setFrames(null) })
    return () => { cancelled = true; media.removeAttribute('src'); media.load() }
  }, [video.previewUrl, video.durationMs])

  useEffect(() => {
    if (posterVideo.current && posterVideo.current.readyState >= 1) {
      posterVideo.current.currentTime = posterMs / 1000
    }
  }, [posterMs])

  if (video.durationMs < 1000) return null

  const change = (next: Partial<MemoryVideoRange>) => {
    const start = next.startMs ?? startMs
    const end = next.endMs ?? endMs
    const poster = Math.min(Math.max(next.posterMs ?? posterMs, start), end)
    onChange({ startMs: start, endMs: end, posterMs: poster })
  }

  return <div className="memory-video-editor">
    <div className="memory-video-editor-heading"><strong>구간 편집</strong><span role="status">{formatVideoDuration(startMs)} - {formatVideoDuration(endMs)} (선택됨)</span></div>
    <div className="memory-video-strip" style={{ '--start': `${startMs / total * 100}%`, '--end': `${endMs / total * 100}%` } as React.CSSProperties}>
      <div className="memory-video-frames" aria-hidden>{Array.from({ length: 8 }, (_, index) => <span key={index} style={frames?.url === video.previewUrl ? { backgroundImage: `url(${frames.images[index]})` } : undefined} />)}</div>
      <span className="memory-video-dim before" aria-hidden /><span className="memory-video-dim after" aria-hidden /><span className="memory-video-selection" aria-hidden />
      <input aria-label="구간 시작" type="range" min={0} max={video.durationMs} step={100} value={startMs} disabled={disabled} onChange={(event) => change({ startMs: Math.min(Number(event.target.value), endMs - 1000) })} />
      <input aria-label="구간 끝" type="range" min={0} max={video.durationMs} step={100} value={endMs} disabled={disabled} onChange={(event) => change({ endMs: Math.max(Number(event.target.value), startMs + 1000) })} />
    </div>
    <p className="text-sm text-muted">보일 부분만 골라요. 원래 영상은 그대로예요.</p>
    <div className="memory-video-poster"><strong>대표 섬네일 지정</strong><span>{formatVideoDuration(posterMs)} 지점 선택됨</span><button type="button" disabled={disabled} aria-expanded={pickingPoster} onClick={() => setPickingPoster(!pickingPoster)}>{pickingPoster ? '다 골랐어요' : '영상에서 고르기'}</button></div>
    {pickingPoster ? <div className="memory-video-poster-picker">
      <video ref={posterVideo} src={video.previewUrl} muted playsInline preload="metadata" aria-label="고른 섬네일 장면" onLoadedMetadata={(event) => { event.currentTarget.currentTime = posterMs / 1000 }} />
      <input aria-label="대표 섬네일 지점" type="range" min={startMs} max={endMs} step={100} value={posterMs} disabled={disabled} onChange={(event) => change({ posterMs: Number(event.target.value) })} />
    </div> : null}
  </div>
}
