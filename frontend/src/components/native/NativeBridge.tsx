'use client'

import { AppUrlOpen } from './AppUrlOpen'
import { WidgetTokenSync } from './WidgetTokenSync'

/**
 * 앱(Capacitor) 안에서만 의미 있는 다리들을 한 자리에 모아 루트 레이아웃에 꽂는다.
 *
 * 하나로 묶는 이유: 다리가 하나 늘 때마다 layout.tsx 를 열지 않기 위해서다.
 * 각 다리는 스스로 "앱 안인가"를 확인하고 브라우저에서는 아무 일도 하지 않는다.
 *
 * - AppUrlOpen      — 딥링크(초대 링크·위젯 탭)로 앱이 열렸을 때 그 화면으로 이동
 * - WidgetTokenSync — 로그인 상태를 위젯 토큰으로 바꿔 네이티브 저장소에 둔다
 */
export function NativeBridge() {
  return (
    <>
      <AppUrlOpen />
      <WidgetTokenSync />
    </>
  )
}
