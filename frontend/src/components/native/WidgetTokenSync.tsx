'use client'

/**
 * 위젯 토큰 동기화 — 로그인 상태를 위젯이 쓸 수 있는 토큰으로 바꿔 네이티브 저장소에 둔다.
 *
 * 위젯은 웹뷰 밖에서 살아 로그인 세션을 못 본다. 그래서 로그인하면 서버가 위젯 전용
 * 토큰을 발급하고(issue_widget_token), 여기서 @capacitor/preferences 로 저장한다.
 * 네이티브 위젯은 SharedPreferences "CapacitorStorage" 의 "widget_token" 을 읽는다.
 * 로그아웃하면 지운다.
 *
 * (서버 담당이 채운다 — 지금은 빈 다리)
 */
export function WidgetTokenSync() {
  return null
}
