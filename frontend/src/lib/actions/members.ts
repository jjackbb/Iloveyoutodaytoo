'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth'
import { ROOM_NICKNAME_MAX_LENGTH } from '@/lib/limits'
import { createClient } from '@/lib/supabase/server'

/**
 * 관계방 구성원 — "이 방 나가기"와 "이 방에서 쓸 별명".
 *
 * 가장 중요한 규칙: **한 줄도 지우지 않는다.**
 * room_members.status를 'left'로 바꾸고 left_at에 지금 시각을 적는 게 전부다.
 * 행을 지우면 그 방에서 오간 마음이 어디에 속했는지 알 수 없게 되고,
 * 무엇보다 상대의 사서함에 남아 있어야 할 기록이 흔들린다(04_PROJECT_SPEC.md).
 *
 * DB에 `left_at_matches_status` CHECK 제약이 있다 —
 * status='left'면 left_at이 반드시 있어야 하고, 'active'면 반드시 비어 있어야 한다.
 * 그래서 두 값을 항상 함께 바꾼다.
 *
 * 나중에 다시 초대받으면 accept_invitation이 같은 행을
 * status='active', left_at=null로 되살린다. 그래서 "돌아올 수 있다"는 안내는 사실이다.
 * 단 초대 링크는 1회용이라(invitations.used_at) 새 링크를 받아야 한다.
 *
 * 행을 남겨두는 것에는 이유가 하나 더 생겼다:
 * withdraw_account는 "나 외의 room_members 행이 하나도 없는 방"만 지운다(status를 보지 않는다).
 * 나갔던 분의 행이 남아 있으면 그 방은 내가 탈퇴해도 살아남고,
 * 그분 사서함의 마음도 함께 지켜진다.
 */

export type LeaveRoomState = { error: string } | null

export type RoomNicknameState = { error: string } | null

/**
 * 이 방에서 쓸 내 별명 정하기 (더보기 서랍의 "별명 설정").
 *
 * **이 방의 내 멤버십에 저장한다**(`room_members.nickname`). 그래서
 * 마이 탭에서 전역 이름(`users.name`)을 바꿔도 이 방에서는 별명이 그대로 보이고,
 * 같은 방의 다른 분들에게도 이 이름으로 보인다 — 내 화면에만 걸리는 개인 설정이 아니다.
 * (원래 그런 뜻이다. "내가 이 방에서 불리는 이름"이지 "내가 남을 부르는 이름"이 아니다)
 *
 * 초대할 때 쓰는 `relationship_label`을 재사용하지 않았다. 그건 **초대한 분이 적은 호칭**이라
 * 주인도 뜻도 다르고, 겹쳐 쓰면 별명을 저장하는 순간 그 호칭이 덮여 사라진다.
 *
 * 비우고 저장하면 null이 되어 전역 이름으로 돌아간다 — 지우는 길도 같은 문으로 낸다.
 */
export async function setRoomNickname(
  _prev: RoomNicknameState,
  formData: FormData,
): Promise<RoomNicknameState> {
  const roomId = String(formData.get('room_id') ?? '').trim()
  const nickname = String(formData.get('nickname') ?? '').trim()

  if (!roomId) {
    return { error: '어느 방인지 알 수 없어요. 화면을 새로고침해 주세요.' }
  }
  if (nickname.length > ROOM_NICKNAME_MAX_LENGTH) {
    return { error: `별명은 ${ROOM_NICKNAME_MAX_LENGTH}자까지 쓸 수 있어요.` }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('room_members')
    // 빈 값은 빈 문자열이 아니라 null로 둔다 — "안 정했다"와 "빈 이름"은 다르다.
    .update({ nickname: nickname || null })
    .eq('room_id', roomId)
    // 내 별명만 고친다. RLS도 막지만(user_id = auth.uid()), 조건을 빼면 의도가 흐려진다.
    .eq('user_id', user.id)
    .eq('status', 'active')
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[별명] 저장 실패:', error.message)
    return { error: '별명을 저장하지 못했어요. 잠시 후 다시 눌러주세요.' }
  }
  if (!data) {
    // 이미 나온 방이거나 애초에 구성원이 아닌 방.
    return { error: '이 방의 구성원이 아니어서 별명을 정할 수 없어요.' }
  }

  // 이름은 이 방의 여러 화면(피드·갤러리·좋아요·숨김·설정)에 흩어져 있다. 한 번에 비운다.
  revalidatePath(`/rooms/${roomId}`, 'layout')
  // 홈 카드의 멤버 아바타에도 같은 이름이 쓰인다.
  revalidatePath('/')

  // 저장하고 나면 피드로 돌려보낸다 — 바뀐 이름이 실제로 어떻게 보이는지 그 자리에서 확인된다.
  redirect(`/rooms/${roomId}`)
}

/**
 * 이 방 나가기.
 *
 * 방장(role='admin')이 나갈 때:
 *   남는 사람이 있으면 방장 역할과 방 주인(rooms.owner_id)을
 *   가장 오래 있던 분에게 넘긴 뒤에 나간다. 이유는 두 가지다.
 *   1) 방장이 없으면 방 이름을 고치거나 초대장을 정리할 사람이 사라진다.
 *      rooms_update RLS가 is_room_admin(id)라, 방장이 비면 아무도 방을 손볼 수 없다.
 *   2) rooms.owner_id의 외래키는 ON DELETE SET NULL이다(예전의 CASCADE가 아니다).
 *      그래서 주인이 나중에 탈퇴해도 방과 사서함 기록은 사라지지 않는다.
 *      다만 주인 자리가 비어버리므로(owner_id = null), 나갈 때 미리 넘겨두면
 *      주인 없는 방이 생기지 않는다.
 *      탈퇴 시점에도 withdraw_account가 남은 활성 구성원에게 한 번 더 승계하지만,
 *      그때 활성 구성원이 아무도 없으면 넘길 곳이 없다. 여기서 넘기는 편이 안전하다.
 *   순서가 중요하다 — 내가 아직 'active' 방장일 때만 RLS가 이 수정을 허락한다.
 *   그래서 넘기는 일을 먼저 하고, 내 status를 마지막에 바꾼다.
 *
 * 남는 사람이 아무도 없으면 아무것도 넘기지 않는다. 그냥 조용히 나간다.
 */
export async function leaveRoom(
  _prev: LeaveRoomState,
  formData: FormData,
): Promise<LeaveRoomState> {
  const roomId = String(formData.get('room_id') ?? '').trim()

  if (!roomId) {
    return { error: '어느 방인지 알 수 없어요. 화면을 새로고침해 주세요.' }
  }

  const user = await requireUser()
  const supabase = await createClient()

  const { data: me, error: meError } = await supabase
    .from('room_members')
    .select('id, role')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (meError) {
    console.error('[방 나가기] 내 구성원 정보 조회 실패:', meError.message)
    return { error: '지금은 나갈 수 없어요. 잠시 후 다시 눌러주세요.' }
  }

  if (!me) {
    // 이미 나왔거나 애초에 구성원이 아닌 방. 오류로 남기지 않고 홈으로 보낸다.
    redirect('/')
  }

  // 나 말고 아직 이 방에 있는 사람들. 오래 있던 순서로 받는다.
  const { data: others, error: othersError } = await supabase
    .from('room_members')
    .select('id, user_id, role, joined_at')
    .eq('room_id', roomId)
    .eq('status', 'active')
    .neq('user_id', user.id)
    .order('joined_at', { ascending: true })

  if (othersError) {
    console.error('[방 나가기] 남은 구성원 조회 실패:', othersError.message)
    return { error: '지금은 나갈 수 없어요. 잠시 후 다시 눌러주세요.' }
  }

  const remaining = others ?? []

  // 이미 방장인 분이 남아 있으면 그분에게, 아무도 없으면 가장 오래 있던 분에게 넘긴다.
  const successor = remaining.find((member) => member.role === 'admin') ?? remaining[0] ?? null

  // 방장 역할을 넘기고 나가는 경우인지. 나중에 다시 초대받아 돌아왔을 때
  // 넘겨준 방장 자리가 슬그머니 되살아나지 않도록, 나갈 때 내 role도 함께 내려놓는다.
  // (accept_invitation은 status와 left_at만 되돌리고 role은 그대로 둔다)
  const handingOverAdmin = me.role === 'admin' && successor !== null

  if (successor) {
    // (1) 방장 역할 넘기기 — 내가 방장이고, 남는 방장이 아직 없을 때만.
    if (me.role === 'admin' && successor.role !== 'admin') {
      const { error: promoteError } = await supabase
        .from('room_members')
        .update({ role: 'admin' })
        .eq('id', successor.id)

      if (promoteError) {
        // 방장 없는 방이 되면 나중에 아무도 방을 관리할 수 없다. 여기서 멈추는 게 낫다.
        console.error('[방 나가기] 방장 넘기기 실패:', promoteError.message)
        return {
          error: '방장 역할을 넘기지 못해서 나가기를 멈췄어요. 잠시 후 다시 눌러주세요.',
        }
      }
    }

    // (2) 방 주인 넘기기 — 내가 주인일 때만. 실패해도 나가기 자체는 막지 않는다.
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('owner_id')
      .eq('id', roomId)
      .maybeSingle()

    if (roomError) {
      console.error('[방 나가기] 방 주인 조회 실패:', roomError.message)
    } else if (room?.owner_id === user.id) {
      const { error: handoverError } = await supabase
        .from('rooms')
        .update({ owner_id: successor.user_id })
        .eq('id', roomId)

      if (handoverError) {
        console.error('[방 나가기] 방 주인 넘기기 실패:', handoverError.message)
      }
    }
  }

  // (3) 마지막으로 내 상태만 바꾼다. 지우지 않는다.
  //     left_at을 함께 넣어야 한다 — DB의 left_at_matches_status 제약이 요구한다.
  const { error: leaveError } = await supabase
    .from('room_members')
    .update({
      status: 'left',
      left_at: new Date().toISOString(),
      ...(handingOverAdmin ? { role: 'member' as const } : {}),
    })
    .eq('id', me.id)
    .eq('user_id', user.id)

  if (leaveError) {
    console.error('[방 나가기] status 변경 실패:', leaveError.message)
    return { error: '나가지 못했어요. 잠시 후 다시 눌러주세요.' }
  }

  // 홈의 관계방 목록에서 이 방이 바로 빠지도록 캐시를 비운다.
  revalidatePath('/', 'layout')

  redirect('/')
}
