'use client'

import { useState } from 'react'

import { PhotoViewer, type ViewerPhoto } from '@/components/media/PhotoViewer'

/**
 * 갤러리 격자 (캡처 22) + 전체화면 뷰어 (노션 IA 6.5).
 *
 * **월별로 끊어서 보여준다** — 카카오톡 채팅방 서랍의 사진 모아보기와 같은 방식이다.
 * 사진이 쌓이면 평평한 격자에서는 "그게 언제였더라"를 짚을 수가 없다.
 * 스크롤하다 만나는 "2026년 8월"이 그 자리를 대신한다.
 *
 * 묶는 이름(month)은 서버가 KST로 만들어 내려준다 — 브라우저 시간대에 따라
 * 월말 밤에 올린 사진이 다음 달로 넘어가면 안 된다.
 *
 * 격자 자체는 글자도 상태도 없지만 **누르면 크게 보여야** 하므로 이 덩어리만
 * 클라이언트로 둔다. 사진을 고르고 서명하는 일은 서버(page.tsx)가 한다 —
 * 이 부품은 DB도 Storage도 보지 않는다.
 *
 * 잔여데이터가 아닌 이유: 들고 있는 것은 "지금 몇 번째 사진을 크게 보는 중인가"
 * 하나뿐이고, 닫으면 사라진다.
 */

export type GalleryPhoto = ViewerPhoto & {
  key: string
  /** "2026년 8월". 이어지는 같은 값끼리 한 덩어리가 된다. */
  month: string
}

export function GalleryGrid({ photos }: { photos: GalleryPhoto[] }) {
  const [viewerAt, setViewerAt] = useState<number | null>(null)

  /*
    달별로 묶는다. 사진은 이미 최신순으로 정렬돼 내려오므로 **이어지는 것끼리만**
    묶으면 된다 — 같은 달을 다시 만나는 일은 없다. 정렬을 여기서 다시 하지 않는 이유:
    화면이 순서를 새로 정하면 서버가 준 순서와 어긋난다.

    번호(index)를 함께 들고 가는 이유: 전체화면 뷰어는 **전체 목록에서 몇 번째인가**로
    시작 위치를 잡는다. 달 안의 순번을 넘기면 엉뚱한 사진이 열린다.
  */
  const groups: { month: string; items: { photo: GalleryPhoto; index: number }[] }[] = []
  photos.forEach((photo, index) => {
    const last = groups.at(-1)
    if (last && last.month === photo.month) last.items.push({ photo, index })
    else groups.push({ month: photo.month, items: [{ photo, index }] })
  })

  return (
    <>
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <section key={group.month} className="flex flex-col gap-2">
            <h3 className="text-base font-bold text-ink">{group.month}</h3>

            {/* 격자는 사진끼리 맞닿는다(피드 카드의 그리드와 같은 2px 틈). */}
            <ul
              aria-label={`${group.month}에 남긴 사진`}
              className="grid list-none grid-cols-3 gap-0.5"
            >
              {group.items.map(({ photo, index }) => (
                <li
                  key={photo.key}
                  className="aspect-square overflow-hidden bg-surface-soft"
                >
                  <button
                    type="button"
                    onClick={() => setViewerAt(index)}
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
          </section>
        ))}
      </div>

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
