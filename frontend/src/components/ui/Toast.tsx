'use client'

import { useEffect, useState } from 'react'

/**
 * 잠깐 떴다 사라지는 알림 (캡처 08 "앨범방 규격에 맞춰 커버사진을 담았어요 🖼",
 * 캡처 10 "앨범방이 만들어졌어요 🎉").
 *
 * 캡처 모양: 검은 알약, 화면 가운데 아래, 하단 버튼 위에 뜬다.
 *
 * 왜 검은색인가: 이 알약은 어떤 화면 위에든 뜬다. 우리 분홍 토큰을 쓰면
 * 분홍 버튼 위에서 묻힌다. 검정 위 흰 글자는 대비 최대(21:1)라 어디서든 읽힌다.
 *
 * **같은 문구를 다시 띄우려면 부모가 `key`를 바꿔라.** 이 부품은 마운트될 때
 * 한 번 타이머를 걸고 끝난다 — 안에 상태를 쌓아두지 않기 위해서다.
 */
export function Toast({
  message,
  /** 몇 밀리초 뒤에 사라질지. 시니어가 읽을 시간을 넉넉히 준다. */
  duration = 3200,
  /** 하단에서 얼마나 띄울지. 화면마다 아래 고정 줄 높이가 달라서 열어 뒀다. */
  offsetClassName = 'bottom-28',
}: {
  message: string
  duration?: number
  offsetClassName?: string
}) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), duration)
    return () => clearTimeout(timer)
  }, [duration])

  return (
    /*
      사라진 뒤에도 이 칸 자체는 남긴다. role="status"인 요소를 통째로 없앴다
      다시 만들면 낭독기가 새 영역으로 보고 다음 알림을 놓칠 수 있다.
      안의 글자만 비운다.

      pointer-events-none: 알약이 하단 버튼 위를 지나가므로 터치를 가로채면 안 된다.
    */
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-6 ${offsetClassName}`}
    >
      {visible ? (
        <p className="max-w-full rounded-chip bg-ink/90 px-5 py-3 text-center text-base font-bold break-keep text-white shadow-card">
          {message}
        </p>
      ) : null}
    </div>
  )
}
