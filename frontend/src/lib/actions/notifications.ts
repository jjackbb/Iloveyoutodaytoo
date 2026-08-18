'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * 알림함의 Server Action 두 개 (캡처 05).
 *
 *   markNotificationsRead   모달을 열었을 때 안 읽음 배지를 내린다
 *   deleteNotifications     [전체 선택]으로 고른 것들을 지운다
 *
 * 둘 다 대상 id를 받지만 어느 것도 "남의 알림"에 닿지 않는다 —
 * RLS(notifications_update)가 recipient_id = auth.uid() 인 행만 바꾸게 한다.
 * 그래서 여기서 id를 한 번 더 검사하지 않는다. 서버 코드가 아니라 DB가 막는 편이
 * 경로가 늘어나도 안 새기 때문이다.
 */

/** 지우기는 소프트 삭제다. 이 저장소는 탈퇴 말고 물리 삭제를 하지 않는다. */
export async function deleteNotifications(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
    .is('deleted_at', null)

  if (error) {
    console.error('[알림] 지우기 실패:', error.message)
    return
  }

  revalidatePath('/', 'layout')
}

/**
 * 안 읽은 것을 모두 읽음으로.
 *
 * 캡처에 알림별 읽음 표시가 따로 없어서, 모달을 연 순간을 "봤다"로 본다.
 * 하나씩 눌러 읽게 만들면 배지가 안 내려가 계속 빨간 점이 남는다.
 */
export async function markNotificationsRead(): Promise<void> {
  await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('deleted_at', null)
    .is('read_at', null)

  if (error) {
    console.error('[알림] 읽음 표시 실패:', error.message)
    return
  }

  revalidatePath('/', 'layout')
}
