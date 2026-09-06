'use client'

/**
 * 딥링크 수신 — 앱이 URL 로 열렸을 때 웹뷰를 그 화면으로 보낸다.
 *
 * 두 경로가 같은 자리로 들어온다:
 * 1. App Links — 설치돼 있을 때 초대 링크(https://…/invite/*)를 누르면 시스템이 앱을 연다
 * 2. Install Referrer — 설치 뒤 첫 실행에서 네이티브가 초대 토큰을 읽어 같은 모양의
 *    인텐트를 자기 자신에게 쏜다. 위젯 탭도 같은 통로를 쓴다
 */

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { isNativeAppClient } from '@/lib/native'

export function AppUrlOpen() {
  const router = useRouter()

  useEffect(() => {
    // 브라우저에서는 아무 일도 하지 않는다. @capacitor/app 을 여기서(효과 안에서)
    // 불러오는 이유도 같다 — 앱이 아닌 사람의 번들에 플러그인이 딸려가지 않게.
    if (!isNativeAppClient()) return

    let cancelled = false
    let removeListener: (() => void) | undefined

    const go = (raw: string | null | undefined) => {
      if (!raw) return

      let target: URL
      try {
        target = new URL(raw)
      } catch {
        // 주소로 못 읽히는 것은 버린다. 여기서 던지면 앱이 흰 화면으로 멈춘다.
        return
      }

      /*
        우리 도메인이 아니면 무시한다.

        웹뷰가 부르는 주소(capacitor.config.ts 의 server.url)가 곧 location 이라
        location.host 와 비교하면 배포 주소가 바뀌어도 따라온다.
        이 확인을 빼면 바깥에서 쏜 인텐트로 앱 안 화면을 마음대로 열 수 있다.
      */
      if (target.host !== window.location.host) return

      router.push(`${target.pathname}${target.search}`)
    }

    void (async () => {
      const { App } = await import('@capacitor/app')

      const handle = await App.addListener('appUrlOpen', ({ url }) => go(url))
      if (cancelled) {
        void handle.remove()
        return
      }
      removeListener = () => void handle.remove()

      /*
        콜드 스타트 — 앱이 꺼져 있는 상태에서 링크로 켜지면 appUrlOpen 이
        리스너를 달기 전에 이미 지나간다. 그래서 시작 주소를 한 번 직접 묻는다.
        (평소 실행에서는 undefined 라 아무 일도 안 일어난다)
      */
      const launch = await App.getLaunchUrl()
      if (!cancelled) go(launch?.url)
    })()

    return () => {
      cancelled = true
      removeListener?.()
    }
  }, [router])

  return null
}
