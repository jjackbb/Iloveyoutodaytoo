'use server'

/**
 * 추억 게시물 저장·관리 (Server Action) — 캡처 12~23의 [♥ 표현하기], 피드 카드의 ♡ 와 ⋯.
 *
 * 사진은 **선택 사항**이다(2026-08-25 사용자 결정). 전에는 한 장 이상을 요구했는데,
 * 목소리가 중심인 앱에서 사진을 강제하면 "지금 찍을 사진이 없어서" 마음을 못 남기는
 * 일이 생긴다. DB에는 사진 필수 제약이 없고(memory_photos 는 별도 테이블),
 * 목록·상세도 사진 0장을 이미 처리한다(MemoryCard 의 photos.length === 0 갈래).
 *
 * 이 파일이 하는 일: memories 한 줄 + memory_photos 여러 줄을 넣는 것,
 * 그리고 피드 카드에서 누르는 것들(좋아요·고정·수정·숨기기·저장·삭제).
 *
 * 하지 않는 일:
 * - 파일 업로드. 사진도 음성도 브라우저가 Storage에 직접 올린다(compose-form.tsx).
 *   Server Action 본문 제한이 1MB라 사진 10장을 실어 보낼 수 없고,
 *   연결이 끊겨도 브라우저가 파일을 쥔 채 다시 시도할 수 있어야 하기 때문이다.
 *   여기서는 업로드가 끝난 뒤의 "경로"만 받는다.
 * - heart_messages는 건드리지 않는다. 그건 사서함(1:1 마음 보내기)의 것이다.
 *
 * 'use server' 파일은 async 함수만 export할 수 있어서 숫자 상수는 @/lib/limits에 둔다.
 */

import { revalidatePath } from 'next/cache'

import { RETRY_MESSAGE } from '@/lib/action-result'
import { getCurrentUser, requireUser } from '@/lib/auth'
import {
  CAPTION_MAX_LENGTH,
  PHOTO_MAX_COUNT,
  VIDEO_MAX_MS,
  VOICE_MAX_SEC,
  VOICE_MIN_SEC,
} from '@/lib/limits'
import { HANDWRITING_MAX_DURATION_MS } from '@/lib/handwriting'
import { MEMORY_PAPERS, MEMORY_PENS, MEMORY_REACTIONS, type MemoryHandwritingStyle, type MemoryReaction, type MemoryVideoRange } from '@/lib/memory-expression'
import { sendPush } from '@/lib/push'
import { createClient } from '@/lib/supabase/server'
import { sanitizeLevels } from '@/lib/waveform'

export type CreateMemoryInput = {
  roomId: string
  /** media 버킷에 올라간 사진 경로들. 순서가 곧 화면 순서이고 첫 장이 대표 사진이다. */
  photoPaths: string[]
  /**
   * voice 버킷에 올라간 음성 경로. **선택**이다 (2026-09-06 음성 필수 해제 — PRD §6⑯).
   * 목소리 · 손글씨 · 사진 중 하나 이상이면 된다.
   */
  voicePath: string | null
  /** 음성 길이(초). voicePath 가 없으면 null. */
  voiceDurationSec: number | null
  /** handwriting 버킷에 올라간 획 좌표 JSON 경로. 선택. */
  handwritingPath?: string | null
  /** 첫 획부터 마지막 점까지(ms). handwritingPath 가 없으면 null. */
  handwritingDurationMs?: number | null
  /** video 버킷에 올라간 영상 경로. 선택. 한 추억에 최대 한 개다. */
  videoPath?: string | null
  /** 영상 길이(ms). 브라우저가 실제 파일에서 읽은 값. videoPath 가 없으면 null. */
  videoDurationMs?: number | null
  /** E16: 한 추억의 손글씨 전체에 적용하는 필기구·편지지. */
  handwritingStyle?: MemoryHandwritingStyle
  /** E16: 원본 영상은 그대로 두고 재생 구간·대표 장면만 저장한다. */
  videoRange?: MemoryVideoRange | null
  /**
   * 녹음하면서 잰 파형 막대 높이(0~1). 없으면 재생바가 재생할 때 파일을 해석한다.
   * 저장해 두면 화면에 뜨자마자 파형을 그릴 수 있어 파일을 미리 받지 않아도 된다.
   */
  voiceLevels?: number[] | null
  /** 문구. 선택 사항이라 비어 있어도 된다. */
  caption?: string | null
}

export type CreateMemoryResult =
  | { ok: true }
  | {
      ok: false
      /** 사용자에게 그대로 보여줄 한국어 문구. */
      error: string
      /** 그냥 다시 시도하면 될 문제인지(네트워크·일시적 오류). */
      retryable: boolean
    }

function fail(error: string, retryable = false): CreateMemoryResult {
  return { ok: false, error, retryable }
}

function validatePresentation(
  style: MemoryHandwritingStyle | undefined,
  range: MemoryVideoRange | null | undefined,
  videoDurationMs: number | null,
):
  | { ok: true; pen: string; paper: string; startMs: number | null; endMs: number | null; posterMs: number | null }
  | { ok: false; error: string } {
  const pen = style?.pen ?? 'ink'
  const paper = style?.paper ?? 'hanji'
  if (!(pen in MEMORY_PENS) || !(paper in MEMORY_PAPERS)) {
    return { ok: false, error: '필기구나 편지지를 다시 골라주세요.' }
  }
  if (!range) return { ok: true, pen, paper, startMs: null, endMs: null, posterMs: null }
  const { startMs, endMs, posterMs } = range
  if (videoDurationMs === null || ![startMs, endMs, posterMs].every(Number.isInteger)
      || startMs < 0 || endMs - startMs < 1000 || endMs > videoDurationMs
      || posterMs < startMs || posterMs > endMs) {
    return { ok: false, error: '영상 구간과 대표 장면을 다시 골라주세요.' }
  }
  return { ok: true, pen, paper, startMs, endMs, posterMs }
}

/**
 * 경로가 이 방의 것인지.
 *
 * Storage RLS가 경로의 첫 조각을 room_id로 읽어 방 멤버인지 확인한다.
 * 경로가 어긋나면 나중에 아무도 못 보게 되므로 저장 전에 막는다.
 * (사서함·방 화면의 서명 로직도 같은 규칙을 쓴다)
 */
function isOwnRoomPath(path: string, roomId: string): boolean {
  return (
    path.startsWith(`${roomId}/`) &&
    path.length > roomId.length + 1 &&
    !path.split('/').includes('..')
  )
}

/**
 * 추억 게시물 하나를 남긴다.
 *
 * 사진과 음성이 **둘 다** 있어야 한다 — 캡처 12의 안내문
 * "사진과 음성 녹음을 모두 담아야 표현할 수 있어요"가 이 규칙이다.
 * 화면에서도 버튼을 잠가 두지만, 서버가 마지막으로 한 번 더 본다.
 */
type VoiceCheck =
  | { ok: true; path: string | null; durationSec: number | null }
  | { ok: false; error: string }

/**
 * 음성 검사. 없으면(null) 그대로 통과 — 음성은 2026-09-06 부터 선택이다.
 * 있으면 경로가 이 방 것인지와 길이 메타데이터가 0~60초인지 검사한다.
 * 0초 표시는 1초 미만 녹음을 반올림한 값일 수 있다.
 */
function validateVoice(
  rawPath: string | null | undefined,
  rawDuration: number | null | undefined,
  roomId: string,
): VoiceCheck {
  const path = rawPath?.trim() ?? ''
  if (!path) return { ok: true, path: null, durationSec: null }

  if (!isOwnRoomPath(path, roomId)) {
    return { ok: false, error: '녹음 파일을 저장하지 못했어요. 다시 한 번 녹음해주세요.' }
  }
  if (typeof rawDuration !== 'number' || !Number.isFinite(rawDuration)) {
    return { ok: false, error: '녹음 길이를 확인하지 못했어요. 다시 한 번 녹음해주세요.' }
  }
  if (rawDuration < VOICE_MIN_SEC) {
    return { ok: false, error: '녹음 길이를 확인하지 못했어요. 다시 한 번 녹음해주세요.' }
  }
  const durationSec = Math.round(rawDuration)
  if (durationSec > VOICE_MAX_SEC) {
    return { ok: false, error: `녹음은 ${VOICE_MAX_SEC}초까지 담을 수 있어요.` }
  }
  return { ok: true, path, durationSec }
}

type HandwritingCheck =
  | { ok: true; path: string | null; durationMs: number | null }
  | { ok: false; error: string }

/**
 * 손글씨 검사 (WRITE-01). 파일 안(획 좌표)은 브라우저가 만든 것을 그대로 두고,
 * 서버는 경로가 이 방 것인지와 길이 범위(DB CHECK 와 같은 값)만 본다.
 */
function validateHandwriting(
  rawPath: string | null | undefined,
  rawDuration: number | null | undefined,
  roomId: string,
): HandwritingCheck {
  const path = rawPath?.trim() ?? ''
  if (!path) return { ok: true, path: null, durationMs: null }

  if (!isOwnRoomPath(path, roomId) || !path.endsWith('.json')) {
    return { ok: false, error: '손글씨를 저장하지 못했어요. 다시 한 번 적어주세요.' }
  }
  if (typeof rawDuration !== 'number' || !Number.isFinite(rawDuration)) {
    return { ok: false, error: '손글씨를 저장하지 못했어요. 다시 한 번 적어주세요.' }
  }
  const durationMs = Math.round(rawDuration)
  if (durationMs < 0 || durationMs > HANDWRITING_MAX_DURATION_MS) {
    return { ok: false, error: '손글씨는 10분 안에 적어주세요.' }
  }
  return { ok: true, path, durationMs }
}

type VideoCheck =
  | { ok: true; path: string | null; durationMs: number | null }
  | { ok: false; error: string }

/**
 * 영상 검사 (2026-09-26 추억 영상). 최소 길이는 없고 최대 30초다.
 * 용량(50MB)은 브라우저가 올리기 전에 거르고, 버킷 상한이 한 번 더 막는다.
 */
function validateVideo(
  rawPath: string | null | undefined,
  rawDuration: number | null | undefined,
  roomId: string,
): VideoCheck {
  const path = rawPath?.trim() ?? ''
  if (!path) return { ok: true, path: null, durationMs: null }

  if (!isOwnRoomPath(path, roomId)) {
    return { ok: false, error: '영상을 저장하지 못했어요. 다시 한 번 담아주세요.' }
  }
  if (typeof rawDuration !== 'number' || !Number.isFinite(rawDuration) || rawDuration < 0) {
    return { ok: false, error: '영상 길이를 확인하지 못했어요. 다시 한 번 담아주세요.' }
  }
  const durationMs = Math.round(rawDuration)
  if (durationMs > VIDEO_MAX_MS) {
    return { ok: false, error: `영상은 ${VIDEO_MAX_MS / 1000}초까지 담을 수 있어요.` }
  }
  return { ok: true, path, durationMs }
}

/** 저장 RPC가 돌려준 오류를 사용자 문구로 바꾼다. */
function failFromDb(
  error: { code?: string; message: string },
  where: string,
): CreateMemoryResult {
  // 23514 = CHECK 제약 위반(길이·경로·올린 사람). 값이 잘못된 것이라 다시 보내도 똑같이 막힌다.
  if (error.code === '23514') {
    console.error(`[${where}] 제약 위반:`, error.message)
    return fail('담으신 내용을 다시 한 번 확인해주세요.')
  }
  if (error.code === '42501') {
    return fail('이 앨범방에 추억을 남길 수 없어요. 홈에서 방을 다시 열어주세요.')
  }
  console.error(`[${where}] 실패:`, error.code, error.message)
  return fail('연결이 잠시 불안정했어요. 잠시 후 다시 시도할게요.', true)
}

export async function createMemory(
  input: CreateMemoryInput,
): Promise<CreateMemoryResult> {
  const user = await getCurrentUser()
  if (!user) {
    return fail('로그인이 풀렸어요. 다시 로그인한 뒤 남겨주세요.')
  }

  const roomId = input.roomId?.trim()
  if (!roomId) {
    return fail('남길 곳을 찾지 못했어요. 앨범방으로 돌아갔다가 다시 해주세요.')
  }

  // --- 사진 ---
  const photoPaths = (input.photoPaths ?? []).map((path) => path.trim())

  if (photoPaths.length > PHOTO_MAX_COUNT) {
    return fail(`사진은 ${PHOTO_MAX_COUNT}장까지 담을 수 있어요.`)
  }
  if (new Set(photoPaths).size !== photoPaths.length) {
    return fail('사진을 저장하지 못했어요. 다시 한 번 담아주세요.')
  }
  if (photoPaths.some((path) => !isOwnRoomPath(path, roomId))) {
    return fail('사진을 저장하지 못했어요. 다시 한 번 담아주세요.')
  }

  // --- 음성 (선택 — 2026-09-06 음성 필수 해제) ---
  const voice = validateVoice(input.voicePath, input.voiceDurationSec, roomId)
  if (!voice.ok) return fail(voice.error)

  // --- 손글씨 (선택, WRITE-01) ---
  const handwriting = validateHandwriting(
    input.handwritingPath,
    input.handwritingDurationMs,
    roomId,
  )
  if (!handwriting.ok) return fail(handwriting.error)

  // --- 영상 (선택, 최대 1개) ---
  const video = validateVideo(input.videoPath, input.videoDurationMs, roomId)
  if (!video.ok) return fail(video.error)
  const presentation = validatePresentation(input.handwritingStyle, input.videoRange, video.durationMs)
  if (!presentation.ok) return fail(presentation.error)

  /*
    하나 이상. 문제 정의가 "쑥스러워서 표현을 못 하는 사람"인데 가장 쑥스러운 일
    (목소리 녹음)을 강제하고 있었다(PRD §6⑯). 무엇이든 하나면 마음이다.
    영상 하나만으로도 남길 수 있다(2026-09-26 사용자 결정).
  */
  if (!voice.path && !handwriting.path && !video.path && photoPaths.length === 0) {
    return fail('목소리 · 손글씨 · 사진 · 영상 중 하나는 담아주세요.')
  }

  // --- 문구 (선택) ---
  const caption = (input.caption ?? '').trim()
  if (caption.length > CAPTION_MAX_LENGTH) {
    return fail(`문구는 ${CAPTION_MAX_LENGTH}자 안으로 줄여주세요.`)
  }

  const supabase = await createClient()

  // 내가 이 방의 멤버가 맞는지. RLS도 막아주지만,
  // 여기서 먼저 확인해야 사용자에게 빈 화면 대신 이유를 알려줄 수 있다.
  const { data: myMembership, error: membershipError } = await supabase
    .from('room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (membershipError) {
    return fail('연결이 잠시 불안정했어요. 잠시 후 다시 시도할게요.', true)
  }
  if (!myMembership) {
    return fail(
      '이 앨범방에 추억을 남길 수 없어요. 홈에서 방을 다시 열어주세요.',
    )
  }

  /*
    추억 한 줄과 사진 줄을 DB 함수 하나로 한 번에 넣는다(create_memory).
    중간에 실패하면 둘 다 없던 일이 된다 — 예전처럼 "사진 없는 반쪽 카드"를 지우러 가다
    그것마저 실패하는 일이 없다. 공개 범위(작성자만 / 방 공유)는 DB 트리거가 저장 순간의
    활성 참여자 수로 정하고, 여기서는 보내지 않는다.
  */
  const { error: insertError } = await supabase.rpc('create_memory_enhanced', {
    p_room_id: roomId,
    p_caption: caption,
    p_photo_paths: photoPaths,
    p_voice_path: voice.path,
    p_voice_duration_sec: voice.durationSec,
    p_voice_levels: voice.path ? sanitizeLevels(input.voiceLevels) : null,
    p_handwriting_path: handwriting.path,
    p_handwriting_duration_ms: handwriting.durationMs,
    p_video_path: video.path,
    p_video_duration_ms: video.durationMs,
    p_handwriting_pen: presentation.pen,
    p_handwriting_paper: presentation.paper,
    p_video_trim_start_ms: presentation.startMs,
    p_video_trim_end_ms: presentation.endMs,
    p_video_poster_ms: presentation.posterMs,
  })

  if (insertError) return failFromDb(insertError, '추억 저장')

  // 방 피드와 홈의 "게시물 N개"를 서버가 다시 세도록 캐시를 비운다.
  revalidatePath(`/rooms/${roomId}`)
  revalidatePath('/')

  // 앱 밖 알림(웹푸시) — 이 방의 다른 구성원들에게 "OO님이 마음을 남겼어요".
  // 실패해도 게시물 작성 자체는 이미 끝났다. try/catch로 완전히 삼킨다 —
  // 알림이 안 갔다고 방금 남긴 추억이 사라지면 안 된다.
  try {
    const { data: otherMembers } = await supabase
      .from('room_members')
      .select('user_id')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .neq('user_id', user.id)

    if (otherMembers && otherMembers.length > 0) {
      const notifyBody = caption || '새 추억을 확인해보세요'
      await Promise.all(
        otherMembers.map((member) =>
          sendPush(member.user_id, {
            title: `${user.name}님이 마음을 남겼어요`,
            body: notifyBody,
            url: `/rooms/${roomId}`,
          }),
        ),
      )
    }
  } catch (err) {
    console.error('[웹푸시] 새 게시물 알림 실패:', err)
  }

  return { ok: true }
}

/* ============================================================
   피드 카드에서 누르는 것들 — ♡ 와 ⋯ 메뉴

   공통 규칙:
   - 방 번호는 **클라이언트가 준 값을 쓰지 않는다.** memories에서 직접 읽어
     그 방을 revalidate한다. 잘못된 방 번호를 받아 엉뚱한 화면을 지우지 않기 위해서다.
   - 화면은 이 액션이 끝난 뒤 서버가 다시 읽은 값을 본다. 클라이언트가 목록·상태를
     들고 있지 않다 — 그게 이 프로젝트가 프로토타입을 폐기한 이유다.
   - 막는 것은 결국 RLS다. 여기서 먼저 보는 것은 **사용자에게 이유를 알려주기 위해서**다.
   ============================================================ */

export type MemoryActionResult = { ok: true } | { ok: false; error: string }

/**
 * 게시물의 방·작성자를 확인한다.
 *
 * RLS(`is_room_member`)가 이미 남의 방 글을 감추므로, 여기서 한 줄도 못 읽었다는 것은
 * "없거나 볼 수 없는 글"이라는 뜻이다. 두 경우를 구분해 알려줄 방법도, 이유도 없다.
 */
async function loadMemoryForAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memoryId: string,
): Promise<{ id: string; roomId: string; authorId: string | null } | null> {
  const { data } = await supabase
    .from('memories')
    .select('id, room_id, author_id')
    .eq('id', memoryId)
    .maybeSingle()

  if (!data) return null
  return { id: data.id, roomId: data.room_id, authorId: data.author_id }
}

/**
 * 방의 화면들과 홈을 서버가 다시 읽게 한다.
 *
 * 'layout'을 주는 이유: 이 방에는 피드 말고도 같은 게시물을 보여주는 화면이 여럿이다
 * (갤러리·좋아요·숨김). 좋아요를 좋아요 목록에서 껐는데 그 목록이 그대로 남아 있으면
 * "눌렀는데 아무 일도 안 일어난" 것처럼 보인다. 방 아래 화면을 한 번에 비운다.
 */
function revalidateRoom(roomId: string) {
  revalidatePath(`/rooms/${roomId}`, 'layout')
  revalidatePath('/')
}

/**
 * 좋아요 켜고 끄기 (캡처 22 왼쪽 아래 ♡).
 *
 * 좋아요는 **사람마다 따로**다. `memory_likes`에 내 행이 있으면 켜진 것이라
 * 끄는 것은 내 행을 지우는 일이다. `liked` 같은 상태 컬럼을 두면
 * "누른 적 없음"과 "눌렀다 껐음"을 구분해야 하는데, 그 구분이 필요한 화면이 없다.
 *
 * residue-scan-allow: physical-delete — 지우는 것은 남의 기록이 아니라
 * **내가 방금 한 내 표시**다. 게시물도 남의 좋아요도 그대로 남는다.
 */
export async function toggleMemoryLike(
  memoryId: string,
): Promise<MemoryActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const memory = await loadMemoryForAction(supabase, memoryId)
  if (!memory) {
    console.error('[좋아요] 게시물을 못 읽었다:', memoryId)
    return { ok: false, error: RETRY_MESSAGE }
  }

  const { data: existing, error: readError } = await supabase
    .from('memory_likes')
    .select('id')
    .eq('memory_id', memoryId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (readError) {
    console.error('[좋아요] 내 좋아요를 못 읽었다:', readError.message)
    return { ok: false, error: RETRY_MESSAGE }
  }

  if (existing) {
    const { error } = await supabase
      .from('memory_likes')
      .delete()
      .eq('id', existing.id)
    if (error) {
      console.error('[좋아요] 취소 실패:', error.message)
      return { ok: false, error: RETRY_MESSAGE }
    }
  } else {
    const { error } = await supabase
      .from('memory_likes')
      .insert({ memory_id: memoryId, user_id: user.id })
    // 23505 = 두 번 빨리 눌러 같은 줄이 두 번 들어간 경우. 이미 켜져 있으니 성공과 같다.
    if (error && error.code !== '23505') {
      console.error('[좋아요] 저장 실패:', error.message)
      return { ok: false, error: RETRY_MESSAGE }
    }
  }

  revalidateRoom(memory.roomId)
  return { ok: true }
}

/** 하트는 기존 memory_likes, 다른 세 표현은 종류별로 한 사람 한 번씩 저장한다. */
export async function toggleMemoryReaction(memoryId: string, kind: MemoryReaction): Promise<MemoryActionResult> {
  if (!(kind in MEMORY_REACTIONS)) return { ok: false, error: '마음 표현을 다시 골라주세요.' }
  const user = await requireUser()
  const supabase = await createClient()
  const memory = await loadMemoryForAction(supabase, memoryId)
  if (!memory) return { ok: false, error: RETRY_MESSAGE }

  const { data: existing, error: readError } = await supabase.from('memory_reactions')
    .select('id').eq('memory_id', memoryId).eq('user_id', user.id).eq('kind', kind).maybeSingle()
  if (readError) return { ok: false, error: RETRY_MESSAGE }

  if (existing) {
    const { error } = await supabase.from('memory_reactions').delete().eq('id', existing.id)
    if (error) return { ok: false, error: RETRY_MESSAGE }
  } else {
    const { error } = await supabase.from('memory_reactions').insert({ memory_id: memoryId, user_id: user.id, kind })
    if (error && error.code !== '23505') return { ok: false, error: RETRY_MESSAGE }
  }
  revalidateRoom(memory.roomId)
  return { ok: true }
}

/**
 * 게시물 고정/해제 (⋯ 메뉴의 "고정").
 *
 * **방 멤버 누구나** 할 수 있다 — 작성자 전용으로 묶지 않았다.
 * 앨범방은 함께 쓰는 공간이고, 고정은 "이 글이 지금 우리에게 중요하다"는
 * 공용 큐레이션이다. 오늘 붙일 사진을 정하는 사람이 그 사진을 찍은 사람이라는 법은 없다.
 * (되돌리기 쉬운 동작이고, 방 안은 이미 서로를 믿는 사이라는 전제 위에 서 있다.)
 *
 * 한 방에 고정은 하나다. 새로 고정하면 이전 고정이 자동으로 풀린다 —
 * "맨 위 한 자리"가 여럿이면 고정한 의미가 없어지기 때문이다. 이 규칙은 앱이 아니라
 * DB(`pin_memory` 함수 + 부분 유니크 인덱스)가 지킨다.
 */
export async function setMemoryPin(
  memoryId: string,
  pinned: boolean,
): Promise<MemoryActionResult> {
  await requireUser()
  const supabase = await createClient()

  const memory = await loadMemoryForAction(supabase, memoryId)
  if (!memory) {
    return { ok: false, error: '게시물을 찾지 못했어요. 화면을 새로고침해 주세요.' }
  }

  const { error } = await supabase.rpc('pin_memory', {
    p_memory_id: memoryId,
    p_pinned: pinned,
  })

  if (error) {
    console.error('[고정] 실패:', error.message)
    return { ok: false, error: '잠시 후 다시 시도해 주세요.' }
  }

  revalidateRoom(memory.roomId)
  return { ok: true }
}

/**
 * 문구만 고치기 (⋯ 메뉴의 "수정").
 *
 * 사진·음성은 손대지 않는다. 다시 고르게 하려면 작성 화면을 통째로 다시 열어야 하는데,
 * 그건 "고치기"가 아니라 "다시 만들기"에 가깝다. 여기서는 오탈자를 고치는 정도만 연다.
 * 남의 글은 못 고친다 — RLS(`memories_update`)가 작성자만 통과시킨다.
 */
export async function updateMemoryCaption(
  memoryId: string,
  caption: string,
): Promise<MemoryActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const memory = await loadMemoryForAction(supabase, memoryId)
  if (!memory) {
    return { ok: false, error: '게시물을 찾지 못했어요. 화면을 새로고침해 주세요.' }
  }
  if (memory.authorId !== user.id) {
    return { ok: false, error: '내가 남긴 글만 고칠 수 있어요.' }
  }

  const trimmed = (caption ?? '').trim()
  if (trimmed.length > CAPTION_MAX_LENGTH) {
    return { ok: false, error: `문구는 ${CAPTION_MAX_LENGTH}자 안으로 줄여주세요.` }
  }

  const { error } = await supabase
    .from('memories')
    // 다 지우면 문구가 없는 글이 된다. 빈 문자열이 아니라 null로 둔다(작성 때와 같은 규칙).
    .update({ description: trimmed || null })
    .eq('id', memoryId)

  if (error) {
    console.error('[문구 수정] 실패:', error.message)
    return { ok: false, error: '잠시 후 다시 시도해 주세요.' }
  }

  revalidateRoom(memory.roomId)
  return { ok: true }
}

export type UpdateMemoryInput = {
  memoryId: string
  /** 화면에 놓인 순서 그대로의 사진 경로. 그대로 두는 사진과 새로 올린 사진이 섞여 있다. */
  photoPaths: string[]
  /** 선택. 규칙은 CreateMemoryInput 과 같다 — 목소리 · 손글씨 · 사진 중 하나 이상. */
  voicePath: string | null
  voiceDurationSec: number | null
  voiceLevels?: number[] | null
  handwritingPath?: string | null
  handwritingDurationMs?: number | null
  videoPath?: string | null
  videoDurationMs?: number | null
  handwritingStyle?: MemoryHandwritingStyle
  videoRange?: MemoryVideoRange | null
  caption?: string | null
}

/**
 * 추억 통째로 고치기 — 사진·목소리·문구 (노션 IA 3.8).
 *
 * 그전에는 문구만 고칠 수 있었다. 사진을 잘못 골랐거나 목소리를 다시 담고 싶으면
 * 지우고 처음부터 다시 올리는 수밖에 없었는데, 그러면 **거기 달린 댓글과 좋아요가
 * 함께 사라진다.** 소중한 존재가 남긴 말을 사진 한 장 바꾸자고 버리게 할 수는 없다.
 *
 * 검사 규칙은 새로 남길 때(createMemory)와 **글자 그대로 같다.** 여기만 느슨하면
 * 만들 땐 막힌 것이 고치기로 들어온다.
 *
 * 파일은 브라우저가 먼저 올리고 경로만 여기로 온다(createMemory와 같은 구조).
 * 쓰지 않게 된 옛 파일은 저장이 끝난 뒤 여기서 지운다 — 저장 전에 지우면
 * 중간에 실패했을 때 원래 사진까지 잃는다.
 */
export async function updateMemory(
  input: UpdateMemoryInput,
): Promise<CreateMemoryResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const memory = await loadMemoryForAction(supabase, input.memoryId)
  if (!memory) {
    return fail('게시물을 찾지 못했어요. 화면을 새로고침해 주세요.')
  }
  if (memory.authorId !== user.id) {
    return fail('내가 남긴 글만 고칠 수 있어요.')
  }

  const roomId = memory.roomId

  // --- 사진 --- (createMemory와 같은 규칙)
  const photoPaths = (input.photoPaths ?? []).map((path) => path.trim())
  if (photoPaths.length > PHOTO_MAX_COUNT) {
    return fail(`사진은 ${PHOTO_MAX_COUNT}장까지 담을 수 있어요.`)
  }
  if (new Set(photoPaths).size !== photoPaths.length) {
    return fail('사진을 저장하지 못했어요. 다시 한 번 담아주세요.')
  }
  if (photoPaths.some((path) => !isOwnRoomPath(path, roomId))) {
    return fail('사진을 저장하지 못했어요. 다시 한 번 담아주세요.')
  }

  // --- 음성 (선택 — 2026-09-06 음성 필수 해제) ---
  const voice = validateVoice(input.voicePath, input.voiceDurationSec, roomId)
  if (!voice.ok) return fail(voice.error)

  // --- 손글씨 (선택, WRITE-01) ---
  const handwriting = validateHandwriting(
    input.handwritingPath,
    input.handwritingDurationMs,
    roomId,
  )
  if (!handwriting.ok) return fail(handwriting.error)

  // --- 영상 (선택, 최대 1개) ---
  const video = validateVideo(input.videoPath, input.videoDurationMs, roomId)
  if (!video.ok) return fail(video.error)
  const presentation = validatePresentation(input.handwritingStyle, input.videoRange, video.durationMs)
  if (!presentation.ok) return fail(presentation.error)

  if (!voice.path && !handwriting.path && !video.path && photoPaths.length === 0) {
    return fail('목소리 · 손글씨 · 사진 · 영상 중 하나는 담아주세요.')
  }

  // --- 문구 (선택) ---
  const caption = (input.caption ?? '').trim()
  if (caption.length > CAPTION_MAX_LENGTH) {
    return fail(`문구는 ${CAPTION_MAX_LENGTH}자 안으로 줄여주세요.`)
  }

  /*
    고치기도 DB 함수 하나로 한 번에 한다(update_memory). 사진 줄을 비우고 다시 쓰는 동안
    실패하면 원래 사진이 그대로 남는다. 더 이상 가리키지 않는 옛 파일은 DB가 정리 목록
    (storage_deletion_jobs)에 올리고, 아래 settleStorageDeletions가 실제로 지운다.
  */
  const { error: updateError } = await supabase.rpc('update_memory_enhanced', {
    p_memory_id: memory.id,
    p_caption: caption,
    p_photo_paths: photoPaths,
    p_voice_path: voice.path,
    p_voice_duration_sec: voice.durationSec,
    p_voice_levels: voice.path ? sanitizeLevels(input.voiceLevels) : null,
    p_handwriting_path: handwriting.path,
    p_handwriting_duration_ms: handwriting.durationMs,
    p_video_path: video.path,
    p_video_duration_ms: video.durationMs,
    p_handwriting_pen: presentation.pen,
    p_handwriting_paper: presentation.paper,
    p_video_trim_start_ms: presentation.startMs,
    p_video_trim_end_ms: presentation.endMs,
    p_video_poster_ms: presentation.posterMs,
  })

  if (updateError) return failFromDb(updateError, '추억 고치기')

  /*
    옛 파일 정리. 실패해도 고치기는 이미 끝났다 — 옛 파일은 이제 어떤 기록에도 연결되지 않아
    올린 본인 외에는 읽을 수 없고, 정리 목록에 남아 다음 삭제·고치기 때 다시 지운다.
  */
  const left = await settleStorageDeletions(supabase)
  if (left > 0) console.error('[추억 고치기] 옛 파일 정리가 남음:', left)

  revalidateRoom(roomId)
  return { ok: true }
}

/**
 * 내 피드에서만 감추기 (⋯ 메뉴의 "숨기기").
 *
 * 게시물은 지워지지 않는다. **누른 사람의 화면에서만** 빠지고 다른 멤버에게는 그대로 보인다
 * (인스타그램 "관심 없음"과 같은 개념). 그래서 이 표시는 내 행 하나로 남는다.
 *
 * 되돌리는 길은 **숨김 화면(`/rooms/[roomId]/hidden`)**이다. 감춘 글은 피드에서 사라져
 * ⋯ 메뉴를 다시 열 수가 없으므로, 그 화면이 유일한 해제 경로다(`unhideMemory`).
 */
export async function hideMemory(memoryId: string): Promise<MemoryActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const memory = await loadMemoryForAction(supabase, memoryId)
  if (!memory) {
    return { ok: false, error: '게시물을 찾지 못했어요. 화면을 새로고침해 주세요.' }
  }

  const { error } = await supabase
    .from('memory_hides')
    .insert({ memory_id: memoryId, user_id: user.id })

  // 23505 = 이미 숨긴 글. 바라던 상태가 이미 됐으니 성공으로 본다.
  if (error && error.code !== '23505') {
    console.error('[숨기기] 실패:', error.message)
    return { ok: false, error: '잠시 후 다시 시도해 주세요.' }
  }

  revalidateRoom(memory.roomId)
  return { ok: true }
}

/**
 * 다시 보이게 하기 (숨김 화면의 "다시 보이게 하기").
 *
 * `hideMemory`의 반대. 내 `memory_hides` 행을 지우면 그 글이 내 피드로 돌아온다.
 * 숨김은 **누른 사람에게만** 걸린 표시라, 푸는 것도 그 사람 것 하나뿐이다.
 *
 * 소프트 삭제된 글은 `loadMemoryForAction`이 걸러 여기까지 오지 않는다.
 * (숨김 화면도 지운 글은 아예 보여주지 않는다 — 풀어봐야 어디에도 안 나온다)
 *
 * residue-scan-allow: physical-delete — 지우는 것은 남의 기록이 아니라
 * **내가 걸어둔 내 표시**다. 게시물도 남의 숨김도 그대로 남는다(좋아요·저장과 같다).
 */
export async function unhideMemory(
  memoryId: string,
): Promise<MemoryActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const memory = await loadMemoryForAction(supabase, memoryId)
  if (!memory) {
    return { ok: false, error: '게시물을 찾지 못했어요. 화면을 새로고침해 주세요.' }
  }

  const { error } = await supabase
    .from('memory_hides')
    .delete()
    .eq('memory_id', memoryId)
    // 내 표시만 지운다. RLS도 막지만, 조건을 빼면 의도 자체가 흐려진다.
    .eq('user_id', user.id)

  if (error) {
    console.error('[숨김 해제] 실패:', error.message)
    return { ok: false, error: '잠시 후 다시 시도해 주세요.' }
  }

  revalidateRoom(memory.roomId)
  return { ok: true }
}

/**
 * 개인 북마크 켜고 끄기 (⋯ 메뉴의 "저장").
 *
 * **저장한 글을 모아 보는 화면은 아직 없다.** 지금은 표시만 남고, 다시 열면
 * 메뉴가 "저장 취소"로 바뀌어 있는 것으로만 확인할 수 있다(기록: _workspace/02_detail_port.md).
 *
 * residue-scan-allow: physical-delete — 좋아요와 같다. 지우는 것은 내 북마크 표시뿐이고
 * 게시물은 그대로다.
 */
export async function toggleMemorySave(
  memoryId: string,
): Promise<MemoryActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const memory = await loadMemoryForAction(supabase, memoryId)
  if (!memory) {
    return { ok: false, error: '게시물을 찾지 못했어요. 화면을 새로고침해 주세요.' }
  }

  const { data: existing, error: readError } = await supabase
    .from('memory_saves')
    .select('id')
    .eq('memory_id', memoryId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (readError) {
    console.error('[저장] 내 저장을 못 읽었다:', readError.message)
    return { ok: false, error: '잠시 후 다시 시도해 주세요.' }
  }

  if (existing) {
    const { error } = await supabase
      .from('memory_saves')
      .delete()
      .eq('id', existing.id)
    if (error) {
      console.error('[저장] 취소 실패:', error.message)
      return { ok: false, error: '잠시 후 다시 시도해 주세요.' }
    }
  } else {
    const { error } = await supabase
      .from('memory_saves')
      .insert({ memory_id: memoryId, user_id: user.id })
    if (error && error.code !== '23505') {
      console.error('[저장] 실패:', error.message)
      return { ok: false, error: '잠시 후 다시 시도해 주세요.' }
    }
  }

  revalidateRoom(memory.roomId)
  return { ok: true }
}

/**
 * 정리 목록(storage_deletion_jobs)에 남은 내 파일을 Storage에서 지우고,
 * 실제로 사라졌는지 DB가 확인하게 한다. 돌려주는 값 = 아직 남은 파일 수.
 *
 * DB와 Storage는 한 트랜잭션으로 묶을 수 없다. 그래서 순서를 정했다:
 *   1) DB 행을 먼저 지운다 → 그 순간 모두의 읽기·서명이 막힌다(Storage 읽기 정책이 연결 기록을 본다).
 *   2) 지울 파일은 DB 안의 목록에 남긴다 → Storage 삭제가 실패해도 목록이 남아 다시 시도할 수 있다.
 *   3) finish_storage_deletions가 storage.objects에서 정말 사라진 것만 목록에서 뺀다.
 */
async function settleStorageDeletions(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<number> {
  const { data: pending, error: listError } = await supabase.rpc(
    'pending_storage_deletions',
  )
  if (listError) {
    console.error('[파일 정리] 목록을 못 읽었다:', listError.message)
    return Number.POSITIVE_INFINITY
  }

  const byBucket = new Map<string, string[]>()
  for (const row of pending ?? []) {
    const paths = byBucket.get(row.bucket_id) ?? []
    paths.push(row.object_name)
    byBucket.set(row.bucket_id, paths)
  }

  const failures: string[] = []
  for (const [bucket, paths] of byBucket) {
    try {
      const { error } = await supabase.storage.from(bucket).remove(paths)
      if (error) failures.push(`${bucket}: ${error.message}`)
    } catch (cause) {
      failures.push(
        `${bucket}: ${cause instanceof Error ? cause.message : String(cause)}`,
      )
    }
  }

  const { data: left, error: finishError } = await supabase.rpc(
    'finish_storage_deletions',
    { p_error: failures.length > 0 ? failures.join(' / ') : undefined },
  )
  if (finishError) {
    console.error('[파일 정리] 확인 실패:', finishError.message)
    return Number.POSITIVE_INFINITY
  }
  if (failures.length > 0) {
    console.error('[파일 정리] Storage 삭제 실패:', failures.join(' / '))
  }
  return left ?? 0
}

/** 파일 정리가 남았을 때 보여줄 문구. 성공이라고 말하지 않는다. */
const DELETE_FILES_PENDING =
  '추억은 지웠지만 사진·영상 같은 파일 정리를 마치지 못했어요. [삭제하기]를 한 번 더 눌러 주세요.'

/**
 * 게시물 삭제 (⋯ 메뉴의 "삭제") — **완전 삭제** (2026-09-26 사용자 결정).
 *
 * 추억 행과 거기 달린 사진 줄·댓글·반응·알림을 DB에서 지우고(delete_memory),
 * 연결된 사진·영상·목소리·손글씨·댓글 음성 파일을 Storage에서 지운다. 되돌릴 수 없다.
 * 작성자만 지울 수 있다 — DB 함수가 작성자인지 다시 본다.
 *
 * 파일 정리가 하나라도 남으면 성공이라고 알리지 않는다. 같은 버튼을 다시 누르면
 * 이미 지운 추억이라도 남은 파일부터 다시 지운다(정리 목록은 DB에 남아 있다).
 */
export async function deleteMemory(
  memoryId: string,
): Promise<MemoryActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const memory = await loadMemoryForAction(supabase, memoryId)

  if (memory) {
    if (memory.authorId !== user.id) {
      return { ok: false, error: '내가 남긴 글만 지울 수 있어요.' }
    }

    const { error } = await supabase.rpc('delete_memory', {
      p_memory_id: memoryId,
    })
    if (error) {
      console.error('[삭제] 실패:', error.code, error.message)
      return { ok: false, error: '잠시 후 다시 시도해 주세요.' }
    }
  } else {
    // 이미 지운 추억에서 다시 누른 경우 — 남은 파일 정리만 다시 시도한다.
    const { data: pending } = await supabase.rpc('pending_storage_deletions')
    if (!pending || pending.length === 0) {
      return {
        ok: false,
        error: '게시물을 찾지 못했어요. 화면을 새로고침해 주세요.',
      }
    }
  }

  const left = await settleStorageDeletions(supabase)
  if (left > 0) {
    return { ok: false, error: DELETE_FILES_PENDING }
  }

  if (memory) revalidateRoom(memory.roomId)
  else revalidatePath('/', 'layout')
  return { ok: true }
}

/**
 * '나만 보기' 추억을 공개로 바꾼다 (2026-09-28 사용자 결정).
 *
 * 한 장(⋯ 메뉴)이든 여러 장(앨범방 편집)이든 같은 길이다. 되돌리는 길은 없다 —
 * 한 번 보여준 것을 다시 감추면 받은 사람에게는 "사라진 글"로 보인다.
 * 내 글인지·지금 그 방 참여자인지는 DB(publish_memories)가 다시 본다. 하나라도 어긋나면
 * 아무것도 바꾸지 않는다. `roomId`는 화면을 다시 그리는 데에만 쓴다.
 */
export async function publishMemories(
  roomId: string,
  memoryIds: string[],
): Promise<MemoryActionResult> {
  await requireUser()
  const ids = [...new Set(memoryIds)].filter(Boolean)
  if (ids.length === 0) return { ok: false, error: '공개할 추억을 골라 주세요.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('publish_memories', { p_memory_ids: ids })
  if (error) {
    console.error('[공개로 바꾸기] 실패:', error.code, error.message)
    return {
      ok: false,
      error:
        error.code === '42501'
          ? '내가 남긴 추억만 공개로 바꿀 수 있어요.'
          : '잠시 후 다시 시도해 주세요.',
    }
  }

  revalidateRoom(roomId)
  return { ok: true }
}

/**
 * 앨범방 편집에서 여러 장 지우기 (2026-09-28).
 *
 * 한 장씩 deleteMemory 와 같은 길로 지운다 — 파일 정리·재시도 규칙이 그대로 따라온다.
 * 하나라도 실패하면 성공이라고 하지 않고 몇 개가 남았는지 알린다.
 */
export async function deleteMemories(memoryIds: string[]): Promise<MemoryActionResult> {
  const ids = [...new Set(memoryIds)].filter(Boolean)
  if (ids.length === 0) return { ok: false, error: '지울 추억을 골라 주세요.' }

  let failed = 0
  let lastError = ''
  for (const id of ids) {
    const result = await deleteMemory(id)
    if (!result.ok) {
      failed += 1
      lastError = result.error
    }
  }

  if (failed === 0) return { ok: true }
  return {
    ok: false,
    error:
      failed === ids.length
        ? lastError
        : `${ids.length}개 중 ${failed}개를 지우지 못했어요. ${lastError}`,
  }
}
