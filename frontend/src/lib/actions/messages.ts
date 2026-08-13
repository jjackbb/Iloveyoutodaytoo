'use server'

/**
 * 마음 메시지 저장 (Server Action).
 *
 * 이 파일이 하는 일은 딱 하나 — heart_messages에 한 줄 넣는 것이다.
 *
 * 하지 않는 일:
 * - 스트릭 갱신. DB 트리거가 KST 자정 기준으로 알아서 한다. 코드로 중복 구현하면 값이 어긋난다.
 * - 음성 파일 업로드. 업로드는 브라우저에서 한다(compose-form.tsx).
 *   시니어 사용자는 와이파이가 불안정한 경우가 많아서, 녹음 파일을 브라우저에 쥔 채
 *   재시도해야 사용자에게 "다시 녹음하세요"라고 말하지 않을 수 있다.
 *   여기서는 업로드가 끝난 뒤의 "경로"만 받는다.
 *
 * 주의: 'use server' 파일은 async 함수만 export할 수 있다.
 * 그래서 숫자 상수는 여기서 선언하지 않고 @/lib/limits 에서 가져다 쓴다.
 * (화면 쪽과 각자 자기 숫자를 들고 있으면 한쪽만 고쳐져 조용히 어긋난다)
 * 마지막 방어선은 DB의 CHECK 제약(duration_matches_type, text_length_limit)이다.
 */

import { revalidatePath } from 'next/cache'

import { getCurrentUser } from '@/lib/auth'
import { TEXT_MAX_LENGTH, VOICE_MAX_SEC, VOICE_MIN_SEC } from '@/lib/limits'
import { createClient } from '@/lib/supabase/server'
import { sanitizeLevels } from '@/lib/waveform'
import type { Enums } from '@/types/database'

export type SendHeartMessageInput = {
  roomId: string
  /** 받는 사람. 2인 방이면 상대방, 혼자 쓰는 방이면 자기 자신. */
  receiverId: string
  type: 'text' | 'voice'
  /** 텍스트면 본문, 음성이면 Storage 경로('{room_id}/파일명'). */
  content: string
  /** 음성 길이(초). 텍스트면 넣지 않는다. */
  durationSec?: number | null
  /**
   * 녹음할 때 잰 파형 막대 높이(0~1). 텍스트면 넣지 않는다.
   * 저장해 두면 사서함이 오디오 파일을 안 받고도 파형을 그린다.
   */
  voiceLevels?: number[] | null
  /** 화면에 보여준 질문. 없으면 null. */
  promptUsed?: string | null
  /**
   * 어떻게 보냈는지. 안 주면 'direct'(한 사람을 콕 집어 보냄).
   *
   * 이 함수는 여전히 **한 방·한 사람**만 다룬다. 여러 명에게 보내는 일은
   * 부르는 쪽(마음 보내기 화면)이 이 함수를 여러 번 부르는 것으로 한다.
   * 여기 남기는 값은 "그 한 줄이 어떤 선택에서 나왔는가"뿐이고,
   * 사서함 필터 칩(일대일·랜덤)이 그것을 읽는다.
   */
  sendMode?: Enums<'send_mode'>
}

export type SendHeartMessageResult =
  | { ok: true }
  | {
      ok: false
      /** 사용자에게 그대로 보여줄 한국어 문구. */
      error: string
      /**
       * 그냥 다시 시도하면 될 문제인지(네트워크·일시적 오류) 여부.
       * false면 사용자가 내용을 고쳐야 하는 문제라 자동 재시도해봐야 소용없다.
       */
      retryable: boolean
    }

function fail(error: string, retryable = false): SendHeartMessageResult {
  return { ok: false, error, retryable }
}

/**
 * 마음 메시지 한 줄 저장.
 *
 * 텍스트든 음성이든 이 함수 하나로 들어온다.
 * 성공하면 방 화면을 새로 그리도록 캐시를 비운다.
 */
export async function sendHeartMessage(
  input: SendHeartMessageInput,
): Promise<SendHeartMessageResult> {
  const user = await getCurrentUser()
  if (!user) {
    return fail('로그인이 풀렸어요. 다시 로그인한 뒤 보내주세요.')
  }

  const roomId = input.roomId?.trim()
  const receiverId = input.receiverId?.trim()

  if (!roomId || !receiverId) {
    return fail('보낼 곳을 찾지 못했어요. 방으로 돌아갔다가 다시 시도해주세요.')
  }

  const supabase = await createClient()

  // 내가 이 방의 구성원이 맞는지. RLS도 막아주지만,
  // 여기서 먼저 확인해야 사용자에게 빈 화면 대신 이유를 알려줄 수 있다.
  const { data: myMembership, error: myMembershipError } = await supabase
    .from('room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (myMembershipError) {
    return fail(
      '연결이 잠시 불안정했어요. 잠시 후 자동으로 다시 보낼게요.',
      true,
    )
  }
  if (!myMembership) {
    return fail('이 방에 마음을 남길 수 없어요. 방 목록에서 다시 열어주세요.')
  }

  // 받는 사람도 이 방 구성원이어야 한다. (자기 자신에게 보내는 방도 포함)
  const { data: receiverMembership, error: receiverMembershipError } =
    await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', receiverId)
      .eq('status', 'active')
      .maybeSingle()

  if (receiverMembershipError) {
    return fail(
      '연결이 잠시 불안정했어요. 잠시 후 자동으로 다시 보낼게요.',
      true,
    )
  }
  if (!receiverMembership) {
    return fail('받는 분을 찾지 못했어요. 방으로 돌아갔다가 다시 선택해주세요.')
  }

  // --- 종류별로 값이 제대로 왔는지 확인 ---
  let content: string
  let durationSec: number | null

  if (input.type === 'text') {
    content = (input.content ?? '').trim()

    if (!content) {
      return fail('한 글자라도 적어주세요. 짧아도 괜찮아요.')
    }
    if (content.length > TEXT_MAX_LENGTH) {
      return fail(`${TEXT_MAX_LENGTH}자 안으로 줄여주세요.`)
    }
    durationSec = null
  } else if (input.type === 'voice') {
    content = (input.content ?? '').trim()

    // Storage RLS가 경로의 첫 조각을 room_id로 읽어 방 구성원인지 확인한다.
    // 경로가 어긋나면 나중에 아무도 못 듣게 되므로 저장 전에 막는다.
    if (!content.startsWith(`${roomId}/`) || content.length <= roomId.length + 1) {
      return fail('녹음 파일을 저장하지 못했어요. 다시 한 번 녹음해주세요.')
    }

    const raw = input.durationSec
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return fail('녹음 길이를 확인하지 못했어요. 다시 한 번 녹음해주세요.')
    }

    durationSec = Math.round(raw)
    if (durationSec < VOICE_MIN_SEC) {
      return fail(`${VOICE_MIN_SEC}초 이상 녹음해주세요.`)
    }
    if (durationSec > VOICE_MAX_SEC) {
      return fail(`녹음은 ${VOICE_MAX_SEC}초까지 보낼 수 있어요.`)
    }
  } else {
    return fail('보낼 수 없는 형식이에요. 글이나 음성으로 남겨주세요.')
  }

  const promptUsed = input.promptUsed?.trim() || null

  // 모르는 값이 오면 조용히 'direct'로 본다. DB CHECK도 같은 세 값만 받는다.
  const sendMode: Enums<'send_mode'> =
    input.sendMode === 'broadcast' || input.sendMode === 'random'
      ? input.sendMode
      : 'direct'

  const { error: insertError } = await supabase.from('heart_messages').insert({
    room_id: roomId,
    sender_id: user.id, // RLS가 auth.uid()와 같은지 확인한다. 반드시 명시.
    receiver_id: receiverId,
    type: input.type,
    content,
    duration_sec: durationSec,
    // 텍스트에 파형이 남으면 DB CHECK가 막는다. 음성일 때만 넣는다.
    voice_levels: input.type === 'voice' ? sanitizeLevels(input.voiceLevels) : null,
    prompt_used: promptUsed,
    send_mode: sendMode,
    // memory_id는 비워 둔다 — 사진/영상에 붙는 메시지는 다른 화면에서 다룬다.
  })

  if (insertError) {
    // 23514 = CHECK 제약 위반. 값이 잘못된 것이라 다시 보내도 똑같이 막힌다.
    if (insertError.code === '23514') {
      return fail('내용을 다시 한 번 확인해주세요.')
    }
    return fail(
      '연결이 잠시 불안정했어요. 잠시 후 자동으로 다시 보낼게요.',
      true,
    )
  }

  // 스트릭은 트리거가 이미 갱신했다. 화면만 새로 그리면 된다.
  revalidatePath(`/rooms/${roomId}`)
  revalidatePath('/')
  // 사서함 첫 페이지는 서버가 그린다. 여기를 비우지 않으면 방금 보낸 마음이
  // "보낸 마음"에 안 보이고, 사용자는 보내기가 실패한 줄 안다.
  revalidatePath('/mailbox')

  return { ok: true }
}
