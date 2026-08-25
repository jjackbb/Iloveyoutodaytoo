'use server'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * 마이 화면 "알림 받기" 스위치의 Server Action 둘.
 *
 * 켜기(subscribeToPush) 저장 / 끄기(unsubscribeFromPush) 삭제. 둘 다
 * push_subscriptions RLS(본인 것만)가 실제 방어선이라, 여기서 userId를
 * 다시 검사하지 않는다 — requireUser()로 로그인만 확인하고 값은 내가 채운다.
 */

export type PushSubscriptionInput = {
  endpoint: string
  p256dh: string
  auth: string
}

export type PushActionResult = { ok: true } | { ok: false; error: string }

/**
 * 구독 저장(켜기).
 *
 * 같은 브라우저에서 다시 켜면 endpoint가 똑같이 돌아온다 — upsert라 새 행이
 * 늘어나지 않는다. 브라우저가 구독을 자체적으로 갱신해 endpoint가 바뀌는 경우에도
 * 이전 값은 자연히 못 쓰게 되지만, 지금은 그 경로(pushsubscriptionchange)까지는
 * 다루지 않는다 — 브라우저 재방문 시 다시 구독하면 된다.
 */
export async function subscribeToPush(
  input: PushSubscriptionInput,
): Promise<PushActionResult> {
  const user = await requireUser()

  const endpoint = input.endpoint?.trim()
  const p256dh = input.p256dh?.trim()
  const auth = input.auth?.trim()

  if (!endpoint || !p256dh || !auth) {
    return { ok: false, error: '알림 정보를 받지 못했어요. 다시 시도해주세요.' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth },
      { onConflict: 'endpoint' },
    )

  if (error) {
    console.error('[알림] 구독 저장 실패:', error.message)
    return { ok: false, error: '알림을 켜지 못했어요. 잠시 후 다시 시도해주세요.' }
  }

  return { ok: true }
}

/**
 * 구독 지우기(끄기). RLS가 본인 것만 지우게 한다.
 *
 * residue-scan-allow: physical-delete — 남의 기록이 아니라 이 브라우저 자신의
 * 구독 정보다. 알림함(notifications)처럼 상대에게 남겨야 할 기록이 없다.
 */
export async function unsubscribeFromPush(endpoint: string): Promise<void> {
  await requireUser()
  if (!endpoint) return

  const supabase = await createClient()

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)

  if (error) {
    console.error('[알림] 구독 삭제 실패:', error.message)
  }
}
