'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentUser, requireUser } from '@/lib/auth'
import { COVER_PRESETS, isCoverPreset } from '@/lib/covers'
import { roomMemberName } from '@/lib/member-name'
import { isHeartLocked, loadLockedSenders } from '@/lib/mission'
import { loadMyRoomCustoms } from '@/lib/room-look'
import { resolveRoomCover, roomDisplayName } from '@/lib/room-name'
import { createClient } from '@/lib/supabase/server'
import type { Enums } from '@/types/database'

/**
 * 감정 사서함 데이터 조회.
 *
 * 사서함은 별도 테이블이 아니라 heart_messages를 받은/보낸 기준으로 거른 화면이다
 * (02_DATA_MODEL.md "왜 이 구조인가").
 *
 * 여기서 하지 않는 일:
 * - 차단한 사람 걸러내기 → RLS(heart_messages_select)가 이미 한다. 중복 구현 금지.
 * - 내 것만 남기기 → RLS가 이미 한다. 다만 "받은/보낸"을 나누려면 컬럼 조건은 필요하다.
 */

/** 사서함의 두 갈래. */
export type MailboxBox = 'received' | 'sent'

/**
 * 목록 위의 칩 (캡처 38).
 *
 * 캡처에는 [전체·♡·초대·일대일·랜덤] 다섯 개가 있는데 **"초대"는 만들지 않았다.**
 * 초대는 `invitations` 테이블의 일이고 사서함에 쌓이는 것은 `heart_messages`다 —
 * 사서함에는 초대라는 것이 한 건도 들어올 수 없어서, 칩을 두면 눌러도 늘 빈 목록이다.
 * 억지로 뜻을 바꿔 붙이느니 뺐다(판단 근거: _workspace/11_mailbox_send_port.md).
 *
 *   all       — 거르지 않음
 *   favorite  — 내가 ♡ 표시해 둔 것만
 *   direct    — 한 사람을 콕 집어 주고받은 것(캡처의 "일대일")
 *   random    — 랜덤으로 보내진 것
 */
export type MailboxFilter = 'all' | 'favorite' | 'direct' | 'random'

/** 화면에 그대로 뿌릴 수 있게 다듬은 마음 메시지 한 건. */
export type MailboxItem = {
  id: string
  /** 어느 앨범방에서 오간 마음인지 */
  roomId: string
  /** 방 이름. 그 방을 이미 떠났다면 읽을 수 없어 null이 된다. */
  roomName: string | null
  type: Enums<'message_type'>
  /** 어떻게 보내진 마음인지. 카드의 "(전체)"·"랜덤" 표시와 필터 칩이 이 값을 본다. */
  sendMode: Enums<'send_mode'>
  /** 텍스트 메시지 본문. 음성·영상이면 null */
  text: string | null
  /** 음성·영상 재생 주소. 버킷이 비공개라 서명 URL이다. 못 만들었으면 null */
  mediaUrl: string | null
  durationSec: number | null
  /** 녹음할 때 재어 둔 파형 막대 높이. 없으면 재생할 때 파일을 해석한다. */
  voiceLevels: number[] | null
  /** 사용된 질문 프롬프트 */
  promptUsed: string | null
  /** UTC ISO 문자열. 화면에서 KST로 바꿔 보여준다. */
  createdAt: string
  /** 상대방 이름. 방별 별명이 있으면 그 이름이다(@/lib/member-name). */
  partnerName: string | null
  /**
   * 상대가 탈퇴해서 이름이 남아 있지 않은 경우 (메시지는 그대로 남는다).
   * 받은 마음이면 보낸 분, 보낸 마음이면 받는 분이 탈퇴한 경우다.
   */
  partnerWithdrawn: boolean
  /** 나에게 보낸 마음인지(보낸 사람과 받는 사람이 둘 다 나). */
  toMyself: boolean
  /** 내가 ♡ 표시해 둔 마음인지. 나만 보는 값이다. */
  favorited: boolean
  /**
   * 카드 왼쪽 동그라미에 넣을 사진.
   * 방 전체에 보낸 마음이면 사람 사진이 아니라 **그 방의 커버**다(캡처 46·47).
   */
  avatarUrl: string | null
  /** 커버 사진이 없는 방에 깔 그라데이션. 사람 자리에는 null. */
  coverGradient: string | null
  /**
   * 답장 미션으로 잠긴 마음인지 (PRD [MISSION-01]).
   *
   * 잠겼으면 **내용을 아예 실어 보내지 않는다** — text와 mediaUrl이 null이다.
   * 화면에서 가리기만 하면 개발자 도구로 그대로 보인다.
   */
  locked: boolean
  /** 잠긴 이유를 설명할 때 쓸, 이 사람에게 밀린 통수. 안 잠겼으면 0. */
  unrepliedCount: number
}

export type MailboxPage = {
  items: MailboxItem[]
  /** 더 불러올 게 남았는지 */
  hasMore: boolean
  /** 사용자에게 그대로 보여줄 안내 문구. 문제없으면 null */
  error: string | null
}

/** 한 번에 20개씩 (담당 지시). */
const PAGE_SIZE = 20

/** 서명 URL 유효 시간. 화면을 열어둔 채 한동안 듣지 않아도 괜찮게 넉넉히 잡았다. */
const SIGNED_URL_TTL_SEC = 60 * 60

const VOICE_BUCKET = 'voice'
const MEDIA_BUCKET = 'media'

/**
 * users를 두 번(보낸 사람/받는 사람) 붙이므로 외래키 이름을 명시해야 한다.
 * 명시하지 않으면 PostgREST가 어느 관계인지 몰라 오류를 낸다.
 *
 * `favorites`는 내가 ♡ 표시했는지를 보는 자리다. RLS가 이미 내 표시만 돌려주므로
 * 여기서 user_id 조건을 또 걸지 않는다 — 걸면 규칙이 두 곳에 생겨 한쪽만 고쳐진다.
 *
 * 한 줄로 둔다: 문자열을 조각내 이어 붙이면 supabase-js의 타입 추론이 풀려
 * 결과가 unknown이 된다(room-feed.ts와 같은 이유).
 */
const SELECT_COLUMNS =
  'id, room_id, type, content, duration_sec, voice_levels, prompt_used, created_at, send_mode, sender_id, receiver_id, read_at, sender:users!heart_messages_sender_id_fkey(id, name, profile_image), receiver:users!heart_messages_receiver_id_fkey(id, name, profile_image), room:rooms!heart_messages_room_id_fkey(id, name, cover_preset, cover_path), favorites:heart_message_favorites(id)' as const

/**
 * ♡ 칩을 눌렀을 때. `!inner`가 "표시가 달린 것만" 남긴다.
 *
 * 표시한 id를 먼저 다 읽어 와서 `.in()`으로 거르지 않는 이유:
 * 표시가 수백 개면 그 목록 자체가 커지고, 페이지 넘기기(range)와도 어긋난다.
 * 거르는 일은 DB가 한 번에 하는 게 맞다.
 */
const SELECT_COLUMNS_FAVORITED =
  'id, room_id, type, content, duration_sec, voice_levels, prompt_used, created_at, send_mode, sender_id, receiver_id, read_at, sender:users!heart_messages_sender_id_fkey(id, name, profile_image), receiver:users!heart_messages_receiver_id_fkey(id, name, profile_image), room:rooms!heart_messages_room_id_fkey(id, name, cover_preset, cover_path), favorites:heart_message_favorites!inner(id)' as const

/** 음성·영상 파일이 어디에 있는지. */
type MediaRef = { bucket: string; path: string }

/** 사서함이 서명 주소를 만들어 줄 수 있는 버킷. 이 둘 말고는 손대지 않는다. */
const ALLOWED_BUCKETS: readonly string[] = [VOICE_BUCKET, MEDIA_BUCKET]

/** Supabase Storage 주소에서 버킷과 파일 경로를 뽑아내는 정규식. */
const STORAGE_URL_PATTERN =
  /\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?([^/?]+)\/([^?]+)/

/**
 * heart_messages.content에 들어 있는 값을 재생 가능한 형태로 해석한다.
 *
 * 저장 규칙상 음성·영상 파일 경로는 `{room_id}/파일이름` 이다.
 * Storage RLS(`is_room_member(path_uuid(name))`)가 경로 첫 칸을 room_id로 읽어
 * 방 구성원인지 확인하기 때문에, 이 규칙을 벗어난 경로는 애초에 우리 파일이 아니다.
 *
 * content는 결국 보낸 사람이 적어 넣는 값이라, 규칙을 벗어난 값이 들어와도
 * 그대로 재생하지 않는다. 특히:
 * - 우리 스토리지 밖의 주소(https://남의서버/...)는 재생하지 않는다.
 *   그대로 <audio>/<video>에 넣으면 받는 사람의 IP·접속 시각이 남의 서버로 새어 나간다.
 * - 우리 버킷이라도 그 메시지가 오간 방(room_id) 폴더가 아니면 서명하지 않는다.
 *
 * 해석할 수 없으면 null을 돌려주고, 화면은 "불러오지 못했어요"로 안내한다.
 */
function toMediaRef(
  type: Enums<'message_type'>,
  content: string | null,
  roomId: string,
): MediaRef | null {
  const raw = (content ?? '').trim()
  if (!raw || !roomId) return null

  let bucket: string
  let path: string

  if (/^https?:\/\//i.test(raw)) {
    const matched = raw.match(STORAGE_URL_PATTERN)
    // 우리 스토리지 주소 모양이 아니면 재생하지 않는다.
    if (!matched) return null
    bucket = decodeURIComponent(matched[1])
    path = decodeURIComponent(matched[2])
  } else {
    const cleaned = raw.replace(/^\/+/, '')
    const [head, ...rest] = cleaned.split('/')

    // 앞에 버킷 이름이 붙어 있는 경우 (`voice/{room_id}/...`)
    if (rest.length > 0 && ALLOWED_BUCKETS.includes(head)) {
      bucket = head
      path = rest.join('/')
    } else {
      bucket = type === 'video' ? MEDIA_BUCKET : VOICE_BUCKET
      path = cleaned
    }
  }

  if (!ALLOWED_BUCKETS.includes(bucket)) return null

  // 경로 첫 칸은 반드시 이 메시지가 오간 방의 id여야 한다.
  const prefix = `${roomId}/`
  if (!path.startsWith(prefix) || path.length <= prefix.length) return null

  // `..`이 섞인 경로는 다른 폴더를 가리키려는 시도다.
  if (path.split('/').includes('..')) return null

  return { bucket, path }
}

/**
 * 프로필 사진·방 커버처럼 **화면을 꾸미는** 파일을 한 번에 서명한다.
 *
 * 못 만들어도 조용히 넘어간다 — 사진이 빠진 자리는 기본 그림이 채우고,
 * 그것 때문에 목록 전체가 안 보이면 안 된다. 원인은 서버 로그에만 남긴다.
 */
async function signBucket(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: 'avatars' | 'covers',
  paths: string[],
): Promise<Map<string, string>> {
  const urlByPath = new Map<string, string>()
  const unique = [...new Set(paths)]
  if (unique.length === 0) return urlByPath

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(unique, SIGNED_URL_TTL_SEC)

  if (error) {
    console.error(`[사서함] ${bucket} 주소 만들기 실패:`, error.message)
    return urlByPath
  }
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) {
      urlByPath.set(item.path, item.signedUrl)
    }
  }
  return urlByPath
}

/** 화면에서 온 값이 우리가 아는 칩인지. 모르는 값이면 '전체'로 본다. */
function safeFilter(value: unknown): MailboxFilter {
  return value === 'favorite' || value === 'direct' || value === 'random'
    ? value
    : 'all'
}

/**
 * 사서함 한 페이지를 가져온다.
 *
 * @param box    'received'(받은 마음) 또는 'sent'(보낸 마음)
 * @param offset 몇 번째부터 가져올지. "더 보기"에서 지금까지 받은 개수를 그대로 넘기면 된다.
 * @param filter 목록 위 칩. 안 주면 '전체'.
 */
export async function fetchMailboxPage(
  box: MailboxBox,
  offset = 0,
  filter: MailboxFilter = 'all',
): Promise<MailboxPage> {
  const safeBox: MailboxBox = box === 'sent' ? 'sent' : 'received'
  const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0
  const chip = safeFilter(filter)

  const user = await getCurrentUser()
  if (!user) {
    return {
      items: [],
      hasMore: false,
      error: '로그인이 풀렸어요. 다시 로그인한 뒤 열어주세요.',
    }
  }

  const supabase = await createClient()

  const table = supabase.from('heart_messages')
  const query =
    chip === 'favorite'
      ? table.select(SELECT_COLUMNS_FAVORITED)
      : table.select(SELECT_COLUMNS)

  let filtered =
    safeBox === 'received'
      ? query.eq('receiver_id', user.id)
      : query.eq('sender_id', user.id)

  /*
    내가 사서함에서 치운 마음은 빼고 보여준다 (노션 IA 2.2의 편집 모드).

    치운 id를 먼저 읽어와 제외하는 방식이다. 붙여서(embed) 거르지 않는 이유:
    "붙은 줄이 없는 것만" 거르는 문법이 없어서, 걸러낸 만큼 한 쪽이 비어
    "다음 쪽 있음" 판단이 어긋난다. RLS가 내 표시만 돌려주므로 남의 것은 안 섞인다.
  */
  const { data: hides } = await supabase
    .from('heart_message_hides')
    .select('message_id')
    .eq('user_id', user.id)

  const hiddenIds = (hides ?? []).map((row) => row.message_id)
  if (hiddenIds.length > 0) {
    filtered = filtered.not('id', 'in', `(${hiddenIds.join(',')})`)
  }

  // 일대일·랜덤은 "어떻게 보냈는가"로 가른다. 방 인원수로 유추하지 않는다 —
  // 멤버가 나중에 늘거나 줄면 과거 기록의 분류가 통째로 바뀌어 버린다.
  if (chip === 'direct' || chip === 'random') {
    filtered = filtered.eq('send_mode', chip)
  }

  // 한 개 더 달라고 해서, 남은 게 있는지 판단한다.
  // created_at이 같은 메시지가 있어도 순서가 흔들리지 않도록 id로 한 번 더 정렬한다.
  const { data, error } = await filtered
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, start + PAGE_SIZE)

  if (error) {
    console.error('[사서함] 목록 조회 실패:', error.message)
    return {
      items: [],
      hasMore: false,
      error: '마음을 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    }
  }

  const rows = data ?? []
  const hasMore = rows.length > PAGE_SIZE
  const page = rows.slice(0, PAGE_SIZE)

  const refs = page.map((row) =>
    row.type === 'text' ? null : toMediaRef(row.type, row.content, row.room_id),
  )

  // 파일마다 서명 URL을 따로 만들면 요청이 20번 나간다. 버킷별로 한 번에 만든다.
  const wanted = new Map<string, Set<string>>()
  for (const ref of refs) {
    if (!ref) continue
    const paths = wanted.get(ref.bucket) ?? new Set<string>()
    paths.add(ref.path)
    wanted.set(ref.bucket, paths)
  }

  const signedUrls = new Map<string, string>()
  await Promise.all(
    [...wanted].map(async ([bucket, paths]) => {
      const { data: signed } = await supabase.storage
        .from(bucket)
        .createSignedUrls([...paths], SIGNED_URL_TTL_SEC)

      for (const entry of signed ?? []) {
        if (entry.path && entry.signedUrl) {
          signedUrls.set(`${bucket}/${entry.path}`, entry.signedUrl)
        }
      }
    }),
  )

  /*
    카드 왼쪽 동그라미 (캡처 46·47).
    사람 사진(avatars)과 방 커버(covers)는 버킷이 달라 따로 모아 한 번씩 서명한다.
    한 줄마다 서명하면 스무 줄에 스무 번 요청이 나간다.
  */
  /*
    방 이름·커버는 사람마다 다를 수 있다 — 내가 내 화면에서만 바꿔 부르는 값이 있으면
    그것이 이긴다(@/lib/room-name). 홈 카드에서 부르던 이름과 사서함이 다르면
    어느 방에서 온 마음인지 못 알아본다.
  */
  const myRoomCustoms = await loadMyRoomCustoms()
  const roomLook = (row: { room_id: string | null }) =>
    row.room_id ? myRoomCustoms.get(row.room_id) : undefined

  const avatarPaths: string[] = []
  const coverPaths: string[] = []
  for (const row of page) {
    if (row.send_mode === 'broadcast') {
      const cover = resolveRoomCover({
        coverPreset: row.room?.cover_preset,
        coverPath: row.room?.cover_path,
        customCoverPreset: roomLook(row)?.customCoverPreset,
        customCoverPath: roomLook(row)?.customCoverPath,
      })
      if (cover.path) coverPaths.push(cover.path)
      continue
    }
    const partner = safeBox === 'received' ? row.sender : row.receiver
    if (partner?.profile_image) avatarPaths.push(partner.profile_image)
  }

  const [avatarUrlByPath, coverUrlByPath] = await Promise.all([
    signBucket(supabase, 'avatars', avatarPaths),
    signBucket(supabase, 'covers', coverPaths),
  ])

  /*
    방별 별명 (@/lib/member-name).
    users.name을 그대로 쓰면, 그 방에서 "민지엄마"로 부르기로 한 분이 사서함에서만
    본명으로 보인다 — 같은 사람이 화면마다 다른 이름이면 다른 사람 얘기처럼 읽힌다.
    한 페이지에 필요한 (방, 사람) 쌍을 모아 한 번에 묻는다.
  */
  const partnerIds = new Set<string>()
  for (const row of page) {
    const id = safeBox === 'received' ? row.sender_id : row.receiver_id
    if (id) partnerIds.add(id)
  }

  const nicknameByRoomUser = new Map<string, string>()
  if (partnerIds.size > 0) {
    const { data: members, error: memberError } = await supabase
      .from('room_members')
      .select('room_id, user_id, nickname')
      .in('room_id', [...new Set(page.map((row) => row.room_id))])
      .in('user_id', [...partnerIds])

    if (memberError) {
      // 별명을 못 읽어도 목록은 그린다. 전역 이름으로 보일 뿐이다.
      console.error('[사서함] 별명 조회 실패:', memberError.message)
    }
    for (const member of members ?? []) {
      const nickname = member.nickname?.trim()
      if (nickname) {
        nicknameByRoomUser.set(`${member.room_id}:${member.user_id}`, nickname)
      }
    }
  }

  /*
    답장 미션 (PRD [MISSION-01]).

    '받은 마음'에만 건다 — 내가 보낸 마음은 내가 쓴 것이라 잠글 이유가 없다.
    한 번만 읽어 페이지 전체에 쓴다(카드마다 물으면 질의가 카드 수만큼 늘어난다).
  */
  const lockedSenders =
    safeBox === 'received' ? await loadLockedSenders() : new Map<string, number>()

  const items: MailboxItem[] = page.map((row, index) => {
    const ref = refs[index]
    const mediaUrl = ref
      ? (signedUrls.get(`${ref.bucket}/${ref.path}`) ?? null)
      : null

    const locked = isHeartLocked(
      { senderId: row.sender_id, readAt: row.read_at },
      lockedSenders,
    )

    // 받은 마음이면 상대는 보낸 사람, 보낸 마음이면 상대는 받는 사람이다.
    const partner = safeBox === 'received' ? row.sender : row.receiver
    const partnerId = safeBox === 'received' ? row.sender_id : row.receiver_id

    // 방 전체로 보낸 마음의 동그라미는 방 커버다. 위에서 서명한 것과 **같은 규칙**으로
    // 골라야 한다 — 여기서만 원본 커버를 고르면 서명해둔 주소를 못 찾는다.
    const myCover = resolveRoomCover({
      coverPreset: row.room?.cover_preset,
      coverPath: row.room?.cover_path,
      customCoverPreset: roomLook(row)?.customCoverPreset,
      customCoverPath: roomLook(row)?.customCoverPath,
    })

    return {
      id: row.id,
      roomId: row.room_id,
      roomName: row.room
        ? roomDisplayName({
            name: row.room.name,
            customName: roomLook(row)?.customName,
          })
        : null,
      type: row.type,
      sendMode: row.send_mode,
      // 잠긴 마음은 내용을 실어 보내지 않는다. 화면에서 가리기만 하면
      // 개발자 도구에 그대로 보여서 락이 무의미해진다.
      text: locked ? null : row.type === 'text' ? row.content : null,
      mediaUrl: locked ? null : mediaUrl,
      durationSec: row.duration_sec,
      voiceLevels: row.voice_levels,
      promptUsed: row.prompt_used,
      createdAt: row.created_at,
      partnerName: partnerId
        ? roomMemberName({
            userId: partnerId,
            nickname: nicknameByRoomUser.get(`${row.room_id}:${partnerId}`),
            name: partner?.name,
          })
        : null,
      // 탈퇴하면 그 사람을 가리키던 id가 null이 된다(sender_id·receiver_id 둘 다
      // ON DELETE SET NULL). 메시지는 지우지 않고 이름만 사라진다.
      // 받은 마음이면 상대는 보낸 사람, 보낸 마음이면 상대는 받는 사람이라
      // 어느 칸을 봐야 하는지도 함께 갈린다.
      partnerWithdrawn:
        safeBox === 'received' ? row.sender_id === null : row.receiver_id === null,
      toMyself: row.sender_id === user.id && row.receiver_id === user.id,
      // RLS가 내 표시만 돌려주므로, 줄이 하나라도 있으면 내가 눌러둔 것이다.
      favorited: (row.favorites ?? []).length > 0,
      avatarUrl:
        row.send_mode === 'broadcast'
          ? myCover.path
            ? (coverUrlByPath.get(myCover.path) ?? null)
            : null
          : partner?.profile_image
            ? (avatarUrlByPath.get(partner.profile_image) ?? null)
            : null,
      coverGradient:
        row.send_mode === 'broadcast' && isCoverPreset(myCover.preset)
          ? COVER_PRESETS[myCover.preset].gradient
          : null,
      locked,
      unrepliedCount: locked
        ? (lockedSenders.get(row.sender_id ?? '') ?? 0)
        : 0,
    }
  })

  return { items, hasMore, error: null }
}

/**
 * 사서함 카드의 ♡ 켜고 끄기 (캡처 46·47).
 *
 * 상태를 화면이 들고 있지 않는다. 여기서 DB를 바꾸고 `revalidatePath`로
 * 사서함을 다시 그리면 켜짐 여부가 함께 내려온다(게시물 좋아요와 같은 방식).
 *
 * "지금 켜져 있나?"를 먼저 읽고 반대로 뒤집는다. 두 번 눌러 두 줄이 생기는 일은
 * DB의 unique(message_id, user_id)가 막는다 — 마지막 방어선은 언제나 DB다.
 */
export async function toggleHeartMessageFavorite(
  messageId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, error: '로그인이 풀렸어요. 다시 로그인한 뒤 눌러주세요.' }
  }

  const id = messageId?.trim()
  if (!id) return { ok: false, error: '어떤 마음인지 찾지 못했어요.' }

  const supabase = await createClient()

  const { data: existing, error: readError } = await supabase
    .from('heart_message_favorites')
    .select('id')
    .eq('message_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (readError) {
    console.error('[사서함] ♡ 상태 조회 실패:', readError.message)
    return { ok: false, error: '연결이 잠시 불안정했어요. 다시 눌러주세요.' }
  }

  if (existing) {
    // 이 줄은 사람이 남긴 기록이 아니라 켜짐/꺼짐 그 자체다. 꺼면 줄도 없어야 한다
    // (남겨두면 다음에 켤 때 unique 제약에 걸린다 — memory_likes와 같은 판단).
    const { error: deleteError } = await supabase
      .from('heart_message_favorites')
      .delete()
      .eq('id', existing.id)

    if (deleteError) {
      console.error('[사서함] ♡ 끄기 실패:', deleteError.message)
      return { ok: false, error: '연결이 잠시 불안정했어요. 다시 눌러주세요.' }
    }
  } else {
    const { error: insertError } = await supabase
      .from('heart_message_favorites')
      // user_id를 반드시 적는다 — RLS가 auth.uid()와 같은지 확인한다.
      .insert({ message_id: id, user_id: user.id })

    // 23505 = 이미 있는 줄. 다른 창에서 먼저 눌린 것뿐이라 오류로 다루지 않는다.
    if (insertError && insertError.code !== '23505') {
      console.error('[사서함] ♡ 켜기 실패:', insertError.message)
      return { ok: false, error: '연결이 잠시 불안정했어요. 다시 눌러주세요.' }
    }
  }

  revalidatePath('/mailbox')
  return { ok: true }
}

/**
 * 사서함에서 고른 마음들을 내 화면에서 치운다 (노션 IA 2.2의 편집 모드).
 *
 * **지우는 게 아니라 치우는 것이다.** 받은 마음을 진짜로 지우면 보낸 사람의
 * '보낸 마음'에서도 사라진다. 내가 정리한 것 때문에 상대의 기록이 없어지면 안 된다.
 * 그래서 나만 안 보이게 하는 표시를 남긴다(heart_message_hides).
 *
 * 내가 주고받은 마음만 치울 수 있다 — 그 확인은 RLS가 한다. 여기서 또 하지 않는다.
 */
export async function hideHeartMessages(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const user = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase.from('heart_message_hides').upsert(
    ids.map((messageId) => ({ message_id: messageId, user_id: user.id })),
    // 이미 치운 것을 또 고르면 조용히 넘어간다. 오류를 띄울 일이 아니다.
    { onConflict: 'message_id,user_id', ignoreDuplicates: true },
  )

  if (error) {
    console.error('[사서함] 치우기 실패:', error.message)
    return
  }

  revalidatePath('/mailbox')
}
