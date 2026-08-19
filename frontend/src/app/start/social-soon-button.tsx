'use client'

import { useState } from 'react'

/**
 * 아직 못 여는 시작 버튼 (캡처 01의 카카오·휴대폰·Google·Apple).
 *
 * 외부 서비스 등록이 끝나지 않아 **실제로는 안 된다.** 그래서 [준비 중]을 붙여
 * 눌리기 전에 알리고, 그래도 눌린 경우에는 지금 되는 길을 말해준다.
 *
 * `disabled`를 쓰지 않은 이유: 진짜로 잠가버리면 낭독기가 그 자리를 건너뛰어
 * "카카오 로그인이 있긴 한데 준비 중"이라는 사실 자체가 전달되지 않는다.
 * 눌러서 이유를 들을 수 있는 편이 낫다.
 *
 * 잔여데이터가 아닌 이유: 안내 문구를 펼쳤는지 여부뿐이고, 화면을 떠나면 사라진다.
 */
export function SocialSoonButton({ provider }: { provider: string }) {
  const [told, setTold] = useState(false)

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setTold(true)}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-inner border border-hairline-strong bg-card px-4 text-base font-bold text-muted active:bg-surface-soft"
      >
        {provider}로 시작하기
        <span className="rounded-chip bg-surface-soft px-2 py-0.5 text-sm font-medium">
          준비 중
        </span>
      </button>

      {told ? (
        <p role="status" className="px-1 text-sm leading-relaxed text-muted">
          {provider} 연결은 아직 준비 중이에요. 지금은 위의 [아이디로 시작하기]로
          시작하실 수 있어요.
        </p>
      ) : null}
    </div>
  )
}
