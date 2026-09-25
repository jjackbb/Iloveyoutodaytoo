'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * 사서함 "들었다" 표시의 Server Action.
 *
 * 마음을 **재생했을 때** 화면이 이걸 부른다. "들었다"의 기준이 재생이기 때문이다
 * (사용자 결정 2026-08-19 — 목록에 뜬 것만으로는 안 친다).
 * 답장 잠금(PRD [MISSION-01])은 2026-09-26 새 DB에서 활성 기능에서 뺐다.
 *
 * 진짜 판단은 DB의 mark_heart_read()가 한다. 그 함수가
 *   - 내 것이 아니면 거절하고,
 *   - 이미 들은 것은 처음 들은 시각을 지키고,
 *   - 그 밖에는 read_at을 찍는다.
 * 여기서 같은 검사를 다시 하지 않는다 — 두 벌로 적으면 언젠가 서로 어긋난다.
 */
export async function markHeartRead(messageId: string): Promise<boolean> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('mark_heart_read', {
    p_id: messageId,
  })

  if (error) {
    console.error('[사서함] 들음 표시 실패:', error.message)
    return false
  }

  // 사서함을 다시 그려 "안 들은 마음" 표시를 지운다.
  if (data === true) revalidatePath('/mailbox')

  return data === true
}
