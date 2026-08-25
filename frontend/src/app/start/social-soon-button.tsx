'use client'

import { useState } from 'react'

/** 아직 못 여는 시작 수단들. 외부 서비스 등록이 끝나지 않았다. */
const SOON_PROVIDERS = ['카카오', '휴대폰 번호', 'Google'] as const

/**
 * "다른 방법으로 시작하기" — 준비 중인 시작 수단 셋을 접어둔 서랍.
 *
 * ## 왜 접었나
 *
 * 전에는 똑같이 생긴 버튼 4개가 쌓여 있었고 그중 3개가 [준비 중]이었다.
 * 첫인상이 **"대부분 안 되는 앱"**으로 읽힌다. 그래서 지금 되는 길 하나만
 * 큰 버튼으로 두고 나머지는 여기 넣었다.
 *
 * ## 왜 지우지는 않았나
 *
 * 지우면 나중에 켤 때 화면을 다시 짜야 하고, 무엇보다 "카카오로 되겠지" 하고 온 분이
 * **왜 없는지 알 수 없다.** 펼치면 그대로 있고, 눌리면 왜 아직 안 되는지 말해준다.
 *
 * `disabled`를 쓰지 않은 이유: 진짜로 잠그면 낭독기가 그 자리를 건너뛰어
 * "카카오가 있긴 한데 준비 중"이라는 사실 자체가 전달되지 않는다.
 *
 * 잔여데이터가 아닌 이유: 펼쳤는지 여부뿐이고 화면을 떠나면 사라진다.
 */
export function SocialSoonDrawer() {
  const [open, setOpen] = useState(false)
  const [told, setTold] = useState<string | null>(null)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="min-h-11 w-full text-base font-semibold text-muted"
      >
        <span className="border-b border-hairline-strong pb-px">
          {open ? '접기' : '다른 방법으로 시작하기'}
        </span>
      </button>

      {open ? (
        <div className="mt-3 flex flex-col gap-2">
          {SOON_PROVIDERS.map((provider) => (
            <div key={provider} className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setTold(provider)}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-inner border border-hairline-strong bg-card px-4 text-base font-bold text-muted active:bg-surface-soft"
              >
                {provider}로 시작하기
                <span className="rounded-chip bg-surface-soft px-2 py-0.5 text-sm font-medium">
                  준비 중
                </span>
              </button>

              {told === provider ? (
                <p role="status" className="px-1 text-sm leading-relaxed text-muted">
                  {provider} 연결은 아직 준비 중이에요. 지금은 위의 [시작하기]로
                  시작하실 수 있어요.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
