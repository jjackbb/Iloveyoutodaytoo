'use client'

/**
 * 딥링크 수신 — 앱이 URL 로 열렸을 때 웹뷰를 그 화면으로 보낸다.
 *
 * 두 경로가 같은 자리로 들어온다:
 * 1. App Links — 설치돼 있을 때 초대 링크(https://…/invite/*)를 누르면 시스템이 앱을 연다
 * 2. Install Referrer — 설치 뒤 첫 실행에서 네이티브가 초대 토큰을 읽어 같은 모양의
 *    인텐트를 자기 자신에게 쏜다. 위젯 탭도 같은 통로를 쓴다
 *
 * (라우팅 담당이 채운다 — 지금은 빈 다리)
 */
export function AppUrlOpen() {
  return null
}
