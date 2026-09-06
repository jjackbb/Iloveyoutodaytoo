'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { issueWidgetToken, widgetSessionAlive } from '@/lib/actions/widget'
import { isNativeAppClient } from '@/lib/native'

/**
 * 위젯 토큰 동기화 — 로그인 상태를 위젯이 쓸 수 있는 토큰으로 바꿔 기기 저장소에 둔다.
 *
 * 위젯은 웹뷰 밖에서 살아 로그인 세션을 못 본다. 그래서
 *  - 로그인돼 있고 기기에 토큰이 없으면 → 서버가 발급(issue_widget_token) → 기기에 저장
 *  - 로그인이 풀렸는데 기기에 토큰이 남아 있으면 → 지운다(위젯이 남의 것을 보여주면 안 된다)
 *
 * 저장은 @capacitor/preferences. 네이티브 위젯은 SharedPreferences "CapacitorStorage" 의
 * "widget_token" 을 그대로 읽는다(android/…/widget/WidgetContract.java). 키 이름을
 * 바꾸면 그쪽도 함께.
 *
 * 언제 도나: 마운트 때와 **경로가 바뀔 때마다**. 로그인·로그아웃은 전부 redirect 로
 * 끝나므로 경로 변화가 곧 "세션이 바뀌었을지 모른다"는 신호다. 서버 왕복 한 번이라
 * 화면마다 부르는 비용은 작다.
 */
const TOKEN_KEY = 'widget_token'

export function WidgetTokenSync() {
  const pathname = usePathname()
  // 화면을 빠르게 오가면 겹쳐 돌 수 있다. 하나가 도는 동안은 다음 것을 건너뛴다.
  const running = useRef(false)

  useEffect(() => {
    if (!isNativeAppClient()) return
    if (running.current) return
    running.current = true

    let cancelled = false

    void (async () => {
      try {
        const { Preferences } = await import('@capacitor/preferences')
        const alive = await widgetSessionAlive()
        if (cancelled) return

        const { value: stored } = await Preferences.get({ key: TOKEN_KEY })

        if (!alive) {
          if (stored) await Preferences.remove({ key: TOKEN_KEY })
          return
        }
        if (stored) return

        const { token } = await issueWidgetToken()
        if (!cancelled && token) {
          await Preferences.set({ key: TOKEN_KEY, value: token })
        }
      } catch (cause) {
        // 위젯 때문에 화면이 깨지면 안 된다. 다음 경로 변화에서 다시 시도한다.
        console.error('[위젯] 토큰 동기화 실패:', cause)
      } finally {
        running.current = false
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pathname])

  return null
}
