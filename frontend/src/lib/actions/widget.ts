'use server'

import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * 홈 화면 위젯 토큰 (WIDGET-01).
 *
 * 위젯은 웹뷰 밖(네이티브)에서 살아 로그인 세션을 못 본다. 그래서 위젯만을 위한
 * 긴 난수 토큰을 따로 발급해 기기 저장소에 둔다. 토큰이 할 수 있는 것은 딱 둘 —
 * 최근 표현 1건 읽기, 톡톡 보내기(DB 함수 widget_latest · widget_knock).
 *
 * 수명은 로그아웃·탈퇴까지(사용자 결정). 탈퇴는 FK cascade 가, 로그아웃은 signOut 이 회수한다.
 * 평문은 발급 순간 한 번만 돌아온다 — DB 는 해시만 둔다.
 */

/** 발급. 로그인돼 있지 않으면 null. 기기가 여럿이면 토큰도 여럿(하나로 묶지 않는다). */
export async function issueWidgetToken(): Promise<{ token: string | null }> {
  const user = await getCurrentUser()
  if (!user) return { token: null }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('issue_widget_token')
  if (error || !data) {
    console.error('[위젯] 토큰 발급 실패:', error?.message ?? '빈 응답')
    return { token: null }
  }
  return { token: data }
}

/**
 * "지금 로그인돼 있는가"만 답한다.
 * 기기 저장소의 토큰을 지울지 말지를 클라이언트가 정할 때 쓴다 —
 * 로그아웃 뒤에도 토큰이 남아 있으면 위젯이 남의 것을 보여줄 수 있다.
 */
export async function widgetSessionAlive(): Promise<boolean> {
  return (await getCurrentUser()) !== null
}
