'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * 이미 만들어 둔 초대장을 되돌리는 일만 담당한다.
 *
 * 초대장 "만들기"는 invitations.ts에 있다. 여기서는 건드리지 않는다.
 *
 * 왜 필요한가:
 * 초대 링크는 문자·카카오톡으로 밖에 나가는데, 잘못된 사람에게 보냈을 때
 * 되돌릴 방법이 있어야 한다. 링크는 한 번만 쓸 수 있지만(accept_invitation이
 * 입장에 성공하면 used_at·used_by를 채우고, 그 뒤로 열면
 * "이미 사용된 초대입니다"로 막는다), 아직 아무도 쓰지 않은 링크는
 * 기간(30일) 안에는 그 링크를 받은 누구나 열어서 들어올 수 있다.
 * 그래서 "행을 지우는 것"이 곧 "아직 안 쓴 링크를 무효로 만드는 것"이다.
 *
 * 이미 쓰인 초대장은 취소할 일이 없다 — 이미 아무도 못 쓴다.
 * 그래서 목록에서는 "이미 사용됨"으로 상태만 알려주고 취소는 막는다(canCancel=false).
 * 취소를 열어두면 "취소했으니 그 사람이 못 들어오겠지" 하는 오해를 만든다.
 * 이미 들어온 분은 방 구성원이라 초대장을 지워도 그대로 남는다.
 *
 * 여기서 하지 않는 일:
 * - 권한 확인을 코드로 다시 하지 않는다. RLS가 이미 한다.
 *   · invitations_select: inviter_id = auth.uid() OR is_room_member(room_id)
 *   · invitations_delete: inviter_id = auth.uid() OR is_room_admin(room_id)
 *   즉 방 구성원은 그 방의 초대장을 "볼" 수 있지만, "지우는" 건
 *   자기가 만든 것이거나 자기가 방장일 때만 된다.
 *   화면에서 취소 버튼을 감추는 건 어디까지나 안내용이고, 진짜 방어선은 RLS다.
 */

/** 한 화면에 보여줄 초대장 수. 이보다 많으면 시니어 화면에서 읽기 어렵다. */
const LIST_LIMIT = 20

/** 목록 한 줄에 필요한 값 한 묶음. 토큰·링크는 일부러 담지 않는다. */
export type ManagedInvitation = {
  id: string
  /** 초대할 사람의 호칭. 예: "엄마" */
  relationshipLabel: string
  /** 초대장에 담긴 첫 마디. 어떤 초대장인지 알아보는 데 쓴다. */
  inviteMessage: string
  /** UTC ISO. 화면에서 KST로 바꿔 보여준다. */
  createdAt: string
  /** 만료 시각(UTC ISO). null이면 기간 제한이 없다. */
  expiresAt: string | null
  /** 이미 기간이 지났는지. 지난 링크는 열어도 들어올 수 없다. */
  expired: boolean
  /**
   * 이미 누군가 이 링크로 들어왔는지(1회용).
   * true면 그 뒤로는 아무도 이 링크를 쓸 수 없다.
   * 이미 그 방 구성원인 사람이 링크를 다시 여는 경우만 예외로 통과한다.
   */
  used: boolean
  /** 들어온 시각(UTC ISO). used가 true일 때만 값이 있다. 화면에서 KST로 바꿔 보여준다. */
  usedAt: string | null
  /**
   * 이 링크로 들어온 분의 이름. 모르면 null.
   * 그분이 방을 나갔거나 탈퇴하면 RLS(users_select)에 걸려 이름을 못 읽는다.
   * 그럴 땐 이름 없이 "누군가 들어왔어요"로만 알린다.
   */
  usedByName: string | null
  /** 내가 만든 초대장인지 */
  mine: boolean
  /**
   * 내가 이 초대장을 취소할 수 있는지.
   * (내가 만들었거나 내가 방장) 이면서 **아직 아무도 쓰지 않은** 초대장일 때만 true.
   */
  canCancel: boolean
  /** 남이 만든 초대장일 때 그 사람 이름. 모르면 null */
  inviterName: string | null
}

export type CancelInviteState =
  | { ok: true; id: string; label: string }
  | { ok: false; id: string | null; error: string }
  | null

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  const time = Date.parse(expiresAt)
  return Number.isNaN(time) ? false : time < Date.now()
}

/**
 * 이 방에 만들어져 있는 초대장 목록.
 * 아직 안 쓴 것이 먼저 오고, 그 안에서는 최근에 만든 것부터. (아래 정렬 설명 참고)
 *
 * 이미 쓰인 것(used)과 기간이 지난 것(expired)도 함께 돌려준다. 화면에서 상태를
 * 글자로 구분해 보여주려는 것이다. 목록이 비면 빈 배열을 준다 — 화면은 아무것도 안 그린다.
 *
 * 정렬을 두 단계로 하는 이유:
 * 아직 안 쓴 초대장(used_at is null)을 항상 위에 둔다. 지금 손댈 수 있는 건 그것뿐인데,
 * 만든 순서로만 줄 세우면 쓰인 초대장이 쌓여 20건 제한을 밀어내고
 * 정작 살아 있는 링크가 목록에서 사라진다.
 */
export async function loadRoomInvitations(
  roomId: string,
): Promise<ManagedInvitation[]> {
  if (!roomId) return []

  const user = await requireUser()
  const supabase = await createClient()

  // 방장인지 먼저 확인한다. 방장이면 남이 만든 초대장도 취소할 수 있다.
  const [{ data: membership }, { data, error }] = await Promise.all([
    supabase
      .from('room_members')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('invitations')
      // 한 줄로 둔다 — 문자열을 이어 붙이면 타입 추론이 풀린다.
      .select(
        'id, inviter_id, relationship_label, invite_message, expires_at, created_at, used_at, used_by, inviter:users!invitations_inviter_id_fkey(id, name)',
      )
      .eq('room_id', roomId)
      // 아직 안 쓴 것(null)이 먼저, 그다음 최근에 쓰인 것 순서.
      .order('used_at', { ascending: false, nullsFirst: true })
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT),
  ])

  if (error) {
    // 목록을 못 불러와도 초대장 만들기는 그대로 쓸 수 있어야 한다.
    // 화면에는 아무것도 안 보이지만 원인은 로그에 남긴다.
    console.error('[초대장 목록] invitations select 실패:', error.message)
    return []
  }

  const isAdmin = membership?.role === 'admin'
  const rows = data ?? []

  /**
   * 이 링크로 들어온 분들의 이름.
   *
   * users 테이블을 따로 한 번 더 읽는다. invitations에 used_by → users 외래키가
   * 있긴 하지만(invitations_used_by_fkey) src/types/database.ts의 Relationships에는
   * 그 관계가 빠져 있어, 조인 문법으로 붙이면 타입이 풀린다. 그 파일은 수정 금지라
   * 조인 대신 id 목록으로 한 번 더 물어본다(방 하나당 최대 20건이라 부담이 없다).
   *
   * RLS(users_select = 나 자신이거나 나와 같은 방에 '활성'으로 있는 사람)에 걸려
   * 이름이 안 나올 수 있다 — 들어왔다가 방을 나간 분, 탈퇴한 분이 그렇다.
   * 안 나오면 이름 없이 "누군가 들어왔어요"로 처리한다(화면 쪽에서).
   */
  const usedByIds = [
    ...new Set(
      rows.map((row) => row.used_by).filter((id): id is string => !!id),
    ),
  ]

  const usedByNames = new Map<string, string>()
  if (usedByIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .in('id', usedByIds)

    if (usersError) {
      // 이름을 못 읽어도 목록 자체는 보여준다. "누군가 들어왔어요"로 내려간다.
      console.error(
        '[초대장 목록] 들어온 분 이름 조회 실패:',
        usersError.message,
      )
    }

    for (const row of users ?? []) {
      if (row.name) usedByNames.set(row.id, row.name)
    }
  }

  return rows.map((row) => {
    const mine = row.inviter_id === user.id
    // Supabase 조인 결과는 관계에 따라 배열로 올 수 있어 양쪽 모두 받아준다.
    const inviter = Array.isArray(row.inviter) ? row.inviter[0] : row.inviter
    const used = row.used_at !== null

    return {
      id: row.id,
      relationshipLabel: row.relationship_label,
      inviteMessage: row.invite_message,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      expired: isExpired(row.expires_at),
      used,
      usedAt: row.used_at,
      usedByName: row.used_by ? (usedByNames.get(row.used_by) ?? null) : null,
      mine,
      // 이미 쓰인 링크는 취소할 게 없다. 취소를 열어두면 "취소했으니 안 들어오겠지"라는
      // 거짓 안심을 준다 — 그분은 이미 방에 들어와 있다.
      canCancel: (mine || isAdmin) && !used,
      inviterName: mine ? null : (inviter?.name ?? null),
    }
  })
}

/**
 * 초대장 취소 — invitations 행을 지운다.
 *
 * 여기서만 물리 삭제를 한다. 방 나가기·차단과 달리 초대장은 "아직 아무 일도
 * 일어나지 않은 링크"라서 지워도 사라지는 기록이 없다.
 * (이미 이 링크로 들어온 사람의 방 구성원 자격과 주고받은 마음은 그대로 남는다)
 *
 * 지우면 그 링크는 즉시 무효가 된다 — preview_invitation / accept_invitation이
 * 토큰으로 행을 찾지 못하기 때문이다.
 *
 * 화면은 아직 안 쓴 초대장에만 취소 버튼을 보여준다(canCancel). 다만 RLS는
 * used_at을 보지 않으므로 DB 차원에서는 이미 쓰인 초대장도 지워질 수 있다.
 * 그래도 잃는 건 "누가 언제 들어왔는지"라는 기록뿐이고, 그분의 방 구성원 자격과
 * 주고받은 마음은 그대로 남는다.
 */
export async function cancelInvitation(
  _prev: CancelInviteState,
  formData: FormData,
): Promise<CancelInviteState> {
  const invitationId = String(formData.get('invitation_id') ?? '').trim()
  const roomId = String(formData.get('room_id') ?? '').trim()
  const label = String(formData.get('relationship_label') ?? '').trim()

  if (!invitationId) {
    return {
      ok: false,
      id: null,
      error: '어떤 초대장인지 알 수 없어요. 화면을 새로고침해 주세요.',
    }
  }

  await requireUser()
  const supabase = await createClient()

  // select()를 붙여야 실제로 지워진 행을 돌려받는다.
  // 권한이 없으면 RLS가 조용히 0건을 지우므로, 그걸 성공으로 착각하면 안 된다.
  //
  // residue-scan-allow: physical-delete — 지우는 것은 아직 안 쓴 초대장이다.
  // 주고받은 마음이 아니라 "들어올 수 있는 문"이라, 취소하면 남길 이유가 없다.
  const { data, error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', invitationId)
    // room_id까지 받아 온다. 다시 그릴 화면 주소를 폼 값이 아니라 DB가 정하게 하려는 것.
    .select('id, room_id')

  if (error) {
    console.error('[초대장 취소] invitations delete 실패:', error.message)
    return {
      ok: false,
      id: invitationId,
      error: '초대장을 취소하지 못했어요. 잠시 후 다시 눌러주세요.',
    }
  }

  if (!data || data.length === 0) {
    // 이미 취소됐거나, 내가 만든 것도 아니고 방장도 아닌 경우.
    return {
      ok: false,
      id: invitationId,
      error:
        '이 초대장은 취소할 수 없어요. 이미 취소됐거나, 만드신 분이나 방을 만든 분만 취소할 수 있어요.',
    }
  }

  // 목록과 "가장 최근 초대장"이 함께 다시 계산되도록 이 화면을 새로 그린다.
  //
  // 주소는 실제로 지워진 행의 room_id로 만든다.
  // 폼에서 온 room_id는 브라우저가 보낸 값이라 손댈 수 있고, 그대로 이어 붙이면
  // 엉뚱한 경로가 revalidatePath에 들어간다. 지워진 행이 알려주는 값이 언제나 옳다.
  const revalidateRoomId = data[0]?.room_id ?? roomId
  if (revalidateRoomId) revalidatePath(`/rooms/${revalidateRoomId}/invite`)

  return { ok: true, id: invitationId, label }
}
