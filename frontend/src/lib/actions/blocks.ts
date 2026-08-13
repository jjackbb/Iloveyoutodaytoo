'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * 사용자 차단 / 차단 해제 / 차단 목록.
 *
 * 여기서 하지 않는 일:
 * - 차단한 사람의 메시지를 걸러내기 → RLS(heart_messages_select)가 이미 한다.
 *   `not has_blocked(sender_id)` 조건이 정책 안에 들어 있어서, 차단하는 순간
 *   그 사람이 보낸 마음은 사서함·방 화면 조회 결과에서 아예 빠진다. 코드로 또 거르지 않는다.
 * - 차단한 사람의 초대 막기 → accept_invitation 함수 안에 들어 있다.
 * - blocker_id 채우기 → 아래에서 서버가 직접 넣는다. 브라우저가 보낸 값은 쓰지 않는다.
 *
 * 그리고 무엇보다: **아무것도 지우지 않는다.**
 * 차단은 blocks 테이블에 한 줄 넣는 것뿐이고, 주고받은 마음은 그대로 남는다.
 * 차단을 풀면 다시 보인다(04_PROJECT_SPEC.md "데이터를 물리 삭제하지 마라").
 */

/** 차단하기 버튼의 결과. null이면 아직 아무것도 누르지 않은 상태. */
export type BlockState =
  { ok: true; blockedName: string } | { ok: false; error: string } | null

/** 차단 목록 한 줄. */
export type BlockedPerson = {
  /** blocks.id — 해제 확인 화면을 여는 데 쓴다. */
  blockId: string
  /** 차단당한 사람의 users.id */
  userId: string
  /**
   * 이름. null이면 이름을 읽을 수 없는 경우다.
   *
   * users 테이블은 "나 자신이거나, 지금 함께 있는 방이 있는 사람"만 조회된다(RLS).
   * 차단한 뒤 그 방을 나갔거나 상대가 나갔거나 탈퇴했으면 이름이 안 보인다.
   * 그래도 차단은 그대로 살아 있으므로 목록에서 빼지 않고, 화면에서 담담하게 안내한다.
   */
  name: string | null
  /** 차단한 시각(UTC ISO). 화면에서 KST로 바꿔 보여준다. */
  createdAt: string
}

export type BlockedListResult = {
  items: BlockedPerson[]
  /** 사용자에게 그대로 보여줄 안내 문구. 문제없으면 null */
  error: string | null
}

/** PostgreSQL unique_violation. 이미 차단한 사람을 또 차단했을 때 나온다. */
const UNIQUE_VIOLATION = '23505'

/** PostgreSQL check_violation. no_self_block 제약(자기 자신 차단)에 걸렸을 때 나온다. */
const CHECK_VIOLATION = '23514'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 사람 차단하기.
 *
 * 같은 방에 함께 있는 분만 차단할 수 있게 서버에서 한 번 확인한다.
 * RLS는 "blocker_id가 나인가"만 보기 때문에, 이 검사가 없으면 주소창에서
 * 아무 id나 넣어 남의 계정 id를 떠보는 데 쓸 수 있다.
 */
export async function blockUser(
  _prev: BlockState,
  formData: FormData,
): Promise<BlockState> {
  const targetId = String(formData.get('target_id') ?? '').trim()
  // 화면에 되돌려줄 이름. 없으면 담담한 기본값을 쓴다.
  const targetName = String(formData.get('target_name') ?? '').trim() || '이분'

  if (!UUID_PATTERN.test(targetId)) {
    return {
      ok: false,
      error: '누구를 차단할지 알 수 없어요. 화면을 새로고침해 주세요.',
    }
  }

  const user = await requireUser()

  // DB에도 no_self_block 제약이 있지만, 여기서 막아야 친절한 문구로 안내할 수 있다.
  if (targetId === user.id) {
    return { ok: false, error: '자기 자신은 차단할 수 없어요.' }
  }

  const supabase = await createClient()

  const { data: sharesRoom, error: sharesError } = await supabase.rpc(
    'shares_room_with',
    { p_user_id: targetId },
  )

  if (sharesError) {
    console.error('[차단] shares_room_with 확인 실패:', sharesError.message)
    return {
      ok: false,
      error: '지금은 차단할 수 없어요. 잠시 후 다시 눌러주세요.',
    }
  }

  if (!sharesRoom) {
    return {
      ok: false,
      error:
        '지금 함께 있는 방에서 찾을 수 없는 분이에요. 화면을 새로고침해 주세요.',
    }
  }

  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: user.id, blocked_id: targetId })

  if (error) {
    // 이미 차단한 사람이면 사용자 입장에서는 원하던 상태가 맞다. 오류로 놀래키지 않는다.
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: true, blockedName: targetName }
    }
    if (error.code === CHECK_VIOLATION) {
      return { ok: false, error: '자기 자신은 차단할 수 없어요.' }
    }

    console.error('[차단] blocks insert 실패:', error.message)
    return { ok: false, error: '차단하지 못했어요. 잠시 후 다시 눌러주세요.' }
  }

  // 사서함·방 화면에서 이분의 마음이 곧바로 빠지도록 전체를 다시 그리게 한다.
  revalidatePath('/', 'layout')

  return { ok: true, blockedName: targetName }
}

/**
 * 차단 풀기.
 *
 * 차단 목록 화면(/my/blocks)에서 자바스크립트 없이도 눌러지도록
 * 평범한 <form action={unblockUser}> 형태로 쓴다. 결과는 주소의 ?result= 로 알린다.
 * (시니어 사용자는 통신이 불안정한 환경이 많다. 폼이 그냥 동작하는 편이 안전하다)
 */
export async function unblockUser(formData: FormData): Promise<void> {
  const targetId = String(formData.get('blocked_id') ?? '').trim()

  if (!UUID_PATTERN.test(targetId)) {
    redirect('/my/blocks?result=failed')
  }

  const user = await requireUser()
  const supabase = await createClient()

  // residue-scan-allow: physical-delete — 지우는 것은 "차단하고 있다"는 관계 자체다.
  // PRD가 막는 물리 삭제는 메시지·사서함 기록이고, 여기엔 그런 내용이 없다.
  // 차단 해제는 그 관계를 남겨둘 이유가 없어 행을 지우는 게 맞다.
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', targetId)

  if (error) {
    console.error('[차단 해제] blocks delete 실패:', error.message)
    redirect('/my/blocks?result=failed')
  }

  // 차단이 풀리면 그분의 마음이 사서함에 다시 보여야 한다.
  revalidatePath('/', 'layout')
  redirect('/my/blocks?result=unblocked')
}

/**
 * 내가 차단한 사람 목록. 최근에 차단한 사람이 위로 온다.
 *
 * blocks에는 RLS(blocker_id = auth.uid())가 걸려 있어 내 것만 돌아오지만,
 * 조건을 눈에 보이게 한 번 더 적어둔다.
 */
export async function loadBlockedUsers(): Promise<BlockedListResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('blocks')
    // 한 줄로 둔다 — 문자열을 이어 붙이면 타입 추론이 풀린다(room 화면과 같은 이유).
    .select(
      'id, blocked_id, created_at, blocked:users!blocks_blocked_id_fkey(id, name)',
    )
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[차단 목록] blocks select 실패:', error.message)
    return {
      items: [],
      error: '차단 목록을 불러오지 못했어요. 잠시 후 다시 열어주세요.',
    }
  }

  const items: BlockedPerson[] = (data ?? []).map((row) => ({
    blockId: row.id,
    userId: row.blocked_id,
    name: row.blocked?.name ?? null,
    createdAt: row.created_at,
  }))

  return { items, error: null }
}
