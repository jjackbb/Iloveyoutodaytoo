'use server'

/**
 * 게시물 댓글 (Server Action) — 캡처 24~36의 하단 댓글바와 음성 댓글 시트.
 *
 * 이 파일이 하는 일: `memory_comments` 한 줄을 넣는 것(텍스트 또는 음성)과 지우는 것.
 *
 * 하지 않는 일:
 * - 음성 파일 업로드. 브라우저가 Storage(voice 버킷)에 직접 올리고 **경로만** 여기로 온다.
 *   Server Action 본문 제한이 1MB이기도 하고, 연결이 끊겨도 브라우저가 파일을 쥔 채
 *   다시 시도할 수 있어야 한다(마음 표현하기와 같은 방식).
 * - 물리 삭제. 지우기는 `deleted_at`을 적는 소프트 삭제다. DB에 DELETE 정책 자체가 없다.
 *
 * 'use server' 파일은 async 함수만 export할 수 있어서 숫자 상수는 @/lib/limits에 둔다.
 */

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/auth'
import { TEXT_MAX_LENGTH, VOICE_MAX_SEC, VOICE_MIN_SEC } from '@/lib/limits'
import { createClient } from '@/lib/supabase/server'
import { sanitizeLevels } from '@/lib/waveform'

export type CommentActionResult = { ok: true } | { ok: false; error: string }

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * 댓글을 달 게시물이 지금도 있는지, 어느 방의 것인지.
 *
 * RLS가 이미 남의 방 글을 감추므로 한 줄도 못 읽었다는 것은 "없거나 볼 수 없는 글"이라는 뜻이다.
 * 방 번호는 **클라이언트가 준 값을 쓰지 않고** 여기서 읽는다 — 엉뚱한 화면을 지우지 않기 위해서다.
 */
async function loadMemoryForComment(
  supabase: Supabase,
  memoryId: string,
): Promise<{ id: string; roomId: string } | null> {
  const { data } = await supabase
    .from('memories')
    .select('id, room_id')
    .eq('id', memoryId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!data) return null
  return { id: data.id, roomId: data.room_id }
}

/**
 * 이 게시물의 상세 화면과 방의 화면들을 서버가 다시 읽게 한다.
 *
 * 'layout'을 주는 이유는 memories.ts의 revalidateRoom과 같다 — 같은 게시물을 보여주는
 * 화면이 방 아래에 여럿이고(피드·갤러리·좋아요·숨김·상세), 댓글 수는 그 모두에 걸쳐 있다.
 * 방 아래를 한 번에 비우면 상세 화면도 함께 다시 읽힌다.
 */
function revalidateRoom(roomId: string) {
  revalidatePath(`/rooms/${roomId}`, 'layout')
  revalidatePath('/')
}

/**
 * 텍스트 댓글 남기기 (캡처 34~36).
 *
 * 빈 값은 조용히 무시한다 — 원본 프로토타입도 그랬고, 아무것도 안 쓴 채 전송을 누른 것은
 * 실수이지 오류가 아니다. 화면에 빨간 글씨를 띄울 일이 아니다.
 */
export async function createTextComment(
  memoryId: string,
  body: string,
): Promise<CommentActionResult> {
  const user = await requireUser()

  const trimmed = (body ?? '').trim()
  if (!trimmed) return { ok: true }
  if (trimmed.length > TEXT_MAX_LENGTH) {
    return { ok: false, error: `댓글은 ${TEXT_MAX_LENGTH}자 안으로 줄여주세요.` }
  }

  const supabase = await createClient()
  const memory = await loadMemoryForComment(supabase, memoryId)
  if (!memory) {
    return { ok: false, error: '게시물을 찾지 못했어요. 화면을 새로고침해 주세요.' }
  }

  const { error } = await supabase.from('memory_comments').insert({
    memory_id: memoryId,
    // RLS가 auth.uid()와 같은지 확인한다. 반드시 명시.
    author_id: user.id,
    body: trimmed,
  })

  if (error) {
    console.error('[댓글] 저장 실패:', error.message)
    return { ok: false, error: '잠시 후 다시 시도해 주세요.' }
  }

  revalidateRoom(memory.roomId)
  return { ok: true }
}

export type CreateVoiceCommentInput = {
  memoryId: string
  /** voice 버킷에 이미 올라간 경로. `{room_id}/…` 이어야 한다. */
  voicePath: string
  voiceDurationSec: number
  /** 녹음하면서 잰 파형 막대 높이(0~1). 없으면 재생할 때 파일을 해석한다. */
  voiceLevels?: number[] | null
}

/**
 * 음성 댓글 남기기 (캡처 26~33).
 *
 * 길이 규칙은 게시물의 목소리와 같다(3~60초). 화면에서도 3초 미만이면 등록 버튼이
 * 켜지지 않지만, 서버가 마지막으로 한 번 더 본다. DB CHECK도 같은 값을 지킨다.
 */
export async function createVoiceComment(
  input: CreateVoiceCommentInput,
): Promise<CommentActionResult> {
  const user = await requireUser()

  const supabase = await createClient()
  const memory = await loadMemoryForComment(supabase, input.memoryId)
  if (!memory) {
    return { ok: false, error: '게시물을 찾지 못했어요. 화면을 새로고침해 주세요.' }
  }

  /*
    경로가 이 방의 것인지. Storage RLS가 경로 첫 조각을 room_id로 읽어 멤버인지 확인하므로,
    어긋난 경로를 저장하면 나중에 아무도 그 소리를 못 듣게 된다(memories.ts와 같은 규칙).
  */
  const voicePath = input.voicePath?.trim() ?? ''
  if (
    !voicePath.startsWith(`${memory.roomId}/`) ||
    voicePath.length <= memory.roomId.length + 1 ||
    voicePath.split('/').includes('..')
  ) {
    return {
      ok: false,
      error: '녹음을 저장하지 못했어요. 다시 한 번 녹음해 주세요.',
    }
  }

  const rawDuration = input.voiceDurationSec
  if (typeof rawDuration !== 'number' || !Number.isFinite(rawDuration)) {
    return {
      ok: false,
      error: '녹음 길이를 확인하지 못했어요. 다시 한 번 녹음해 주세요.',
    }
  }
  const voiceDurationSec = Math.round(rawDuration)
  if (voiceDurationSec < VOICE_MIN_SEC) {
    return { ok: false, error: `음성 녹음은 ${VOICE_MIN_SEC}초 이상이어야 해요.` }
  }
  if (voiceDurationSec > VOICE_MAX_SEC) {
    return { ok: false, error: `녹음은 ${VOICE_MAX_SEC}초까지 담을 수 있어요.` }
  }

  const { error } = await supabase.from('memory_comments').insert({
    memory_id: input.memoryId,
    author_id: user.id,
    voice_path: voicePath,
    voice_duration_sec: voiceDurationSec,
    voice_levels: sanitizeLevels(input.voiceLevels),
  })

  if (error) {
    console.error('[음성 댓글] 저장 실패:', error.message)
    return { ok: false, error: '잠시 후 다시 시도해 주세요.' }
  }

  revalidateRoom(memory.roomId)
  return { ok: true }
}

/**
 * 댓글 지우기 — **소프트 삭제**.
 *
 * 행을 지우지 않고 `deleted_at`에 시각을 적는다. 물리 삭제 금지 원칙을 게시물과 똑같이
 * 댓글에도 적용한다(_workspace/02_detail_port.md의 deleteMemory와 같은 판단).
 * 모든 조회가 `deleted_at is null`을 걸기 때문에 화면에서는 사라진다.
 *
 * 내 댓글만 지울 수 있다 — RLS(`memory_comments_update`)가 작성자만 통과시키고,
 * 여기서 한 번 더 본다(사용자에게 이유를 알려주기 위해서).
 */
export async function deleteComment(
  commentId: string,
): Promise<CommentActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: comment, error: readError } = await supabase
    .from('memory_comments')
    .select('id, author_id, memory_id')
    .eq('id', commentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (readError) {
    console.error('[댓글 삭제] 조회 실패:', readError.message)
    return { ok: false, error: '잠시 후 다시 시도해 주세요.' }
  }
  if (!comment) {
    return { ok: false, error: '댓글을 찾지 못했어요. 화면을 새로고침해 주세요.' }
  }
  if (comment.author_id !== user.id) {
    return { ok: false, error: '내가 남긴 댓글만 지울 수 있어요.' }
  }

  const { error } = await supabase
    .from('memory_comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId)

  if (error) {
    console.error('[댓글 삭제] 실패:', error.message)
    return { ok: false, error: '잠시 후 다시 시도해 주세요.' }
  }

  // 어느 방을 다시 읽을지는 게시물이 알고 있다. 조인 한 줄로 붙여올 수도 있지만,
  // 그러면 결과가 배열인지 객체인지가 관계 설정에 달려 조용히 어긋난다.
  const memory = await loadMemoryForComment(supabase, comment.memory_id)
  if (memory) revalidateRoom(memory.roomId)
  return { ok: true }
}

/**
 * 텍스트 댓글 고치기 (노션 IA 3.9).
 *
 * **음성 댓글은 고칠 수 없다.** 목소리를 "고친다"는 것은 결국 다시 녹음해 파일을
 * 갈아끼우는 일이라, 지우고 새로 남기는 것과 다르지 않다. 그런데 그 편이 훨씬
 * 정직하다 — 남은 흔적(지움 → 새 댓글)이 실제로 일어난 일과 같기 때문이다.
 * 그래서 ⋯ 메뉴도 텍스트 댓글에만 [수정]을 보여준다.
 *
 * 고친 사실은 `edited_at`에 남긴다. 가족이 주고받는 말이 아무 흔적 없이 다른 말로
 * 바뀌면 안 된다.
 */
export async function updateTextComment(
  commentId: string,
  body: string,
): Promise<CommentActionResult> {
  const user = await requireUser()

  const trimmed = (body ?? '').trim()
  // 빈 값으로 고치는 것은 삭제와 다르다. 지우려면 [삭제]를 쓰게 한다.
  if (!trimmed) {
    return { ok: false, error: '내용을 적어주세요. 지우려면 [삭제]를 눌러주세요.' }
  }
  if (trimmed.length > TEXT_MAX_LENGTH) {
    return { ok: false, error: `댓글은 ${TEXT_MAX_LENGTH}자 안으로 줄여주세요.` }
  }

  const supabase = await createClient()

  const { data: comment, error: readError } = await supabase
    .from('memory_comments')
    .select('id, author_id, memory_id, body')
    .eq('id', commentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (readError) {
    console.error('[댓글 수정] 조회 실패:', readError.message)
    return { ok: false, error: '잠시 후 다시 시도해 주세요.' }
  }
  if (!comment) {
    return { ok: false, error: '댓글을 찾지 못했어요. 화면을 새로고침해 주세요.' }
  }
  if (comment.author_id !== user.id) {
    return { ok: false, error: '내가 남긴 댓글만 고칠 수 있어요.' }
  }
  // 음성 댓글은 body가 비어 있다. 위 안내대로 고치는 길을 막는다.
  if (comment.body === null) {
    return { ok: false, error: '음성 댓글은 고칠 수 없어요. 지우고 다시 남겨주세요.' }
  }

  // 글자가 그대로면 "수정됨"을 붙이지 않는다. 눌렀다 그냥 닫은 것까지 고친 것으로
  // 기록하면, 바뀐 적 없는 말에 흔적이 남는다.
  if (comment.body === trimmed) return { ok: true }

  const { error } = await supabase
    .from('memory_comments')
    .update({ body: trimmed, edited_at: new Date().toISOString() })
    .eq('id', commentId)

  if (error) {
    console.error('[댓글 수정] 실패:', error.message)
    return { ok: false, error: '잠시 후 다시 시도해 주세요.' }
  }

  const memory = await loadMemoryForComment(supabase, comment.memory_id)
  if (memory) revalidateRoom(memory.roomId)
  return { ok: true }
}
