'use client'

import { useOptimistic, useTransition } from 'react'

import { setLargeText } from '@/lib/actions/profile'

/**
 * 마이 화면의 "큰 글자" 토글 (캡처 48).
 *
 * 왜 클라이언트 부품인가: 스위치는 눌린 즉시 움직여야 한다. 서버 왕복을 기다리면
 * 손가락을 떼고도 잠깐 그대로라 "안 눌렸나?" 하고 두 번 누르게 된다.
 * `useOptimistic`으로 먼저 움직이고, 서버가 실패하면 저절로 제자리로 돌아온다.
 *
 * 잔여데이터가 아닌 이유: 여기서 만든 값은 화면이 살아 있는 동안만 쓰는 임시 표시다.
 * 진짜 값은 매번 서버에서 내려온 `enabled`이고, 저장이 끝나면 그 값으로 덮인다.
 *
 * <input type="checkbox">를 쓴 이유: 낭독기가 "스위치, 켜짐/꺼짐"으로 읽어주고
 * 키보드 스페이스로도 눌린다. div로 만든 스위치는 둘 다 안 된다.
 */
export function LargeTextRow({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition()
  const [shown, showNow] = useOptimistic(enabled)

  function toggle(next: boolean) {
    startTransition(async () => {
      showNow(next)
      await setLargeText(next)
    })
  }

  return (
    <li>
      <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 px-5 py-4">
        <span className="text-lg text-ink">큰 글자</span>

        {/*
          스위치 모양은 트랙 위에 동그라미를 얹어 만든다.
          체크박스 자체는 sr-only로 숨기되 지우지는 않는다 — 지우면 낭독기와
          키보드가 못 쓴다.

          모양을 peer- 변형 대신 JS로 계산하는 이유: peer- 는 **형제**에만 걸린다.
          동그라미는 트랙의 자식이라 형제가 아니어서 peer-checked 가 안 먹는다.
        */}
        <input
          type="checkbox"
          className="sr-only"
          checked={shown}
          disabled={pending}
          onChange={(e) => toggle(e.target.checked)}
        />

        <span
          aria-hidden
          className={`relative h-[31px] w-[51px] shrink-0 rounded-chip transition-colors ${
            shown ? 'bg-primary' : 'bg-hairline-strong'
          } ${pending ? 'opacity-60' : ''}`}
        >
          <span
            className={`absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-chip bg-card shadow-pill transition-transform ${
              shown ? 'translate-x-[20px]' : ''
            }`}
          />
        </span>
      </label>
    </li>
  )
}
