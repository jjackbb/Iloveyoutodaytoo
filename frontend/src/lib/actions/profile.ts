'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth'
import { AVATAR_BUCKET, avatarPath } from '@/lib/avatars'
import { PASSWORD_MIN_LENGTH } from '@/lib/limits'
import { createClient } from '@/lib/supabase/server'
import { usernameToEmail } from '@/lib/username'

/**
 * 내 정보 화면(/my/profile)의 Server Action 세 개.
 *
 *   updateProfileImage  프로필 사진 올리기 (브라우저에서 이미 1:1로 자른 파일만 받는다)
 *   removeProfileImage  프로필 사진 지우고 기본 그림으로 되돌리기
 *   changePassword      비밀번호 바꾸기 (기존 비밀번호를 반드시 먼저 확인한다)
 *
 * 상수를 여기 두지 않은 이유: 'use server' 파일은 async 함수만 export할 수 있다.
 * 화면과 함께 써야 하는 값(PASSWORD_MIN_LENGTH)은 @/lib/limits 에 있다.
 */

/** 프로필 사진으로 받아줄 형식·크기. avatars 버킷 설정과 같은 값이다. */
const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AVATAR_MAX_BYTES = 5 * 1024 * 1024

/** 사진이 바뀌면 다시 그려야 하는 화면들. 마이 카드와 내 정보가 같은 값을 보여준다. */
const AVATAR_SCREENS = ['/my', '/my/profile']

function revalidateAvatarScreens(): void {
  for (const path of AVATAR_SCREENS) revalidatePath(path)
}

/**
 * 쓰이지 않게 된 옛 사진 파일을 지운다.
 *
 * 물리 삭제를 피하는 프로젝트 규칙(방 나가기·차단은 상태값만 바꾼다)과 어긋나지 않는다.
 * 그 규칙이 지키려는 것은 **상대에게 남아 있어야 할 기록**이다. 옛 프로필 사진은
 * 아무 행도 가리키지 않는 파일이라 남겨두면 누구도 볼 수 없는 채로 용량만 차지하고,
 * 처리방침이 약속한 "필요 없어진 개인정보는 지운다"에도 어긋난다.
 *
 * 실패해도 되돌리지 않는다 — 사진 바꾸기 자체는 이미 끝났고, 남은 파일은
 * 아무 데서도 참조되지 않는다. 나중에 정리할 수 있도록 로그만 남긴다.
 */
async function removeAvatarFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null | undefined,
): Promise<void> {
  if (!path) return
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path])
  if (error) {
    console.error('[프로필 사진] 옛 파일 삭제 실패:', error.message)
  }
}

export type ProfileImageState =
  | { status: 'error'; message: string }
  | { status: 'done'; message: string }
  | null

/**
 * 프로필 사진 올리기.
 *
 * 자르기는 브라우저에서 끝난 상태로 온다(avatar-crop-dialog). 여기서는 형식과
 * 크기만 다시 본다 — 폼에서 온 값을 그대로 믿지 않는다.
 *
 * 순서에 이유가 있다: 먼저 올리고, DB를 고치고, 그 다음에 옛 파일을 지운다.
 * 반대로 하면 DB 갱신이 실패했을 때 사용자는 사진을 통째로 잃는다.
 */
export async function updateProfileImage(
  _prev: ProfileImageState,
  formData: FormData,
): Promise<ProfileImageState> {
  // 폼 밖에서도 불릴 수 있는 통로다. 서버에서 로그인을 다시 확인한다.
  const user = await requireUser()

  const picked = formData.get('avatar_file')
  const file = picked instanceof File && picked.size > 0 ? picked : null

  if (!file) {
    return { status: 'error', message: '사진을 다시 골라주세요.' }
  }
  if (!AVATAR_MIME_TYPES.includes(file.type)) {
    return {
      status: 'error',
      message: '프로필 사진은 JPG·PNG·WEBP만 올릴 수 있어요.',
    }
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return {
      status: 'error',
      message: '사진이 너무 커요. 다시 잘라서 올려주세요.',
    }
  }

  const supabase = await createClient()

  /*
    경로 맨 앞이 내 user id여야 avatars_write 정책(path_uuid(name) = auth.uid())을 통과한다.
    upsert를 쓰지 않고 매번 새 이름으로 올린다 — 같은 이름에 덮어쓰면 CDN·브라우저가
    옛 사진을 계속 보여주는 일이 생긴다. 옛 파일은 아래에서 따로 지운다.
  */
  const path = avatarPath(user.id)
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[프로필 사진] 업로드 실패:', uploadError.message)
    return {
      status: 'error',
      message: '사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.',
    }
  }

  const { error: linkError } = await supabase
    .from('users')
    .update({ profile_image: path })
    .eq('id', user.id)

  if (linkError) {
    console.error('[프로필 사진] profile_image 갱신 실패:', linkError.message)
    // 아무도 가리키지 않게 된 파일을 그대로 두지 않는다.
    await removeAvatarFile(supabase, path)
    return {
      status: 'error',
      message: '사진을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
    }
  }

  await removeAvatarFile(supabase, user.profile_image)

  revalidateAvatarScreens()

  return { status: 'done', message: '프로필 사진을 바꿨어요.' }
}

/**
 * 프로필 사진 지우기 — 기본 그림(하트)으로 되돌린다.
 *
 * 사진이 없으면 화면에서 이 버튼 자체를 그리지 않는다. 그래도 서버에서 한 번 더
 * 확인한다(경로가 비어 있으면 아무 일도 하지 않는다).
 *
 * 마지막에 /my/profile 로 다시 보내는 이유: 이 동작은 확인 단계(?remove=1)를 거쳐
 * 들어온다. 주소에 그 표시가 남아 있으면 새로고침할 때마다 확인 화면이 다시 뜬다.
 */
export async function removeProfileImage(): Promise<void> {
  const user = await requireUser()

  if (user.profile_image) {
    const supabase = await createClient()

    const { error } = await supabase
      .from('users')
      .update({ profile_image: null })
      .eq('id', user.id)

    if (error) {
      // 화면에는 사진이 그대로 남는다. 사용자가 다시 눌러볼 수 있다.
      console.error('[프로필 사진] 지우기 실패:', error.message)
    } else {
      await removeAvatarFile(supabase, user.profile_image)
      revalidateAvatarScreens()
    }
  }

  // redirect는 내부적으로 예외를 던진다. try/catch로 감싸지 않도록 주의.
  redirect('/my/profile')
}

export type PasswordState =
  | {
      status: 'error'
      message: string
      /** 어느 칸 아래에 보여줄지. 없으면 폼 전체 오류로 본다. */
      field?: 'current' | 'next' | 'confirm'
    }
  | { status: 'done'; message: string }
  | null

/**
 * 비밀번호 바꾸기.
 *
 * `supabase.auth.updateUser({ password })` 하나만 쓰면 **기존 비밀번호를 묻지 않고**
 * 바뀐다. 로그인한 기기를 잠깐 두고 자리를 비운 사이 남이 비밀번호를 갈아치울 수 있다는 뜻이다.
 * 그래서 기존 비밀번호로 **다시 로그인해 보는 것**으로 본인 확인을 대신한다 —
 * 아이디/비밀번호 계정에서 서버가 기존 비밀번호를 검증할 수 있는 유일한 방법이다.
 *
 * 로그인에 쓰는 주소는 아이디를 바꿔 만든 내부 주소다(lib/username.ts).
 * 그 규칙을 여기서 다시 적지 않고 usernameToEmail을 그대로 쓴다.
 */
export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const user = await requireUser()

  const current = String(formData.get('current_password') ?? '')
  const next = String(formData.get('new_password') ?? '')
  const confirm = String(formData.get('confirm_password') ?? '')

  if (!current || !next || !confirm) {
    return {
      status: 'error',
      message: '세 칸을 모두 채워주세요.',
    }
  }
  if (next !== confirm) {
    return {
      status: 'error',
      message: '새 비밀번호와 확인이 서로 달라요. 다시 적어주세요.',
      field: 'confirm',
    }
  }
  if (next.length < PASSWORD_MIN_LENGTH) {
    return {
      status: 'error',
      message: `새 비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상으로 만들어주세요.`,
      field: 'next',
    }
  }
  if (next === current) {
    return {
      status: 'error',
      message: '지금 쓰고 계신 비밀번호와 같아요. 다른 비밀번호로 바꿔주세요.',
      field: 'next',
    }
  }

  const supabase = await createClient()

  /*
    로그인 주소를 정한다.

    Auth가 실제로 들고 있는 주소(getUser().email)가 가장 정확하다.
    혹시 비어 있으면 아이디에서 내부 주소를 만들어 쓴다 — 가입 때와 같은 규칙이다.
    둘 다 없으면 기존 비밀번호를 확인할 방법이 없으므로 아예 진행하지 않는다.
  */
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  const loginEmail =
    authUser?.email ??
    (user.username ? usernameToEmail(user.username) : (user.email ?? null))

  if (!loginEmail) {
    console.error('[비밀번호 변경] 로그인 주소를 찾지 못했다:', user.id)
    return {
      status: 'error',
      message:
        '지금은 비밀번호를 바꿀 수 없어요. 문의하기로 알려주시면 도와드릴게요.',
    }
  }

  // 1) 기존 비밀번호가 맞는지 — 실제로 로그인해 본다.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password: current,
  })

  if (verifyError) {
    // 비밀번호를 틀리는 것은 흔한 일이라 로그를 남기지 않는다. 그 밖의 오류만 남긴다.
    if (verifyError.code !== 'invalid_credentials') {
      console.error(
        '[비밀번호 변경] 기존 비밀번호 확인 실패:',
        verifyError.code,
        verifyError.message,
      )
    }
    if (verifyError.message.toLowerCase().includes('rate limit')) {
      return {
        status: 'error',
        message: '시도가 너무 잦아요. 잠시 후 다시 해주세요.',
      }
    }
    return {
      status: 'error',
      message: '지금 쓰고 계신 비밀번호가 맞지 않아요. 다시 확인해주세요.',
      field: 'current',
    }
  }

  // 2) 확인이 끝났으니 새 비밀번호로 바꾼다.
  const { error: updateError } = await supabase.auth.updateUser({
    password: next,
  })

  if (updateError) {
    console.error(
      '[비밀번호 변경] updateUser 실패:',
      updateError.code,
      updateError.message,
    )
    if (updateError.code === 'same_password') {
      return {
        status: 'error',
        message: '지금 쓰고 계신 비밀번호와 같아요. 다른 비밀번호로 바꿔주세요.',
        field: 'next',
      }
    }
    if (updateError.code === 'weak_password') {
      return {
        status: 'error',
        message:
          '새 비밀번호가 너무 쉬워요. 영문과 숫자를 섞어 다시 만들어주세요.',
        field: 'next',
      }
    }
    return {
      status: 'error',
      message: '비밀번호를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.',
    }
  }

  return {
    status: 'done',
    message: '비밀번호를 바꿨어요. 다음 로그인부터 새 비밀번호를 써주세요.',
  }
}
