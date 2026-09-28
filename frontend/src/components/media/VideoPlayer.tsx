'use client'

import { useRef } from 'react'
import type { MemoryVideoRange } from '@/lib/memory-expression'

/**
 * 추억 영상 재생 (2026-09-26 추억 영상).
 *
 * 브라우저 기본 재생 막대를 그대로 쓴다. 재생·멈춤·전체 화면·음량을 이미 알고 있는
 * 모양이라 새로 배울 것이 없다(카카오톡 영상과 같은 판단). 자동 재생하지 않는다 —
 * 소리가 갑자기 나오면 방을 열어 두기가 부담스러워진다.
 *
 * 주소는 비공개 버킷의 서명 URL이다. 서명이 끝나면(1시간) 새로 열어야 한다.
 * 파일은 있는데 주소를 못 만들었으면 자리를 비우지 않고 이유를 남긴다(사진·목소리와 같은 규칙).
 */
export function VideoPlayer({
  src,
  label,
  className = '',
  range,
}: {
  /** 서명된 video 버킷 주소. 못 만들었으면 null. */
  src: string | null
  /** 낭독기가 읽을 이름. 예: "엄마님이 남긴 영상". */
  label: string
  className?: string
  /** 파일은 그대로 두고 이 구간만 재생한다. 첫 정지 장면은 posterMs다. */
  range?: MemoryVideoRange | null
}) {
  const played = useRef(false)
  if (!src) {
    return (
      <p className={`text-sm text-muted ${className}`}>
        영상을 불러오지 못했어요. 잠시 후 다시 열어주세요.
      </p>
    )
  }

  return (
    <div className={`aspect-[4/3] w-full overflow-hidden rounded-inner bg-black ${className}`}>
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => {
          if (range) event.currentTarget.currentTime = range.posterMs / 1000
        }}
        onPlay={(event) => {
          if (!range) return
          const media = event.currentTarget
          if (!played.current || media.currentTime * 1000 >= range.endMs - 30 || media.currentTime * 1000 < range.startMs - 30) {
            media.currentTime = range.startMs / 1000
          }
          played.current = true
        }}
        onTimeUpdate={(event) => {
          if (!range) return
          const media = event.currentTarget
          if (media.currentTime * 1000 >= range.endMs - 30) {
            media.pause()
            media.currentTime = range.endMs / 1000
          }
        }}
        aria-label={label}
        className="h-full w-full object-contain"
      >
        이 브라우저에서는 영상을 재생할 수 없어요.
      </video>
    </div>
  )
}
