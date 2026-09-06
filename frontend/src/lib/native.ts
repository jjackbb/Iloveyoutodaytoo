/**
 * "지금 이 요청/화면이 안드로이드 앱 안인가?"를 판별하는 단 한 곳.
 *
 * PRD §6⑮ — 웹 서비스는 폐기하고 안드로이드 앱 하나로 간다. 그래서 서버는
 * 브라우저로 온 사람을 소개·스토어 화면으로 보내고, 앱으로 온 사람만 통과시킨다.
 *
 * 앱은 capacitor.config.ts 의 `appendUserAgent` 로 User-Agent 끝에 표식을 붙인다.
 * 그 문자열이 여기 NATIVE_APP_UA 와 같아야 한다 — 한쪽만 바꾸면 앱 사용자 전원이
 * 랜딩으로 튕겨 나간다.
 *
 * 서버(미들웨어·서버 컴포넌트)는 UA 로, 클라이언트는 Capacitor 런타임으로 판별한다.
 * 둘 다 두는 이유: 서버는 Capacitor 객체가 없고, 클라이언트는 UA 를 믿을 이유가 없다.
 */

/** capacitor.config.ts → android.appendUserAgent 와 반드시 같은 값 */
export const NATIVE_APP_UA = 'OneuldoApp'

/** 서버 쪽 판별. 미들웨어와 서버 컴포넌트에서 쓴다. */
export function isNativeAppUserAgent(userAgent: string | null | undefined): boolean {
  return typeof userAgent === 'string' && userAgent.includes(NATIVE_APP_UA)
}

/**
 * 클라이언트 쪽 판별. 'use client' 컴포넌트에서만 부른다.
 * 서버에서 부르면 window 가 없어 false 를 돌려준다(throw 하지 않는다).
 */
export function isNativeAppClient(): boolean {
  if (typeof window === 'undefined') return false
  // Capacitor 런타임이 window.Capacitor 를 심는다. 브라우저에는 없다.
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor
  return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform()
}

/** 플레이스토어 페이지. 아직 등록 전이라 열면 404 — 등록되면 그대로 살아난다. */
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=app.oneuldo.android'

/**
 * 초대 토큰을 실은 스토어 주소.
 * `referrer` 는 설치 뒤 앱이 Play Install Referrer API 로 읽어 초대를 복원한다
 * (Firebase Dynamic Links 는 종료됐다 — 이것이 안드로이드의 정식 대체 경로다).
 * 앱 쪽에서는 `invite=<token>` 모양을 그대로 기대한다. 형식을 바꾸면 그쪽도 함께.
 */
export function playStoreUrlForInvite(token: string): string {
  const referrer = encodeURIComponent(`invite=${token}`)
  return `${PLAY_STORE_URL}&referrer=${referrer}`
}
