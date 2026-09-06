import { NextResponse } from 'next/server'

import { NO_STORE, anonClient, bearerToken, isUuid } from '@/lib/widget-api'

/**
 * POST /api/widget/knock — 위젯의 [톡톡] 단추 (WIDGET-01).
 *
 * 본문 { targetUserId, memoryId? } · 헤더 Authorization: Bearer <위젯 토큰>.
 * "같은 방을 쓰고 차단 관계가 아닌 사람"인지는 DB 함수 widget_knock 이 본다.
 * 보내는 횟수 제한은 없다(사용자 결정 — 초대한 사람끼리라 스팸이 성립하지 않는다).
 * 받는 쪽 알림함이 도배되지 않게 안 읽은 톡톡은 새 줄 대신 시각만 당긴다(DB 쪽).
 *
 *   200 { ok: true }
 *   403 { ok: false }  — 방을 안 쓰거나 차단, 자기 자신
 *   401                — 토큰 없음/무효
 *
 * 아직 앱 밖 알림(FCM)은 없다. 톡톡은 notifications 행으로 남아 앱 안 종에 뜬다.
 * FCM 이 붙으면 여기서 발송을 더한다 — 교체가 아니라 추가다(PRD PUSH-01).
 */

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const token = bearerToken(request)
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
  }

  let body: { targetUserId?: unknown; memoryId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400, headers: NO_STORE })
  }

  if (!isUuid(body.targetUserId)) {
    return NextResponse.json({ ok: false, error: 'bad_target' }, { status: 400, headers: NO_STORE })
  }
  const memoryId = isUuid(body.memoryId) ? body.memoryId : undefined

  const { data, error } = await anonClient().rpc('widget_knock', {
    p_token: token,
    p_target: body.targetUserId,
    ...(memoryId ? { p_memory: memoryId } : {}),
  })

  if (error) {
    if (error.code === '28000') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
    }
    console.error('[위젯 API] knock 실패:', error.message)
    return NextResponse.json({ ok: false, error: 'failed' }, { status: 500, headers: NO_STORE })
  }

  if (!data) {
    return NextResponse.json({ ok: false }, { status: 403, headers: NO_STORE })
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
