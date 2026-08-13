'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth'
import { COVER_PRESET_LIST, isCoverPreset } from '@/lib/covers'
import { ROOM_NAME_MAX_LENGTH } from '@/lib/limits'
import { createClient } from '@/lib/supabase/server'

/**
 * 앨범방 만들기 Server Action.
 *
 * 여기서 하는 일은 rooms 테이블에 한 줄 넣는 것뿐이다.
 * 방장을 멤버(admin)로 등록하는 것도, 그 멤버의 스트릭 레코드를 만드는 것도
 * DB 트리거(add_owner_as_member → create_streak_for_member)가 이미 해준다.
 * 코드로 또 넣으면 중복 등록이 되므로 절대 하지 않는다. (02_DATA_MODEL.md)
 *
 * 관계유형("어떤 사이인가요?")은 캡처 기준 개정으로 더 이상 묻지 않는다
 * (_workspace/03_capture_flow.md). rooms.relationship_type은 nullable이 됐고
 * 새 방은 값을 넣지 않는다 — 컬럼은 기존 방의 값 때문에 남겨 둔다.
 */

/*
 * 방 이름 최대 길이(ROOM_NAME_MAX_LENGTH)는 @/lib/limits 에 있다.
 * 'use server' 파일은 async 함수만 export할 수 있어서 여기에 둘 수 없다.
 */

export type CreateRoomState = {
  /** 사용자에게 보여줄 따뜻한 안내 문구 */
  error: string
  /** 어느 입력칸 아래에 보여줄지. 없으면 폼 전체 오류로 본다. */
  field?: 'name' | 'cover'
} | null

/** 직접 올린 커버로 받아줄 형식·크기. covers 버킷 설정과 같은 값이다. */
const COVER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const COVER_MAX_BYTES = 5 * 1024 * 1024

export async function createRoom(
  _prev: CreateRoomState,
  formData: FormData,
): Promise<CreateRoomState> {
  // Server Action은 폼 밖에서도 호출될 수 있으므로 여기서 다시 로그인을 확인한다.
  const user = await requireUser()

  const name = String(formData.get('name') ?? '').trim()
  const cover = String(formData.get('cover_preset') ?? '')
  const coverFile = formData.get('cover_file')

  if (!name) {
    return { error: '앨범방 이름을 입력해주세요.', field: 'name' }
  }
  if (name.length > ROOM_NAME_MAX_LENGTH) {
    return {
      error: `앨범방 이름은 ${ROOM_NAME_MAX_LENGTH}자까지 쓸 수 있어요.`,
      field: 'name',
    }
  }

  // 직접 올린 사진은 방을 만든 뒤에 올려야 한다(아래 참고). 여기서는 형식만 먼저 본다.
  const upload =
    coverFile instanceof File && coverFile.size > 0 ? coverFile : null

  if (upload) {
    if (!COVER_MIME_TYPES.includes(upload.type)) {
      return {
        error: '커버 사진은 JPG·PNG·WEBP만 올릴 수 있어요.',
        field: 'cover',
      }
    }
    if (upload.size > COVER_MAX_BYTES) {
      return {
        error: '커버 사진이 너무 커요. 다시 잘라서 올려주세요.',
        field: 'cover',
      }
    }
  }

  const supabase = await createClient()

  // 이름 중복은 일부러 막지 않는다. 캡처 흐름에도 막는 곳이 없다.
  const { data: room, error } = await supabase
    .from('rooms')
    .insert({
      name,
      // 고르지 않았으면 첫 번째 프리셋. 캡처 06도 첫 타일이 미리 골라져 있다.
      // 없는 키를 보내면 DB 제약(rooms_cover_preset_check)이 막고 방 만들기가 통째로 실패하므로
      // 여기서 한 번 걸러 낸다 — 폼에서 온 값을 그대로 믿지 않는다.
      cover_preset: isCoverPreset(cover) ? cover : COVER_PRESET_LIST[0].key,
      // 관계유형은 더 이상 넣지 않는다. DB에서 nullable로 바꿔 뒀다.
      relationship_type: null,
      // RLS가 owner_id = auth.uid()를 요구한다. 반드시 직접 넣어줘야 한다.
      owner_id: user.id,
    })
    .select('id')
    .single()

  if (error || !room) {
    // 사용자에게는 부드럽게 안내하되, 원인은 서버 로그에 남긴다. 조용히 삼키면 고칠 수가 없다.
    console.error(
      '[앨범방 만들기] rooms insert 실패:',
      error?.message ?? '반환된 방이 없음',
    )
    return { error: '앨범방을 만들지 못했어요. 잠시 후 다시 시도해주세요.' }
  }

  /*
    커버 사진은 **방을 만든 뒤에** 올린다.

    covers 버킷의 INSERT 정책이 `is_room_member(path_uuid(name))`이라,
    경로 맨 앞의 방 id가 "내가 속한 방"이어야 통과한다.
    방이 생기기 전에는 그 조건을 만족시킬 방법이 없다.
    방을 만들면 트리거가 나를 곧바로 멤버로 넣어주므로 이 시점에는 통과한다.

    올리다 실패해도 방 만들기 자체를 되돌리지 않는다 —
    커버는 프리셋으로 남고, 사용자는 방 설정에서 다시 올릴 수 있다.
    여기서 방을 지우면 "다 만들었는데 사라졌다"가 되어 훨씬 나쁘다.
  */
  if (upload) {
    const extension = upload.type === 'image/png' ? 'png' : 'jpg'
    const path = `${room.id}/cover-${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(path, upload, { contentType: upload.type, upsert: false })

    if (uploadError) {
      console.error('[앨범방 만들기] 커버 업로드 실패:', uploadError.message)
    } else {
      const { error: linkError } = await supabase
        .from('rooms')
        .update({ cover_path: path })
        .eq('id', room.id)

      if (linkError) {
        console.error(
          '[앨범방 만들기] cover_path 연결 실패:',
          linkError.message,
        )
      }
    }
  }

  // 홈의 앨범방 목록을 새로 그리게 한다.
  revalidatePath('/')

  // redirect는 내부적으로 예외를 던진다. try/catch로 감싸지 않도록 주의.
  redirect(`/rooms/${room.id}?created=1`)
}

/**
 * 홈 카드 오른쪽 위 ♡ 즐겨찾기 토글 (캡처 37).
 *
 * 즐겨찾기는 방이 아니라 **나와 이 방의 관계**에 붙는다. 그래서 rooms가 아니라
 * room_members에 둔다 — 같은 방이라도 사람마다 다르다.
 *
 * 다음 상태를 클라이언트가 계산해 보내지 않고 여기서 읽어서 뒤집는다.
 * 화면이 들고 있던 값이 실제와 어긋나 있으면 눌러도 안 바뀌는 것처럼 보이기 때문이다.
 */
export async function toggleRoomFavorite(roomId: string): Promise<void> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: membership, error: readError } = await supabase
    .from('room_members')
    .select('id, favorited')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (readError || !membership) {
    console.error(
      '[즐겨찾기] 내 멤버십을 못 읽었다:',
      readError?.message ?? '해당 방의 멤버가 아님',
    )
    return
  }

  const { error: writeError } = await supabase
    .from('room_members')
    .update({ favorited: !membership.favorited })
    .eq('id', membership.id)

  if (writeError) {
    console.error('[즐겨찾기] 저장 실패:', writeError.message)
    return
  }

  // 목록 순서가 바뀌므로 홈을 서버에서 다시 그린다.
  // 클라이언트가 목록을 직접 고쳐 정렬하지 않는다 — 그 방식이 이 프로젝트를 한 번 엎었다.
  revalidatePath('/')
}
