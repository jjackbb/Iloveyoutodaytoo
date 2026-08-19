'use client'

import { useRef, useState } from 'react'

import { PhotoViewer } from '@/components/media/PhotoViewer'
import type { MemoryPhotoView } from '@/components/memory/MemoryCard'

/**
 * 상세 화면의 사진 페이저 (캡처 24 — 오른쪽 아래 "1/3" 배지).
 *
 * 피드 카드는 4컷 격자로 한눈에 보여주지만, 상세는 한 장씩 넘겨본다.
 * 두 화면이 다른 이유: 피드는 "무엇이 있는지" 훑는 자리이고 상세는 "이 사진을 본다"는 자리다.
 *
 * 넘기는 일은 브라우저의 가로 스크롤과 CSS 스크롤 스냅이 한다 — 손가락으로 끌든
 * 트랙패드로 밀든 키보드 방향키를 쓰든 이미 다 되는 동작이다. 직접 만들면 그 셋을 다 놓친다.
 * 자바스크립트가 하는 일은 **몇 번째 장을 보고 있는지 세는 것**과,
 * 사진을 누르면 전체화면 뷰어를 여는 것뿐이다(노션 IA 6.5).
 */
export function PhotoPager({
  photos,
  hasPhotos,
  authorName,
}: {
  photos: MemoryPhotoView[]
  /** DB 기준으로 사진이 있는지. 주소를 못 만든 경우와 원래 없는 경우를 가른다. */
  hasPhotos: boolean
  authorName: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  /** 전체화면으로 볼 사진의 번호. null이면 안 열린 상태다. */
  const [viewerAt, setViewerAt] = useState<number | null>(null)

  if (photos.length === 0) {
    // 사진이 있는데 주소를 못 만들었으면 자리를 없애지 않고 사실을 말한다.
    // 통째로 사라지면 "사진이 없는 글"로 잘못 읽힌다(MemoryCard와 같은 판단).
    if (!hasPhotos) return null
    return (
      <p className="pt-1 text-sm text-muted">
        사진을 불러오지 못했어요. 잠시 후 다시 열어주세요.
      </p>
    )
  }

  const many = photos.length > 1

  return (
    <div className="relative overflow-hidden rounded-inner bg-surface-soft">
      <div
        ref={trackRef}
        /*
          여러 장일 때만 넘길 수 있는 자리가 된다. tabIndex를 주면 키보드 방향키로도
          넘어간다(브라우저가 스크롤 컨테이너에 넣어주는 기본 동작).
          한 장뿐이면 스크롤할 것이 없으므로 초점을 받지 않는다 — 아무 일도 일어나지 않는
          자리에 초점이 머무르면 키보드 사용자가 헤맨다.
        */
        tabIndex={many ? 0 : undefined}
        role={many ? 'group' : undefined}
        aria-label={
          many ? `${authorName}님이 남긴 사진 ${photos.length}장` : undefined
        }
        onScroll={(event) => {
          const track = event.currentTarget
          if (track.clientWidth === 0) return
          const next = Math.round(track.scrollLeft / track.clientWidth)
          setIndex(Math.min(photos.length - 1, Math.max(0, next)))
        }}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((photo, position) => (
          <div
            key={photo.url}
            className="aspect-[4/3] w-full shrink-0 snap-center snap-always"
          >
            {/*
              사진 자체가 [크게 보기] 버튼이다 (노션 IA 6.5).
              돋보기 아이콘을 따로 얹지 않은 이유 — 사진 위에 놓이는 것은 무엇이든
              사진을 가린다. 여기서는 사진을 누르는 것이 가장 자연스러운 동작이다.
              대신 낭독기에는 "크게 보기"라고 분명히 읽힌다.
            */}
            <button
              type="button"
              onClick={() => setViewerAt(position)}
              aria-label={
                many
                  ? `${position + 1}번째 사진 크게 보기`
                  : '사진 크게 보기'
              }
              className="block h-full w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={
                  many
                    ? `${authorName}님이 남긴 사진 ${position + 1}번째`
                    : `${authorName}님이 남긴 사진`
                }
                className="h-full w-full object-cover"
              />
            </button>
          </div>
        ))}
      </div>

      {/*
        "1/3" 배지 (캡처 24). 두 장 이상일 때만 뜬다 — 한 장뿐인데 "1/1"이 붙으면
        더 넘길 수 있다는 뜻으로 읽힌다.
        낭독기에는 배지 대신 사진마다 붙은 "N번째" 설명이 같은 것을 알려주므로 숨긴다.
      */}
      {many ? (
        <span
          aria-hidden
          className="absolute right-2.5 bottom-2.5 rounded-chip bg-black/55 px-2.5 py-1 text-sm font-bold tabular-nums text-white shadow-chip"
        >
          {index + 1}/{photos.length}
        </span>
      ) : null}

      {viewerAt !== null ? (
        <PhotoViewer
          photos={photos.map((photo, position) => ({
            url: photo.url,
            alt: many
              ? `${authorName}님이 남긴 사진 ${position + 1}번째`
              : `${authorName}님이 남긴 사진`,
          }))}
          startIndex={viewerAt}
          onClose={() => setViewerAt(null)}
        />
      ) : null}
    </div>
  )
}
