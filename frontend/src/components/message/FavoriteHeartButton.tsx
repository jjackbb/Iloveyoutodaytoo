'use client'

import { useTransition } from 'react'

import { toggleHeartMessageFavorite } from '@/lib/actions/mailbox'

/**
 * 사서함 카드 오른쪽의 ♡ (캡처 46·47).
 *
 * 게시물의 좋아요(LikeButton)와 **다른 것**이다. 저쪽은 방 안의 모두에게 보이는
 * 표시라 개수가 함께 나오지만, 이 ♡는 나만 보는 표시라 개수를 그리지 않는다.
 * 사서함은 1:1 기록이고, 받은 마음에 "몇 명이 눌렀나"는 뜻이 없다.
 *
 * 눌린 상태를 여기서 들고 있지 않는다. 서버가 DB를 바꾸고 사서함을 다시 그리면
 * 켜짐 여부가 함께 내려온다. 화면이 스스로 뒤집으면 새로고침 때 되돌아가 보인다.
 *
 * 색으로만 구분하지 않는다 — 켜져 있으면 하트가 **채워진다**(WCAG 1.4.1).
 */
export function FavoriteHeartButton({
  messageId,
  /** 낭독기에서 어느 카드의 ♡인지 구분할 수 있게. 목록에 ♡가 여럿이다. */
  label,
  favorited,
  /** 화면을 다시 그리고 나서 부모가 할 일(목록을 새로 불러오기 등). */
  onToggled,
}: {
  messageId: string
  label: string
  favorited: boolean
  onToggled?: () => void
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      // 보이는 것은 하트뿐이지만 누르는 자리는 44px을 지킨다.
      className={`-m-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors active:bg-surface-soft disabled:opacity-60 ${
        favorited ? 'text-primary' : 'text-muted'
      }`}
      aria-pressed={favorited}
      aria-label={`${label} ♡ 표시`}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await toggleHeartMessageFavorite(messageId)
          onToggled?.()
        })
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill={favorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 20.5S3.5 15.2 3.5 9.4A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 8.5 3.4c0 5.8-8.5 11.1-8.5 11.1Z" />
      </svg>
    </button>
  )
}
