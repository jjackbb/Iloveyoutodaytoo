'use server'

/**
 * 마음 보내기 — 받는 사람 후보 만들기와, 고른 것을 실제 받는 사람으로 풀어내기.
 *
 * 이 파일이 하는 일은 두 가지다.
 *   1) `loadSendCandidates` — 시트에 그릴 목록(캡처 42)을 DB에서 읽어 만든다.
 *   2) `resolveHeartTargets` — 화면이 고른 id들을 **방 하나 + 받는 사람 하나**의
 *      목록으로 풀어낸다. 실제 저장은 기존에 검증된 `sendHeartMessage`가 한 통씩 한다.
 *
 * 왜 푸는 일을 서버가 하는가:
 * - "{방} (전체)"가 몇 명인지, "랜덤"이 누구인지는 **지금 DB 상태**가 정한다.
 *   화면이 열려 있는 사이에 누가 방을 나갈 수도 있다. 보내기를 누른 순간 다시 읽어야 한다.
 * - 랜덤을 클라이언트에서 뽑으면 사용자가 새로고침을 반복해 원하는 사람이 나올 때까지
 *   돌릴 수 있다. 그건 랜덤이 아니다.
 *
 * 여기서는 아무것도 저장하지 않는다. 저장은 `sendHeartMessage` 한 곳뿐이다.
 */

import { COVER_PRESETS, isCoverPreset } from '@/lib/covers'
import { getCurrentUser } from '@/lib/auth'
import {
  RANDOM_CANDIDATE_ID,
  SELF_CANDIDATE_ID,
  memberCandidateId,
  parseCandidateId,
  roomCandidateId,
  type SendCandidate,
  type SendCandidateGroup,
  type SendCandidates,
} from '@/lib/heart-send'
import { HEART_SEND_MAX_TARGETS } from '@/lib/limits'
import { roomMemberName } from '@/lib/member-name'
import { resolveRoomCover, roomDisplayName } from '@/lib/room-name'
import { createClient } from '@/lib/supabase/server'
import type { Enums } from '@/types/database'

/** 서명 주소 유효 시간. 고르는 화면을 오래 열어둬도 사진이 안 깨질 만큼만. */
const SIGNED_URL_TTL_SEC = 60 * 60

/** 내가 속한 방 하나와 그 방의 활성 멤버들. 후보 만들기와 대상 풀기가 같은 값을 본다. */
type RoomRoster = {
  roomId: string
  roomName: string
  relationshipType: Enums<'relationship_type'> | null
  coverPreset: string | null
  coverPath: string | null
  /** 나를 뺀 활성 멤버들. 방 안에서 부르는 이름(별명 우선)까지 정해 둔다. */
  others: { userId: string; name: string; avatarPath: string | null }[]
  /** 나를 포함한 활성 멤버 수. "혼자 쓰는 방"인지 판단할 때 쓴다. */
  activeCount: number
  /** 방에 들어온 시각. 가장 오래된 방을 고를 때 쓴다. */
  joinedAt: string
}

/**
 * 내가 속한 방과 그 멤버들을 한 번에 읽는다.
 *
 * 방마다 따로 묻지 않는다 — 방이 늘어날수록 질의가 같이 늘어나는 구조를 만들지 않는다.
 * RLS가 이미 "내가 속한 방"만 돌려주지만, 나간 기록(status='left')은 조건으로 뺀다.
 */
async function loadRosters(
  supabase: Awaited<ReturnType<typeof createClient>>,
  myUserId: string,
): Promise<{ rosters: RoomRoster[]; error: boolean }> {
  const { data: memberships, error: membershipError } = await supabase
    .from('room_members')
    .select(
      'room_id, joined_at, custom_name, custom_cover_preset, custom_cover_path, rooms(id, name, relationship_type, cover_preset, cover_path)',
    )
    .eq('user_id', myUserId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })

  if (membershipError) {
    console.error('[마음 보내기] 앨범방 조회 실패:', membershipError.message)
    return { rosters: [], error: true }
  }

  const rows = memberships ?? []
  const roomIds = rows.map((row) => row.room_id)
  if (roomIds.length === 0) return { rosters: [], error: false }

  const { data: members, error: memberError } = await supabase
    .from('room_members')
    // nickname: 이 방에서 부르는 이름이 있으면 그 이름으로 보여야 한다(@/lib/member-name).
    .select('room_id, user_id, nickname, users(id, name, profile_image)')
    .in('room_id', roomIds)
    .eq('status', 'active')

  if (memberError) {
    console.error('[마음 보내기] 멤버 조회 실패:', memberError.message)
    return { rosters: [], error: true }
  }

  const byRoom = new Map<string, RoomRoster>()
  for (const row of rows) {
    const room = row.rooms
    if (!room) continue
    // 이름·커버는 내 화면 기준으로 고른다 — 홈 카드에서 부르던 이름과 달라지면
    // 어느 방인지 못 알아본다(@/lib/room-name).
    const cover = resolveRoomCover({
      coverPreset: room.cover_preset,
      coverPath: room.cover_path,
      customCoverPreset: row.custom_cover_preset,
      customCoverPath: row.custom_cover_path,
    })

    byRoom.set(row.room_id, {
      roomId: room.id,
      roomName: roomDisplayName({ name: room.name, customName: row.custom_name }),
      relationshipType: room.relationship_type,
      coverPreset: cover.preset,
      coverPath: cover.path,
      others: [],
      activeCount: 0,
      joinedAt: row.joined_at,
    })
  }

  for (const member of members ?? []) {
    const roster = byRoom.get(member.room_id)
    if (!roster) continue
    roster.activeCount += 1

    // 나 자신은 개별 후보로 세우지 않는다 — "기본" 구역의 "나에게"가 그 자리다.
    if (member.user_id === myUserId) continue

    roster.others.push({
      userId: member.user_id,
      name: roomMemberName({
        userId: member.user_id,
        nickname: member.nickname,
        name: member.users?.name,
      }),
      avatarPath: member.users?.profile_image ?? null,
    })
  }

  return { rosters: [...byRoom.values()], error: false }
}

/** 비공개 버킷의 경로들을 한 번에 서명한다. 빈 목록이면 요청 자체를 보내지 않는다. */
async function signAll(
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
    // 사진이 없어도 화면은 그린다(기본 그림이 대신 나온다). 원인은 로그에만 남긴다.
    console.error(`[마음 보내기] ${bucket} 주소 만들기 실패:`, error.message)
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
 * "추가하기" 시트에 그릴 후보 목록 (캡처 42).
 *
 * 구역 순서는 캡처 그대로 — 기본(나에게·랜덤) 다음에 방마다 한 구역씩.
 *
 * **나 혼자 있는 방은 목록에 넣지 않는다.** 보낼 상대가 없어서 "(전체)"를 눌러도
 * 아무 일이 일어나지 않기 때문이다. 캡처에서는 그 방에 상대가 한 분 있었다.
 */
export async function loadSendCandidates(): Promise<SendCandidates> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      groups: [],
      error: '로그인이 풀렸어요. 다시 로그인한 뒤 열어주세요.',
    }
  }

  const supabase = await createClient()
  const { rosters, error } = await loadRosters(supabase, user.id)

  if (error) {
    return {
      groups: [],
      error: '받는 분 목록을 불러오지 못했어요. 잠시 후 다시 열어주세요.',
    }
  }

  /*
    방이 하나도 없으면 보낼 곳 자체가 없다. heart_messages는 반드시 방 하나에 매여 있어서
    "나에게"조차 남길 자리가 없다. 후보를 그려놓고 보내기에서 실패시키지 않고 여기서 말해준다.
  */
  if (rosters.length === 0) {
    return {
      groups: [],
      error:
        '아직 속한 앨범방이 없어요. 앨범방을 먼저 만들면 마음을 보낼 수 있어요.',
    }
  }

  // 상대가 한 명이라도 있는 방만 그린다.
  const shared = rosters.filter((roster) => roster.others.length > 0)

  const [avatarUrls, coverUrls] = await Promise.all([
    signAll(
      supabase,
      'avatars',
      [
        user.profile_image,
        ...shared.flatMap((roster) =>
          roster.others.map((other) => other.avatarPath),
        ),
      ].filter((path): path is string => Boolean(path)),
    ),
    signAll(
      supabase,
      'covers',
      shared
        .map((roster) => roster.coverPath)
        .filter((path): path is string => Boolean(path)),
    ),
  ])

  const basics: SendCandidate[] = [
    {
      id: SELF_CANDIDATE_ID,
      kind: 'self',
      name: `${user.name} (나)`,
      description: '나에게 보내기',
      avatarUrl: user.profile_image
        ? (avatarUrls.get(user.profile_image) ?? null)
        : null,
      coverGradient: null,
    },
  ]

  // 고를 상대가 아무도 없으면 "랜덤"도 세우지 않는다 — 눌러도 보낼 사람이 없다.
  if (shared.length > 0) {
    basics.push({
      id: RANDOM_CANDIDATE_ID,
      kind: 'random',
      name: '랜덤',
      description: '앨범방 멤버 중 랜덤으로 마음 전하기',
      avatarUrl: null,
      coverGradient: null,
    })
  }

  const groups: SendCandidateGroup[] = [{ title: '기본', items: basics }]

  for (const roster of shared) {
    const gradient = isCoverPreset(roster.coverPreset)
      ? COVER_PRESETS[roster.coverPreset].gradient
      : null

    groups.push({
      title: roster.roomName,
      items: [
        {
          id: roomCandidateId(roster.roomId),
          kind: 'room',
          name: `${roster.roomName} (전체)`,
          description: `전체 멤버 (${roster.others.length}명)에게 보내기`,
          avatarUrl: roster.coverPath
            ? (coverUrls.get(roster.coverPath) ?? null)
            : null,
          coverGradient: gradient,
        },
        ...roster.others.map(
          (other): SendCandidate => ({
            id: memberCandidateId(roster.roomId, other.userId),
            kind: 'member',
            name: other.name,
            description: `${roster.roomName} 멤버`,
            avatarUrl: other.avatarPath
              ? (avatarUrls.get(other.avatarPath) ?? null)
              : null,
            coverGradient: null,
          }),
        ),
      ],
    })
  }

  return { groups, error: null }
}

/* ------------------------------------------------------------------ *
 * 고른 것을 실제 받는 사람으로 풀어내기
 * ------------------------------------------------------------------ */

/** 마음 한 통이 갈 곳. 이 한 줄이 `sendHeartMessage` 한 번에 대응한다. */
export type HeartTarget = {
  roomId: string
  receiverId: string
  /** 결과 안내에 쓸 이름("○○님께 보냈어요"). */
  name: string
  sendMode: Enums<'send_mode'>
}

export type ResolveHeartTargetsResult =
  | { ok: true; targets: HeartTarget[] }
  | { ok: false; error: string }

/**
 * 시트에서 고른 id들을 받는 사람 목록으로 푼다.
 *
 * 규칙:
 * - `self`   → 나에게 한 통. 어느 방에 남길지는 아래 `pickSelfRoom`이 정한다.
 * - `member` → 그 방의 그 사람에게 한 통.
 * - `room`   → 그 방의 **나를 뺀** 활성 멤버 전원에게 각각 한 통씩.
 * - `random` → 내 방들의 멤버(나 제외) 중 서버가 무작위로 고른 한 사람에게 한 통.
 *
 * 같은 방·같은 사람이 두 번 나오면 한 번만 남긴다 — "전체"와 개별 멤버를 같이 골랐을 때
 * 같은 분에게 똑같은 녹음이 두 통 가는 것을 막는다.
 */
export async function resolveHeartTargets(
  candidateIds: string[],
): Promise<ResolveHeartTargetsResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, error: '로그인이 풀렸어요. 다시 로그인한 뒤 보내주세요.' }
  }

  const parsed = (candidateIds ?? [])
    .map((raw) => parseCandidateId(String(raw)))
    .filter((value): value is NonNullable<typeof value> => value !== null)

  if (parsed.length === 0) {
    return { ok: false, error: '받는 분을 먼저 골라주세요.' }
  }

  const supabase = await createClient()
  const { rosters, error } = await loadRosters(supabase, user.id)

  if (error) {
    return {
      ok: false,
      error: '연결이 잠시 불안정했어요. 잠시 후 다시 눌러주세요.',
    }
  }
  if (rosters.length === 0) {
    return {
      ok: false,
      error: '아직 속한 앨범방이 없어요. 앨범방을 먼저 만들어 주세요.',
    }
  }

  const rosterById = new Map(rosters.map((roster) => [roster.roomId, roster]))

  const targets: HeartTarget[] = []
  const seen = new Set<string>()

  function add(target: HeartTarget) {
    const key = `${target.roomId}:${target.receiverId}`
    if (seen.has(key)) return
    seen.add(key)
    targets.push(target)
  }

  // 랜덤은 맨 마지막에 푼다. 이미 정해진 분을 또 고르지 않기 위해서다.
  let wantsRandom = false

  for (const item of parsed) {
    if (item.kind === 'self') {
      const room = pickSelfRoom(rosters)
      add({
        roomId: room.roomId,
        receiverId: user.id,
        name: '나',
        sendMode: 'direct',
      })
      continue
    }

    if (item.kind === 'random') {
      wantsRandom = true
      continue
    }

    const roster = rosterById.get(item.roomId)
    // 화면을 열어둔 사이에 방을 나갔거나, 없는 방 id가 온 경우. 조용히 건너뛴다.
    if (!roster) continue

    if (item.kind === 'room') {
      for (const other of roster.others) {
        add({
          roomId: roster.roomId,
          receiverId: other.userId,
          name: other.name,
          sendMode: 'broadcast',
        })
      }
      continue
    }

    const member = roster.others.find((other) => other.userId === item.userId)
    if (!member) continue
    add({
      roomId: roster.roomId,
      receiverId: member.userId,
      name: member.name,
      sendMode: 'direct',
    })
  }

  if (wantsRandom) {
    const pool = rosters.flatMap((roster) =>
      roster.others.map((other) => ({ roster, other })),
    )
    // 이미 고른 분은 후보에서 뺀다. 다 겹치면 어쩔 수 없이 전체에서 고른다.
    const fresh = pool.filter(
      ({ roster, other }) => !seen.has(`${roster.roomId}:${other.userId}`),
    )
    const from = fresh.length > 0 ? fresh : pool

    if (from.length === 0) {
      return {
        ok: false,
        error:
          '아직 함께하는 분이 없어요. 앨범방에 소중한 분을 먼저 초대해 주세요.',
      }
    }

    const picked = from[Math.floor(Math.random() * from.length)]
    add({
      roomId: picked.roster.roomId,
      receiverId: picked.other.userId,
      name: picked.other.name,
      sendMode: 'random',
    })
  }

  if (targets.length === 0) {
    return {
      ok: false,
      error: '보낼 분을 찾지 못했어요. 받는 분을 다시 골라주세요.',
    }
  }
  if (targets.length > HEART_SEND_MAX_TARGETS) {
    return {
      ok: false,
      error: `한 번에 ${HEART_SEND_MAX_TARGETS}분까지 보낼 수 있어요. 받는 분을 조금 줄여주세요.`,
    }
  }

  return { ok: true, targets }
}

/**
 * "나에게" 보낼 마음을 어느 방에 남길지.
 *
 * heart_messages는 반드시 방 하나에 매여 있다(room_id가 NOT NULL이고 RLS도 방을 본다).
 * 그런데 우리에게는 "나만의 방"이라는 개념이 화면에 없다 — 관계유형 질문이 2026-08-09에
 * 제거되면서 새 방은 relationship_type이 비어 있다. 그래서 세 단계로 고른다.
 *
 *   1) 예전에 '나 자신' 유형으로 만든 방이 있으면 그 방
 *   2) 없으면 **나 혼자 있는 방** 중 가장 오래된 방 — 남이 볼 수 없는 자리라 가장 가깝다
 *   3) 그것도 없으면 가장 오래된 방
 *
 * 어느 경우든 받는 사람이 나 자신이라 그 방의 다른 멤버에게는 보이지 않는다
 * (heart_messages의 RLS는 보낸 사람·받는 사람에게만 열려 있다).
 */
function pickSelfRoom(rosters: RoomRoster[]): RoomRoster {
  const byJoinedAt = [...rosters].sort((a, b) =>
    a.joinedAt < b.joinedAt ? -1 : a.joinedAt > b.joinedAt ? 1 : 0,
  )

  return (
    byJoinedAt.find((roster) => roster.relationshipType === 'self') ??
    byJoinedAt.find((roster) => roster.activeCount === 1) ??
    byJoinedAt[0]
  )
}
