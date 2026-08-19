/**
 * 이 방을 **내 화면에서** 뭐라고 부르고 어떤 커버로 보일지 정하는 단 한 곳.
 *
 * 규칙은 하나다: **내가 정한 값이 있으면 그것, 없으면 방을 만들 때 정해진 값.**
 *
 * 왜 이런 구조인가 — 카카오톡 단체방과 같다. 처음 만든 사람이 이름과 커버를 정해두고,
 * 그 뒤로는 각자 자기 화면에서만 바꿔 부른다. 내가 바꾼 이름이 남의 화면까지 바뀌면
 * "어제까지 있던 방이 없어졌다"가 된다 — 특히 주 사용자가 시니어라 더 그렇다.
 * 그래서 커스텀 값은 rooms가 아니라 room_members(사람×방 한 줄)에 있다.
 *
 * 이름을 고르는 규칙을 한 곳에만 두는 이유는 @/lib/member-name과 같다.
 * 홈에서는 내가 바꾼 이름, 방 안 머리띠에서는 원래 이름으로 보이면 두 화면이
 * 서로 다른 방 얘기를 하는 것처럼 읽힌다.
 *
 * 이 파일은 서버·클라이언트 어디서나 쓸 수 있어야 해서 순수 함수만 둔다.
 * DB를 읽는 쪽은 @/lib/room-look 이다.
 */

/** 방 이름을 못 읽은 경우(지워졌거나 RLS에 막힌 경우). */
const UNKNOWN_ROOM = '앨범방'

export type RoomLookSource = {
  /** rooms.name — 방을 만들 때 정해진 이름. */
  name?: string | null
  /** room_members.custom_name — 내가 내 화면에서만 바꿔 부르는 이름. */
  customName?: string | null
}

export function roomDisplayName(input: RoomLookSource): string {
  // DB CHECK가 앞뒤 공백을 막지만, 옛 데이터까지 믿지는 않는다.
  const custom = input.customName?.trim()
  if (custom) return custom

  const name = input.name?.trim()
  if (name) return name

  return UNKNOWN_ROOM
}

export type RoomCoverSource = {
  /** rooms.cover_preset */
  coverPreset?: string | null
  /** rooms.cover_path */
  coverPath?: string | null
  /** room_members.custom_cover_preset */
  customCoverPreset?: string | null
  /** room_members.custom_cover_path */
  customCoverPath?: string | null
}

/**
 * 내 화면에 그릴 커버 한 벌.
 *
 * 우선순위: 내가 올린 사진 → 내가 고른 프리셋 → 방의 사진 → 방의 프리셋.
 *
 * 내가 **프리셋을 골랐으면** 방에 올라와 있는 사진보다 그것이 이긴다.
 * 프리셋을 고른 행동 자체가 "그 사진 말고 이 색으로 보겠다"는 뜻이기 때문이다.
 * (그래서 이때 path는 null로 내려간다 — 사진 주소를 같이 넘기면 사진이 이겨버린다)
 */
export function resolveRoomCover(input: RoomCoverSource): {
  preset: string | null
  path: string | null
} {
  if (input.customCoverPath) {
    return { preset: input.customCoverPreset ?? null, path: input.customCoverPath }
  }
  if (input.customCoverPreset) {
    return { preset: input.customCoverPreset, path: null }
  }
  return { preset: input.coverPreset ?? null, path: input.coverPath ?? null }
}
