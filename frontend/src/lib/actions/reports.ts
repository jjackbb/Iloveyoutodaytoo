'use server'

/**
 * 부적절한 콘텐츠·이용자 신고 접수 (Server Action).
 * 근거: 이용약관 제9조 3항 "이용자는 부적절한 콘텐츠나 이용자를 회사에 신고할 수 있으며,
 * 회사는 확인 후 필요한 조치를 취합니다."
 *
 * 여기서 하는 일:
 *   reports 테이블에 한 줄 넣는 것. 그게 전부다.
 *
 * 여기서 하지 않는 일:
 * - 차단. 신고와 차단은 다른 동작이다. 신고는 운영자에게 알리는 것이고,
 *   차단은 내 화면에서 상대를 지금 당장 안 보이게 하는 것이다. 한 번에 묶으면
 *   "신고했더니 관계가 끊겼다"는 뜻밖의 결과가 생긴다. 화면에서 따로 안내만 한다.
 * - 대상 콘텐츠 삭제·숨김. 검토는 사람이 한다. 신고만으로 남의 글이 사라지면
 *   신고가 상대를 지우는 도구가 된다.
 * - status 조작. 기본값 'pending' 그대로 둔다. 상태는 운영자가 바꾸는 값이다.
 *
 * reporter_id는 폼에서 받지 않고 반드시 서버에서 로그인한 사람으로 못 박는다.
 * (RLS reports_insert도 reporter_id = auth.uid()를 요구하지만, 여기서 먼저 막아야
 *  사용자에게 빈 오류 대신 이유를 말해줄 수 있다)
 *
 * 주의: 'use server' 파일은 async 함수만 export할 수 있다.
 * 그래서 사유 목록은 @/components/report/reasons 에서,
 * 글자 수 상한은 @/lib/limits(길이 제한의 단일 출처)에서 가져다 쓴다.
 */

import {
  isReportReason,
  isReportTargetType,
  isUuidLike,
  type ReportTargetType,
} from '@/components/report/reasons'
import { getCurrentUser } from '@/lib/auth'
import { REPORT_DETAIL_MAX_LENGTH } from '@/lib/limits'
import { createClient } from '@/lib/supabase/server'

export type ReportState =
  | {
      status: 'error'
      /** 사용자에게 그대로 보여줄 한국어 문구 */
      message: string
      /** 어느 입력칸 아래에 보여줄지. 없으면 폼 전체 오류로 본다. */
      field?: 'reason' | 'detail'
    }
  /** 같은 대상을 이미 신고한 경우. 오류가 아니라 "이미 접수돼 있다"는 안내다. */
  | { status: 'duplicate'; message: string }
  | { status: 'done' }
  | null

function fail(
  message: string,
  field?: 'reason' | 'detail',
): ReportState {
  return { status: 'error', message, field }
}

/**
 * 신고할 대상이 실제로 존재하고, 신고하는 사람이 볼 수 있는 것인지 확인한다.
 *
 * 왜 필요한가:
 * target_id는 주소창에서 오는 값이라 아무 uuid나 적어 넣을 수 있다. 확인 없이 받으면
 * 존재하지도 않는 대상에 대한 신고가 쌓여 검토할 사람의 시간을 통째로 낭비시킨다.
 *
 * 조회는 RLS를 그대로 탄다 — 내가 볼 수 없는 남의 방 메시지는 여기서 걸러진다.
 * 반환값의 ownerId는 "그 글을 쓴 사람"이다. 내 글을 내가 신고하는 걸 막는 데 쓴다.
 */
async function findTargetOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetType: ReportTargetType,
  targetId: string,
): Promise<{ found: boolean; ownerId: string | null }> {
  if (targetType === 'user') {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('id', targetId)
      .maybeSingle()

    return { found: Boolean(data), ownerId: data?.id ?? null }
  }

  if (targetType === 'heart_message') {
    const { data } = await supabase
      .from('heart_messages')
      .select('id, sender_id')
      .eq('id', targetId)
      .maybeSingle()

    return { found: Boolean(data), ownerId: data?.sender_id ?? null }
  }

  const { data } = await supabase
    .from('memories')
    .select('id, author_id')
    .eq('id', targetId)
    .maybeSingle()

  return { found: Boolean(data), ownerId: data?.author_id ?? null }
}

/**
 * 신고 접수.
 *
 * useActionState와 함께 쓴다. 화면에서 이미 한 번 걸러낸 값이라도 여기서 전부 다시 본다 —
 * Server Action은 폼 밖에서도 불릴 수 있어서 화면의 검사를 믿으면 안 된다.
 */
export async function submitReport(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const user = await getCurrentUser()
  if (!user) {
    return fail('로그인이 풀렸어요. 다시 로그인한 뒤 신고해주세요.')
  }

  const targetType = String(formData.get('targetType') ?? '')
  const targetId = String(formData.get('targetId') ?? '').trim()
  const reason = String(formData.get('reason') ?? '')
  const detail = String(formData.get('detail') ?? '').trim()

  if (!isReportTargetType(targetType) || !isUuidLike(targetId)) {
    return fail('신고할 대상을 찾지 못했어요. 앞 화면으로 돌아갔다가 다시 눌러주세요.')
  }

  if (!isReportReason(reason)) {
    return fail('어떤 점이 문제였는지 하나만 골라주세요.', 'reason')
  }

  if (detail.length > REPORT_DETAIL_MAX_LENGTH) {
    return fail(
      `자세한 내용은 ${REPORT_DETAIL_MAX_LENGTH}자 안으로 적어주세요.`,
      'detail',
    )
  }

  const supabase = await createClient()

  // 본인 것은 신고 대상이 아니다. 대상이 나 자신인 경우도 마찬가지.
  const { found, ownerId } = await findTargetOwner(supabase, targetType, targetId)

  if (!found) {
    return fail(
      '신고할 내용을 찾지 못했어요. 이미 지워졌거나, 지금은 볼 수 없는 내용일 수 있어요.',
    )
  }
  if (ownerId && ownerId === user.id) {
    return fail('내가 남긴 내용은 신고 대상이 아니에요.')
  }

  // 같은 대상을 두 번 신고하지 못하게 막는다.
  // DB에 unique 제약이 없어서(스키마는 임의로 바꾸지 않는다) 여기서 먼저 조회한다.
  // RLS(reports_select)가 내 신고만 보여주므로, 남이 신고했는지는 알 수 없다 — 그게 맞다.
  const { data: existing, error: existingError } = await supabase
    .from('reports')
    .select('id')
    .eq('reporter_id', user.id)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .limit(1)

  if (existingError) {
    return fail('연결이 잠시 불안정했어요. 잠시 후 다시 시도해주세요.')
  }

  if (existing && existing.length > 0) {
    return {
      status: 'duplicate',
      message: '이미 신고하셨어요. 같은 내용을 다시 접수하지 않아도 괜찮아요.',
    }
  }

  const { error: insertError } = await supabase.from('reports').insert({
    // RLS가 auth.uid()와 같은지 확인한다. 폼 값이 아니라 서버에서 확인한 사람으로 넣는다.
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason,
    detail: detail || null,
    // status는 넣지 않는다. DB 기본값 'pending'이 그대로 들어간다.
  })

  if (insertError) {
    // 사용자에게는 부드럽게 안내하되, 원인은 서버 로그에 남긴다. 조용히 삼키면 고칠 수가 없다.
    console.error('[신고] reports insert 실패:', insertError.message)
    return fail('신고를 접수하지 못했어요. 잠시 후 다시 시도해주세요.')
  }

  return { status: 'done' }
}
