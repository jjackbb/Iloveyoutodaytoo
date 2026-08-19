'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { needsGuardianConsent } from '@/lib/age'
import { validateBirthDate } from '@/lib/birth-date'
import {
  clearLargeTextCookie,
  writeLargeTextCookie,
} from '@/lib/large-text'
import { safeNextPath } from '@/lib/safe-redirect'
import {
  USERNAME_RULE_HINT,
  normalizeUsername,
  resolveLoginEmail,
  usernameToEmail,
  validateUsername,
} from '@/lib/username'

export type AuthState = {
  error: string
  /**
   * 오류로 되돌아왔을 때 폼이 다시 채워 넣을 값.
   *
   * 왜 필요한가: React는 폼 액션이 끝나면 제어하지 않는 입력칸을 비운다.
   * 아이디 중복 하나 때문에 이름·보호자 칸·약관 체크가 통째로 지워져,
   * 시니어 사용자가 처음부터 다시 적어야 했다.
   *
   * **비밀번호는 절대 담지 않는다.** 서버가 돌려준 값이 화면 상태로 남고
   * 브라우저 개발자 도구에도 그대로 보인다.
   */
  values?: {
    name?: string
    username?: string
    guardianName?: string
    guardianPhone?: string
    agreed?: boolean
  }
} | null

/**
 * Supabase가 돌려준 인증 오류를 화면에 띄울 한국어 문구로 바꾼다.
 *
 * **원문을 절대 그대로 띄우지 않는다.** GoTrue는 `email_address_invalid` 같은 오류에서
 * 문제가 된 주소를 문구 안에 그대로 담아 돌려준다 —
 * `Email address "hong@id.oneuldo.local" is invalid` 같은 식이다.
 * 그 주소는 우리가 아이디에 붙여 만든 내부 주소(lib/username.ts)이고,
 * 사용자는 이메일을 적은 적이 없다. 화면에 뜨는 순간 "내가 왜 이 주소로
 * 가입돼 있지?"부터 묻게 된다. 그래서 여기서 전부 걸러낸다.
 *
 * 원문은 console.error로 서버 로그에만 남긴다 — 디버깅은 로그에서 한다.
 */
type SupabaseAuthError = { code?: string; message: string }

/** 중복 가입인가. 아이디가 곧 계정 주소라 Supabase는 이걸 "이미 등록된 사용자"로 돌려준다. */
function isDuplicateAccount({ code, message }: SupabaseAuthError): boolean {
  const lowered = message.toLowerCase()
  return (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    lowered.includes('already registered') ||
    lowered.includes('already been registered') ||
    lowered.includes('duplicate key')
  )
}

/** 서버가 몰려서 잠깐 막은 것인가. 다시 눌러보라고 말해도 되는 유일한 경우다. */
function isRateLimited({ code, message }: SupabaseAuthError): boolean {
  const lowered = message.toLowerCase()
  return (
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    lowered.includes('rate limit')
  )
}

function friendlySignUpError(error: SupabaseAuthError): string {
  const lowered = error.message.toLowerCase()

  /*
    users.username에도 unique가 걸려 있어 여기를 빠져나가도 DB가 한 번 더 막는다.
    "이메일"이라는 말은 꺼내지 않는다 — 적은 적이 없는 것이라 무슨 소린지 모른다.
  */
  if (isDuplicateAccount(error)) {
    return '이미 사용 중인 아이디예요. 다른 아이디로 만들어주세요.'
  }

  if (isRateLimited(error)) {
    return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
  }

  /*
    주소 형식 거절. `.local`은 RFC 6762가 예약한 이름이라 메일 주소 검사기가
    거절할 개연성이 있다. 사용자에게는 아이디 문제로만 말한다.
  */
  if (
    error.code === 'email_address_invalid' ||
    error.code === 'validation_failed' ||
    (lowered.includes('email') && lowered.includes('invalid'))
  ) {
    return `이 아이디로는 계정을 만들 수 없어요. ${USERNAME_RULE_HINT}인 다른 아이디로 만들어주세요.`
  }

  // 서버 쪽 비밀번호 규칙이 우리 8자 규칙보다 깐깐할 때.
  if (error.code === 'weak_password' || lowered.includes('password')) {
    return '비밀번호가 너무 약해요. 8자 이상으로, 영문과 숫자를 섞어 만들어주세요.'
  }

  if (
    error.code === 'signup_disabled' ||
    error.code === 'email_provider_disabled'
  ) {
    return '지금은 새로 가입할 수 없어요. 잠시 후 다시 시도해 주세요.'
  }

  return '가입 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'
}

/**
 * 로그인 (개발용 임시 수단 — Phase 2에서 카카오/구글/휴대폰으로 교체하고 제거한다)
 *
 * 화면은 아이디를 묻지만 Supabase Auth는 이메일로만 로그인한다.
 * 그 사이를 resolveLoginEmail이 메운다 — 아이디는 내부 이메일로 바꾸고,
 * `@`가 든 값(초기 개발 계정)은 이메일 그대로 넘긴다.
 */
export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const identifier = String(formData.get('username') ?? '')
  const password = String(formData.get('password') ?? '')
  const next = safeNextPath(formData.get('next'))

  // 아이디는 틀려서 되돌아와도 남겨준다 — 비밀번호만 틀렸는데 아이디까지
  // 다시 치게 하면 시니어 사용자에게는 두 번 실패한 것처럼 느껴진다.
  const keep = (message: string): AuthState => ({
    error: message,
    values: { username: identifier },
  })

  if (!identifier.trim() || !password) {
    return keep('아이디와 비밀번호를 모두 입력해주세요.')
  }

  const resolved = resolveLoginEmail(identifier)
  if ('error' in resolved) return keep(resolved.error)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: resolved.email,
    password,
  })

  if (error) {
    // 비밀번호가 틀린 것은 흔한 일이라 로그를 남기지 않는다.
    // 그 밖의 오류(주소 형식 거절 등)는 원문을 로그에만 남겨 원인을 추적한다.
    if (error.code !== 'invalid_credentials') {
      console.error('[로그인] signInWithPassword 실패:', error.code, error.message)
    }

    if (isRateLimited(error)) {
      return keep('요청이 너무 많아요. 잠시 후 다시 시도해 주세요.')
    }

    // 아이디가 있는지 없는지 알려주지 않는다 — 계정 존재 여부가 새어나가지 않게.
    return keep('아이디 또는 비밀번호가 맞지 않아요. 다시 확인해주세요.')
  }

  // 큰 글자 설정은 DB에 있지만 루트 레이아웃은 쿠키만 본다(@/lib/large-text).
  // 로그인하는 이 순간이 둘을 맞출 자리다 — 안 맞추면 새 기기에서 설정이 꺼진 채 보인다.
  await syncLargeTextCookie(supabase)

  revalidatePath('/', 'layout')
  redirect(next)
}

/**
 * 방금 로그인한 사람의 큰 글자 설정을 쿠키에 옮겨 적는다.
 *
 * 실패해도 로그인을 막지 않는다 — 글자 크기가 기본으로 보일 뿐이고,
 * 마이 화면의 토글을 한 번 누르면 다시 맞는다.
 */
async function syncLargeTextCookie(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data } = await supabase
    .from('users')
    .select('large_text')
    .eq('id', user.id)
    .maybeSingle()

  await writeLargeTextCookie(data?.large_text ?? false)
}

/** 회원가입 */
export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const name = String(formData.get('name') ?? '').trim()
  const username = normalizeUsername(formData.get('username'))
  const password = String(formData.get('password') ?? '')
  const birthDate = String(formData.get('birth_date') ?? '')
  const agreed = formData.get('agree_terms') === 'on'
  // 초대 링크를 받고 가입한 사람은 가입이 끝나면 그 초대장으로 돌아가야 한다.
  // 홈으로 떨어뜨리면 초대장을 잃어버려서 방에 못 들어간다.
  const next = safeNextPath(formData.get('next'))

  const guardianName = String(formData.get('guardian_name') ?? '').trim()
  const guardianPhone = String(formData.get('guardian_phone') ?? '').trim()

  /**
   * 되돌려보낼 값을 한 군데서 만든다.
   * 실패하는 자리가 열 곳쯤 되는데 각자 적으면 한 곳만 빠뜨려도
   * "그 오류일 때만 이름이 사라지는" 이상한 화면이 된다.
   * 비밀번호는 담지 않는다.
   */
  const fail = (message: string): AuthState => ({
    error: message,
    values: { name, username, guardianName, guardianPhone, agreed },
  })

  // 생년월일은 여기서 빼고 아래 validateBirthDate에 맡긴다 —
  // 그 칸만 비었을 때 "모든 항목을 입력해주세요" 대신 무엇이 비었는지 말해준다.
  if (!name || !username || !password) {
    return fail('모든 항목을 입력해주세요.')
  }

  // 아이디 규칙은 화면에서도 보지만 서버가 다시 본다.
  // 화면 검사는 거들 뿐이고, 여기가 진짜 관문이다.
  const usernameError = validateUsername(username)
  if (usernameError) return fail(usernameError)

  // 생년월일도 마찬가지다. 예전 달력 입력칸은 여섯 자리 연도를 그대로 통과시켰다.
  const birthDateError = validateBirthDate(birthDate)
  if (birthDateError) return fail(birthDateError)

  if (password.length < 8) {
    return fail('비밀번호는 8자 이상으로 만들어주세요.')
  }
  if (!agreed) {
    return fail('이용약관과 개인정보 처리방침에 동의해주세요.')
  }

  // 만 14세 미만은 법정대리인 동의가 있어야 가입할 수 있다 (개인정보보호법)
  const minor = needsGuardianConsent(birthDate)
  const guardianConsented = formData.get('guardian_consented') === 'on'

  if (minor && (!guardianName || !guardianPhone || !guardianConsented)) {
    return fail(
      '만 14세 미만은 법정대리인의 성함·연락처와 동의가 필요해요. 보호자와 함께 입력해주세요.',
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    // 사용자는 이메일을 적은 적이 없다. 아이디로 만든 내부 주소다(lib/username.ts).
    email: usernameToEmail(username),
    password,
    options: {
      data: {
        name,
        username,
        birth_date: birthDate,
        auth_provider: 'email',
        ...(minor
          ? {
              guardian_name: guardianName,
              guardian_phone: guardianPhone,
              guardian_consented: true,
            }
          : {}),
      },
    },
  })

  if (error) {
    // 원문은 로그에만. 화면에는 friendlySignUpError가 고른 문구만 나간다.
    console.error('[가입] signUp 실패:', error.code, error.message)
    return fail(friendlySignUpError(error))
  }

  /*
    이미 있는 아이디로 가입했을 때.

    Supabase(GoTrue)는 이 경우 **오류를 주지 않는다.** 계정이 있는지 없는지를
    밖에서 알아채지 못하게 하려고, 아무것도 만들지 않은 채 성공처럼 응답한다.
    그래서 여기서 걸러내지 않으면 "가입됐다"며 로그인 화면으로 튕겨,
    시니어 사용자는 무엇이 잘못됐는지 알 수 없다(실제로 그렇게 동작하고 있었다).

    구별하는 표시는 `identities`가 빈 배열인 것이다 — 진짜로 만들어졌으면
    로그인 수단이 최소 하나 붙어 나온다.

    우리는 이메일이 아니라 **아이디**를 쓰므로 "이미 쓰는 아이디"라고 알려준다.
    이메일과 달리 아이디는 연락처가 아니라서, 있는지 알려주는 편의 쪽이 크다.
  */
  if (data.user && data.user.identities?.length === 0) {
    return fail('이미 쓰고 있는 아이디예요. 다른 아이디로 만들어주세요.')
  }

  revalidatePath('/', 'layout')
  redirect(next)
}

/** 로그아웃 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // 큰 글자 설정은 사람에 붙는 값이다. 안 지우면 다음에 로그인한 사람이
  // 앞사람의 글자 크기를 그대로 물려받는다.
  await clearLargeTextCookie()

  revalidatePath('/', 'layout')
  redirect('/login')
}
