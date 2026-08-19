import { requireUser } from '@/lib/auth'
import { resolveRoomCover, roomDisplayName } from '@/lib/room-name'
import { createClient } from '@/lib/supabase/server'

/**
 * 방 하나를 **내 눈으로** 읽어오는 곳 (이름 + 커버).
 *
 * 규칙 자체는 @/lib/room-name에 있다. 여기는 DB에서 두 줄(rooms, 내 room_members)을
 * 한 번에 가져와 그 규칙에 넣어주는 일만 한다.
 *
 * 왜 방마다 이 함수를 부르나 — 방 이름을 보여주는 화면이 여덟 개쯤 된다(피드·갤러리·
 * 좋아요·숨김·초대·별명·설정·게시물 상세). 각 화면이 저마다 rooms.name을 읽으면,
 * 커스텀 이름을 한 화면만 빠뜨렸을 때 거기만 옛 이름으로 남는다.
 *
 * 이 파일은 **서버 전용**이다 — 클라이언트 부품에서 import 하지 마라
 * (@/lib/notifications와 같은 이유: 서버 Supabase 클라이언트가 브라우저 번들로 딸려 간다).
 */

export type MyRoomLook = {
  /** 내 화면에 보일 이름. 커스텀이 있으면 그것. */
  name: string
  /** 방을 만들 때 정해진 원래 이름. 설정 화면에서 "원래 이름"으로 안내한다. */
  originalName: string
  /** 방을 만들 때 정해진 커버. 설정 화면의 [원래대로] 타일이 이걸 보여준다. */
  originalCoverPreset: string | null
  originalCoverPath: string | null
  /** 내가 바꿔 부르는 이름. 안 정했으면 null. */
  customName: string | null
  /** 내 화면에 그릴 커버 프리셋 키. */
  coverPreset: string | null
  /** 내 화면에 그릴 커버 사진 경로(covers 버킷). 없으면 프리셋만 쓴다. */
  coverPath: string | null
  /** 내가 고른 프리셋(설정 화면에서 어느 타일이 선택 상태인지 표시용). */
  customCoverPreset: string | null
  /** 내가 올린 커버 사진 경로. */
  customCoverPath: string | null
}

const ROOM_LOOK_SELECT =
  'custom_name, custom_cover_preset, custom_cover_path, rooms(name, cover_preset, cover_path)' as const

/**
 * 못 읽으면 null. 방이 지워졌거나, 내가 그 방의 구성원이 아니거나(RLS), 조회가 실패한 경우다.
 * 셋을 구분하지 않는 이유: 화면이 할 일은 어느 쪽이든 같다 — 이름 자리를 비워두고 넘어간다.
 */
export async function loadMyRoomLook(
  roomId: string,
): Promise<MyRoomLook | null> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('room_members')
    .select(ROOM_LOOK_SELECT)
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    console.error('[방 이름] 조회 실패:', error.message)
    return null
  }
  if (!data?.rooms) return null

  const cover = resolveRoomCover({
    coverPreset: data.rooms.cover_preset,
    coverPath: data.rooms.cover_path,
    customCoverPreset: data.custom_cover_preset,
    customCoverPath: data.custom_cover_path,
  })

  return {
    name: roomDisplayName({
      name: data.rooms.name,
      customName: data.custom_name,
    }),
    originalName: data.rooms.name,
    originalCoverPreset: data.rooms.cover_preset,
    originalCoverPath: data.rooms.cover_path,
    customName: data.custom_name,
    coverPreset: cover.preset,
    coverPath: cover.path,
    customCoverPreset: data.custom_cover_preset,
    customCoverPath: data.custom_cover_path,
  }
}

/**
 * 머리띠 제목처럼 이름만 필요한 화면용.
 *
 * 못 읽었을 때 null을 돌려주는 것은 위와 같은 이유다 — 화면들이 이미
 * `roomName ?? '앨범방'` 꼴로 기본값을 각자 정해 쓰고 있다.
 */
export async function loadRoomName(roomId: string): Promise<string | null> {
  const look = await loadMyRoomLook(roomId)
  return look?.name ?? null
}

/** 내가 방 하나에 대해 정해둔 커스텀 값들. 원본(rooms)과 합치기 전의 재료다. */
export type MyRoomCustom = {
  customName: string | null
  customCoverPreset: string | null
  customCoverPath: string | null
}

/**
 * 내가 바꿔둔 값들을 방 번호로 찾아 쓰는 표.
 *
 * 사서함처럼 **여러 방의 이름·커버가 한 화면에 섞여 나오는** 곳에서 쓴다.
 * 방마다 따로 물으면 목록 길이만큼 왕복이 생긴다.
 *
 * 못 읽으면 빈 표를 준다 — 그러면 화면은 원래 이름과 원래 커버로 그려진다.
 * 비어 보이는 것보다 낫다.
 */
export async function loadMyRoomCustoms(): Promise<Map<string, MyRoomCustom>> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('room_members')
    .select('room_id, custom_name, custom_cover_preset, custom_cover_path')
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (error) {
    console.error('[방 이름] 커스텀 값 조회 실패:', error.message)
    return new Map()
  }

  const map = new Map<string, MyRoomCustom>()
  for (const row of data ?? []) {
    map.set(row.room_id, {
      customName: row.custom_name,
      customCoverPreset: row.custom_cover_preset,
      customCoverPath: row.custom_cover_path,
    })
  }
  return map
}
