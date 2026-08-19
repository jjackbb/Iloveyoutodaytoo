'use client'

import { useState } from 'react'

import { PhotoViewer, type ViewerPhoto } from '@/components/media/PhotoViewer'

/**
 * 갤러리 격자 (캡처 22) + 전체화면 뷰어 (노션 IA 6.5).
 *
 * 격자 자체는 글자도 상태도 없는 순수한 화면이지만, **누르면 크게 보여야** 하므로
 * 이 한 덩어리만 클라이언트로 둔다. 사진을 고르고 서명하는 일은 서버(page.tsx)가 한다 —
 * 이 부품은 DB도 Storage도 보지 않는다.
 *
 * 잔여데이터가 아닌 이유: 들고 있는 것은 "지금 몇 번째 사진을 크게 보는 중인가" 하나뿐이고,
 * 닫으면 사라진다. 어디에도 저장하지 않는다.
 */
export function GalleryGrid({
  photos,
}: {
  photos: (ViewerPhoto & { key: string })[]
}) {
  const [viewerAt, setViewerAt] = useState<number | null>(null)

  return (
    <>
      {/* 격자는 사진끼리 맞닿는다(피드 카드의 그리드와 같은 2px 틈). */}
      <ul className="grid list-none grid-cols-3 gap-0.5">
        {photos.map((photo, position) => (
          <li key={photo.key} className="aspect-square overflow-hidden bg-surface-soft">
            <button
              type="button"
              onClick={() => setViewerAt(position)}
              aria-label={`${photo.alt} 크게 보기`}
              className="block h-full w-full"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.alt}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      {viewerAt !== null ? (
        <PhotoViewer
          photos={photos}
          startIndex={viewerAt}
          onClose={() => setViewerAt(null)}
        />
      ) : null}
    </>
  )
}
