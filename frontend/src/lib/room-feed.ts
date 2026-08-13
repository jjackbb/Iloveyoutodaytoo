/**
 * 앨범방 게시물을 **화면에 놓을 수 있는 모양**으로 만드는 곳.
 *
 * 피드(`/rooms/[id]`)·좋아요(`/liked`)·숨김(`/hidden`) 세 화면이 같은 카드를 그린다.
 * 세 곳에 같은 조회·서명·이름 정하기를 각각 적어두면 한 곳만 고쳐져 조용히 어긋난다 —
 * 실제로 "숨긴 글 빼기"나 "별명 우선" 같은 규칙은 화면마다 다르면 안 되는 것들이다.
 *
 * 여기는 서버에서만 돈다. 카드 부품(MemoryCard)은 DB를 모르고 props만 받는다.
 */

import type { MemoryCardProps, MemoryPhotoView } from '@/components/memory/MemoryCard'
import { roomMemberName } from '@/lib/member-name'
import type { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

/** 서명 주소의 유효 시간(초). 화면을 오래 열어둬도 끊기지 않을 만큼만. */
export const SIGNED_URL_TTL_SEC = 60 * 60

/** 카드 그리드에 보이는 사진 칸 수. 넘는 만큼은 마지막 칸에 +N으로 접힌다(캡처 22). */
export const GRID_SLOTS = 3

/**
 * 게시물 한 줄을 읽을 때 쓰는 컬럼들.
 *
 * 한 줄로 둔다 — 문자열을 여러 조각으로 이어 붙이면 supabase-js의 타입 추론이 풀려서
 * 결과가 unknown이 된다. `as const`라 리터럴 타입이 그대로 전달된다.
 */
export const MEMORY_CARD_SELECT =
  'id, created_at, description, voice_path, voice_duration_sec, voice_levels, author_id, pinned_at, author:users!memories_author_id_fkey(id, name), photos:memory_photos(storage_path, sort_order)' as const

/** 위 select가 돌려주는 한 줄. 조회는 화면마다 다르지만 이 모양은 같다. */
export type MemoryRow = {
  id: string
  created_at: string
  description: string | null
  voice_path: string | null
  voice_duration_sec: number | null
  /** 녹음할 때 재어 둔 파형 막대 높이. 없으면 재생바가 재생할 때 파일을 해석한다. */
  voice_levels: number[] | null
  author_id: string | null
  pinned_at: string | null
  author: { id: string; name: string } | null
  photos: { storage_path: string; sort_order: number }[] | null
}

/** 카드에 그대로 넘길 수 있는 props. `as`는 부르는 화면이 정한다. */
export type MemoryCardView = Omit<MemoryCardProps, 'as'>

/**
 * 이 방의 파일 경로가 맞는지.
 *
 * 경로는 결국 올린 사람이 적어 넣는 값이라 그대로 믿지 않는다.
 * 이 방의 파일(`{room_id}/…`)만 서명한다 — 홈·사서함도 같은 규칙을 쓴다.
 */
export function isRoomPath(path: string | null, roomId: string): path is string {
  return (
    typeof path === 'string' &&
    path.startsWith(`${roomId}/`) &&
    !path.split('/').includes('..')
  )
}

/**
 * 비공개 버킷의 파일들을 한 번에 서명한다. 빈 목록이면 요청 자체를 보내지 않는다.
 *
 * 게시물 수만큼 요청이 늘어나는 구조(N+1)를 만들지 않는 것이 핵심이다.
 */
export async function signPaths(
  supabase: Supabase,
  bucket: 'media' | 'voice',
  paths: string[],
): Promise<Map<string, string>> {
  const urlByPath = new Map<string, string>()
  if (paths.length === 0) return urlByPath

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, SIGNED_URL_TTL_SEC)

  if (error) {
    console.error(`[앨범방] ${bucket} 주소 만들기 실패:`, error.message)
    return urlByPath
  }

  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) {
      urlByPath.set(item.path, item.signedUrl)
    }
  }
  return urlByPath
}

/**
 * 내가 이 방에서 숨긴 게시물 번호들.
 *
 * `memory_hides`에는 방 번호가 없어서 부모 게시물로 이 방 것만 좁힌다.
 * 못 읽으면 빈 목록을 돌려준다 — 숨긴 글이 다시 보일 뿐, 화면을 막지는 않는다.
 */
export async function loadHiddenMemoryIds(
  supabase: Supabase,
  roomId: string,
  viewerId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('memory_hides')
    .select('memory_id, memories!inner(room_id)')
    .eq('user_id', viewerId)
    .eq('memories.room_id', roomId)

  if (error) {
    console.error('[앨범방] 숨김 조회 실패:', error.message)
    return []
  }
  return (data ?? []).map((row) => row.memory_id)
}

/**
 * 이 방에서 각자를 뭐라고 부를지 — user_id → 화면에 보일 이름.
 *
 * 별명이 있으면 별명, 없으면 전역 이름이다(`roomMemberName`).
 * status로 좁히지 않는다 — 방을 떠난 분이 남긴 글도 **그 방에서 불리던 이름**으로 남아야 한다.
 */
export async function loadRoomNicknames(
  supabase: Supabase,
  roomId: string,
): Promise<Map<string, string>> {
  const nicknameByUser = new Map<string, string>()

  const { data, error } = await supabase
    .from('room_members')
    .select('user_id, nickname')
    .eq('room_id', roomId)

  if (error) {
    // 별명을 못 읽으면 전역 이름으로 흐른다. 이름이 사라지지는 않는다.
    console.error('[앨범방] 별명 조회 실패:', error.message)
    return nicknameByUser
  }

  for (const member of data ?? []) {
    const nickname = member.nickname?.trim()
    if (nickname) nicknameByUser.set(member.user_id, nickname)
  }
  return nicknameByUser
}

/**
 * 게시물별 살아 있는 댓글 수.
 *
 * `count`로 한 줄씩 세면 게시물 수만큼 요청이 늘어난다(N+1). 번호만 한 번에 받아
 * 여기서 센다 — 피드 한 화면이 30개라 세어야 할 줄도 그만큼밖에 안 된다.
 * 지운 댓글(`deleted_at`)은 인덱스에서부터 빠진다.
 */
export async function loadCommentCounts(
  supabase: Supabase,
  memoryIds: string[],
): Promise<Map<string, number>> {
  const countByMemory = new Map<string, number>()
  if (memoryIds.length === 0) return countByMemory

  const { data, error } = await supabase
    .from('memory_comments')
    .select('memory_id')
    .in('memory_id', memoryIds)
    .is('deleted_at', null)

  if (error) {
    // 수를 못 세도 게시물은 보여야 한다. 0으로 흐른다.
    console.error('[앨범방] 댓글 수 조회 실패:', error.message)
    return countByMemory
  }

  for (const row of data ?? []) {
    countByMemory.set(row.memory_id, (countByMemory.get(row.memory_id) ?? 0) + 1)
  }
  return countByMemory
}

/**
 * 게시물 줄들을 카드 props로 바꾼다.
 *
 * 하는 일: 사진 순서 세우기 → 서명(버킷당 한 번) → 좋아요·저장 배치 조회 → 이름 정하기.
 * 조회(어떤 게시물을 가져올지)는 화면마다 다르므로 여기서 하지 않는다. 줄을 받아서 다듬기만 한다.
 */
export async function buildMemoryCards(options: {
  supabase: Supabase
  roomId: string
  viewerId: string
  rows: MemoryRow[]
}): Promise<MemoryCardView[]> {
  const { supabase, roomId, viewerId, rows } = options
  if (rows.length === 0) return []

  // 게시물마다 사진을 순서대로 정리한다. DB가 준 순서를 믿지 않고 sort_order로 다시 세운다 —
  // 대표 사진(0번)이 왼쪽 큰 자리에 오는 것이 작성 화면에서 한 약속이다.
  const sorted = rows.map((memory) => ({
    memory,
    photos: [...(memory.photos ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }))

  const photoPaths = Array.from(
    new Set(
      sorted.flatMap(({ photos }) =>
        photos
          .map((photo) => photo.storage_path)
          .filter((path): path is string => isRoomPath(path, roomId)),
      ),
    ),
  )
  const voicePaths = Array.from(
    new Set(
      sorted
        .map(({ memory }) => memory.voice_path)
        .filter((path): path is string => isRoomPath(path, roomId)),
    ),
  )

  const memoryIds = sorted.map(({ memory }) => memory.id)

  const [
    photoUrlByPath,
    voiceUrlByPath,
    likesResult,
    savesResult,
    nicknameByUser,
    commentCountByMemory,
  ] = await Promise.all([
    signPaths(supabase, 'media', photoPaths),
    signPaths(supabase, 'voice', voicePaths),
    supabase
      .from('memory_likes')
      // 누가 눌렀는지까지 가져와야 **내 하트가 채워졌는지**를 알 수 있다.
      // 수만 세면 옆 사람이 누른 것과 구분이 안 된다.
      .select('memory_id, user_id')
      .in('memory_id', memoryIds),
    supabase
      .from('memory_saves')
      .select('memory_id')
      .eq('user_id', viewerId)
      .in('memory_id', memoryIds),
    loadRoomNicknames(supabase, roomId),
    loadCommentCounts(supabase, memoryIds),
  ])

  if (likesResult.error) {
    console.error('[앨범방] 좋아요 조회 실패:', likesResult.error.message)
  }
  if (savesResult.error) {
    console.error('[앨범방] 저장 조회 실패:', savesResult.error.message)
  }

  const likeCountByMemory = new Map<string, number>()
  const likedByMe = new Set<string>()
  for (const like of likesResult.data ?? []) {
    likeCountByMemory.set(
      like.memory_id,
      (likeCountByMemory.get(like.memory_id) ?? 0) + 1,
    )
    if (like.user_id === viewerId) likedByMe.add(like.memory_id)
  }

  const savedByMe = new Set((savesResult.data ?? []).map((row) => row.memory_id))

  return sorted.map(({ memory, photos }) => {
    // 주소를 만든 것만 남는다. 여기서 빠진 사진은 화면에 놓을 방법이 없다.
    const signedUrls = photos
      .map((photo) => photoUrlByPath.get(photo.storage_path))
      .filter((url): url is string => Boolean(url))

    const visible: MemoryPhotoView[] = signedUrls
      .slice(0, GRID_SLOTS)
      .map((url) => ({ url }))

    return {
      memoryId: memory.id,
      // 카드에서 상세 화면 주소를 만들 때 쓴다. 조회한 방과 늘 같은 값이다.
      roomId,
      authorName: roomMemberName({
        userId: memory.author_id,
        nickname: memory.author_id
          ? nicknameByUser.get(memory.author_id)
          : null,
        name: memory.author?.name,
      }),
      authorId: memory.author_id,
      viewerId,
      createdAt: memory.created_at,
      photos: visible,
      // DB에 사진이 있는데 visible이 비면 "불러오지 못했어요"로 흐른다.
      hasPhotos: photos.length > 0,
      /*
        +N은 **실제로 더 볼 수 있는 수**여야 한다. DB 원본 수로 세면
        10장 중 4장만 서명됐을 때 "+7"이라 적고 실제로는 1장만 더 있다.
        약속한 것보다 적게 보여주는 셈이라 서명에 성공한 것만 센다.
      */
      hiddenPhotoCount: signedUrls.length - visible.length,
      caption: memory.description,
      voiceUrl: isRoomPath(memory.voice_path, roomId)
        ? (voiceUrlByPath.get(memory.voice_path) ?? null)
        : null,
      voiceDurationSec: memory.voice_duration_sec,
      voiceLevels: memory.voice_levels,
      likeCount: likeCountByMemory.get(memory.id) ?? 0,
      likedByMe: likedByMe.has(memory.id),
      commentCount: commentCountByMemory.get(memory.id) ?? 0,
      isPinned: memory.pinned_at !== null,
      isSaved: savedByMe.has(memory.id),
    }
  })
}

/* ============================================================
   게시물 상세 (캡처 24~36)

   피드 카드와 다른 점은 두 가지다.
   - 사진을 **전부** 준다(카드는 그리드 3칸까지만). 상세는 페이저로 한 장씩 넘겨본다.
   - 댓글 목록이 함께 온다.
   조회를 카드와 합치지 않는 이유: 피드는 30개를 그리는 화면이라 게시물마다 댓글을
   다 실어 오면 목록 한 번에 수백 줄이 딸려온다. 상세는 한 개짜리라 그럴 일이 없다.
   ============================================================ */

/** 댓글 한 줄. 텍스트이거나 음성이거나, 둘 중 하나만 채워져 있다(DB CHECK). */
export type MemoryCommentView = {
  commentId: string
  /** 방별 별명 우선(roomMemberName). 탈퇴한 자리는 '탈퇴한 사용자'. */
  authorName: string
  /** 내가 남긴 댓글인가. 삭제 메뉴를 보일지 정한다. */
  isMine: boolean
  createdAt: string
  /** 텍스트 댓글의 내용. 음성 댓글이면 null. */
  body: string | null
  /** 서명된 voice 버킷 주소. 못 만들었으면 null. */
  voiceUrl: string | null
  voiceDurationSec: number | null
  /** 녹음할 때 재어 둔 파형 막대 높이. 없으면 재생할 때 파일을 해석한다. */
  voiceLevels: number[] | null
}

/** 상세 화면 한 판에 필요한 전부. 화면은 이 값만 보고 그린다. */
export type MemoryDetailView = {
  memoryId: string
  authorName: string
  authorId: string | null
  viewerId: string
  createdAt: string
  /** 페이저에 놓을 사진들. 주소를 만든 것만 온다. */
  photos: MemoryPhotoView[]
  /** DB에 사진이 있는지. photos가 비었는데 참이면 "불러오지 못했어요"로 흐른다. */
  hasPhotos: boolean
  caption: string | null
  voiceUrl: string | null
  voiceDurationSec: number | null
  /** 녹음할 때 재어 둔 파형 막대 높이. 없으면 재생할 때 파일을 해석한다. */
  voiceLevels: number[] | null
  likeCount: number
  likedByMe: boolean
  isPinned: boolean
  isSaved: boolean
  comments: MemoryCommentView[]
}

/** 상세에서 읽는 컬럼들. 카드와 달리 사진 수를 자르지 않는다(한 줄로 둔다 — 타입 추론). */
const MEMORY_DETAIL_SELECT =
  'id, created_at, description, voice_path, voice_duration_sec, voice_levels, author_id, pinned_at, author:users!memories_author_id_fkey(id, name), photos:memory_photos(storage_path, sort_order)' as const

/** 댓글 한 줄을 읽을 때 쓰는 컬럼들. */
const COMMENT_SELECT =
  'id, created_at, body, voice_path, voice_duration_sec, voice_levels, author_id, author:users!memory_comments_author_id_fkey(id, name)' as const

/**
 * 게시물 하나와 그 댓글들을 상세 화면 모양으로 읽는다.
 *
 * 못 읽으면 null이다 — 지워졌거나(soft delete), 남의 방이거나(RLS), 주소가 잘못됐거나.
 * 셋을 구분해 알려줄 방법도 이유도 없어서 화면은 그냥 404로 흐른다.
 *
 * 요청 수: 게시물 1 + 댓글 1 + (서명 media 1 · voice 1) + 좋아요 1 + 저장 1 + 별명 1.
 * 댓글이나 사진 수에 따라 늘지 않는다.
 */
export async function loadMemoryDetail(options: {
  supabase: Supabase
  roomId: string
  memoryId: string
  viewerId: string
}): Promise<MemoryDetailView | null> {
  const { supabase, roomId, memoryId, viewerId } = options

  const { data: memory, error } = await supabase
    .from('memories')
    .select(MEMORY_DETAIL_SELECT)
    .eq('id', memoryId)
    // 다른 방 글의 주소를 들고 와도 이 방 화면에서는 열리지 않는다.
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('[게시물] 조회 실패:', error.message)
    return null
  }
  if (!memory) return null

  const { data: commentRows, error: commentError } = await supabase
    .from('memory_comments')
    .select(COMMENT_SELECT)
    .eq('memory_id', memoryId)
    .is('deleted_at', null)
    // 오래된 것이 위, 새 댓글이 맨 아래에 붙는다(캡처 33~36).
    .order('created_at', { ascending: true })

  if (commentError) {
    console.error('[댓글] 조회 실패:', commentError.message)
  }
  const comments = commentRows ?? []

  // 사진 순서는 DB가 준 순서를 믿지 않고 sort_order로 다시 세운다(대표 사진이 첫 장).
  const photos = [...(memory.photos ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  )

  const photoPaths = Array.from(
    new Set(
      photos
        .map((photo) => photo.storage_path)
        .filter((path): path is string => isRoomPath(path, roomId)),
    ),
  )
  // 게시물 음성과 음성 댓글이 같은 버킷(voice)에 있어 한 번에 서명한다.
  const voicePaths = Array.from(
    new Set(
      [memory.voice_path, ...comments.map((comment) => comment.voice_path)].filter(
        (path): path is string => isRoomPath(path, roomId),
      ),
    ),
  )

  const [photoUrlByPath, voiceUrlByPath, likesResult, saveResult, nicknameByUser] =
    await Promise.all([
      signPaths(supabase, 'media', photoPaths),
      signPaths(supabase, 'voice', voicePaths),
      supabase.from('memory_likes').select('user_id').eq('memory_id', memoryId),
      supabase
        .from('memory_saves')
        .select('id')
        .eq('memory_id', memoryId)
        .eq('user_id', viewerId)
        .maybeSingle(),
      loadRoomNicknames(supabase, roomId),
    ])

  if (likesResult.error) {
    console.error('[게시물] 좋아요 조회 실패:', likesResult.error.message)
  }

  const likes = likesResult.data ?? []

  const nameOf = (
    userId: string | null,
    author: { id: string; name: string } | null,
  ) =>
    roomMemberName({
      userId,
      nickname: userId ? nicknameByUser.get(userId) : null,
      name: author?.name,
    })

  return {
    memoryId: memory.id,
    authorName: nameOf(memory.author_id, memory.author),
    authorId: memory.author_id,
    viewerId,
    createdAt: memory.created_at,
    photos: photos
      .map((photo) => photoUrlByPath.get(photo.storage_path))
      .filter((url): url is string => Boolean(url))
      .map((url) => ({ url })),
    hasPhotos: photos.length > 0,
    caption: memory.description,
    voiceUrl: isRoomPath(memory.voice_path, roomId)
      ? (voiceUrlByPath.get(memory.voice_path) ?? null)
      : null,
    voiceDurationSec: memory.voice_duration_sec,
    voiceLevels: memory.voice_levels,
    likeCount: likes.length,
    likedByMe: likes.some((like) => like.user_id === viewerId),
    isPinned: memory.pinned_at !== null,
    isSaved: saveResult.data !== null,
    comments: comments.map((comment) => ({
      commentId: comment.id,
      authorName: nameOf(comment.author_id, comment.author),
      /*
        작성자가 탈퇴해 author_id가 null이 된 댓글은 아무의 것도 아니다.
        null === null 로 뚫리지 않도록 먼저 막는다(MemoryCard의 isMine과 같은 판단).
      */
      isMine: comment.author_id !== null && comment.author_id === viewerId,
      createdAt: comment.created_at,
      body: comment.body,
      voiceUrl: isRoomPath(comment.voice_path, roomId)
        ? (voiceUrlByPath.get(comment.voice_path) ?? null)
        : null,
      voiceDurationSec: comment.voice_duration_sec,
      voiceLevels: comment.voice_levels,
    })),
  }
}
