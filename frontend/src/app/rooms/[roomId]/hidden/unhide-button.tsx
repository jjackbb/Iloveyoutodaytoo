'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/Button'
import { unhideMemory } from '@/lib/actions/memories'

/**
 * 숨긴 추억을 다시 보이게 하기.
 *
 * 여기가 **숨김을 푸는 유일한 자리**다. 숨긴 글은 피드에서 사라져 카드의 ⋯ 메뉴를
 * 다시 열 수가 없기 때문이다.
 *
 * 누르면 서버 액션이 내 `memory_hides` 행을 지우고, 방 아래 화면들을 다시 읽게 한다.
 * 이 화면도 그때 다시 그려지면서 그 카드가 목록에서 빠진다 —
 * 여기서 상태를 들고 있다가 카드를 직접 감추지 않는다. 서버가 센 것만 화면에 있다.
 */
export function UnhideButton({
  memoryId,
  authorName,
}: {
  memoryId: string
  /** 낭독기에서 어느 추억의 버튼인지 알리기 위해. 화면에 버튼이 여럿이다. */
  authorName: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      {/* 되돌릴 수 있는 가벼운 동작이라 md를 쓴다(Button의 크기 기준). */}
      <Button
        variant="secondary"
        size="md"
        fullWidth
        pending={pending}
        pendingText="되돌리는 중…"
        aria-label={`${authorName}님의 추억 다시 보이게 하기`}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await unhideMemory(memoryId)
            if (!result.ok) setError(result.error)
          })
        }}
      >
        다시 보이게 하기
      </Button>

      {error ? (
        <p role="alert" className="text-base leading-relaxed text-primary">
          {error}
        </p>
      ) : null}
    </div>
  )
}
