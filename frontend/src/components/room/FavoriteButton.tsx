'use client'

import { useTransition } from 'react'

import { toggleRoomFavorite } from '@/lib/actions/rooms'

/**
 * 앨범방 카드 오른쪽 위 ♡ 즐겨찾기 (캡처 37).
 *
 * 이 파일만 'use client'다. 카드도 홈도 서버 컴포넌트로 남는다 —
 * 상호작용이 필요한 잎 하나만 클라이언트로 내린다.
 *
 * 목록을 여기서 고치지 않는다. 서버 액션이 DB를 바꾸고 revalidatePath('/')로
 * 홈을 다시 그리면 정렬(즐겨찾기 우선)까지 서버가 새로 계산해 내려준다.
 * 클라이언트가 들고 있는 목록을 직접 재정렬하면 서버가 준 값과 어긋나기 시작하고,
 * 그게 이 프로젝트가 프로토타입을 폐기한 이유다.
 */
export function FavoriteButton({
  roomId,
  roomName,
  favorited,
}: {
  roomId: string
  /** 낭독기에서 어느 방인지 구분할 수 있게. 방이 여러 개면 ♡가 여럿이다. */
  roomName: string
  favorited: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      // 카드 전체 덮개보다 위로 올리는 일은 **부모(RoomCard의 감싸개)**가 한다.
      // 여기서 z-10을 줘도 이 버튼은 static이라 듣지 않는다.
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card/95 text-primary shadow-chip transition-transform active:scale-90 disabled:opacity-60"
      // 토글이라 aria-pressed로 지금 상태를 알린다. 이름은 늘 같고 눌림 여부만 바뀐다.
      aria-pressed={favorited}
      aria-label={`${roomName} 앨범방 즐겨찾기`}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await toggleRoomFavorite(roomId)
        })
      }}
    >
      {/*
        색으로만 구분하지 않는다 — 즐겨찾기면 하트가 채워지고, 아니면 테두리만 남는다.
        모양이 다르므로 색을 구분하기 어려운 분도 알아볼 수 있다(WCAG 1.4.1).
      */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill={favorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 20.5S3.5 15.2 3.5 9.4A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 8.5 3.4c0 5.8-8.5 11.1-8.5 11.1Z" />
      </svg>
    </button>
  )
}
