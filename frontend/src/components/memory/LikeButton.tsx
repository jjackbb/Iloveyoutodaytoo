'use client'

import { useTransition } from 'react'

import { toggleMemoryLike } from '@/lib/actions/memories'

/**
 * 게시물 좋아요 ♡ (캡처 22 카드 왼쪽 아래).
 *
 * 이 파일만 'use client'다. 카드도 피드도 서버 컴포넌트로 남는다.
 *
 * 눌린 상태를 여기서 들고 있지 않는다. 서버 액션이 DB를 바꾸고 revalidatePath로
 * 피드를 다시 그리면 수와 채움 여부가 함께 내려온다. 클라이언트가 수를 직접 +1 하면
 * 옆 사람이 같은 순간에 누른 좋아요가 사라진 것처럼 보인다.
 *
 * 색으로만 구분하지 않는다 — 눌렀으면 하트가 **채워지고**, 아니면 테두리만 남는다(WCAG 1.4.1).
 */
export function LikeButton({
  memoryId,
  authorName,
  likeCount,
  liked,
}: {
  memoryId: string
  /** 낭독기에서 어느 게시물인지 구분할 수 있게. 피드에 ♡가 여럿이다. */
  authorName: string
  likeCount: number
  liked: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      // 터치 목표 44px. 보이는 것은 하트와 숫자뿐이지만 누를 수 있는 자리는 넉넉하게 둔다.
      // 색은 조건으로 정한다 — 변형(aria-pressed:)에 맡기면 어느 규칙이 이기는지가
      // 클래스 정렬 순서에 달려 조용히 어긋날 수 있다.
      className={`-mx-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-inner px-2 text-sm font-medium transition-colors active:bg-surface-soft disabled:opacity-60 ${
        liked ? 'text-primary' : 'text-muted'
      }`}
      // 토글이라 aria-pressed로 지금 상태를 알린다. 이름은 늘 같고 눌림 여부만 바뀐다.
      aria-pressed={liked}
      // 수까지 이름에 넣는다. aria-label은 안의 글자를 **덮으므로**, 넣지 않으면
      // 낭독기 사용자에게는 몇 명이 눌렀는지가 통째로 사라진다.
      aria-label={`${authorName}님의 추억에 좋아요 ${likeCount}개`}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await toggleMemoryLike(memoryId)
        })
      }}
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 20.5S3.5 15.2 3.5 9.4A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 8.5 3.4c0 5.8-8.5 11.1-8.5 11.1Z" />
      </svg>
      <span className="tabular-nums">{likeCount}</span>
    </button>
  )
}
