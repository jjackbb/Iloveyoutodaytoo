/**
 * 아이디(로그인 식별자) 규칙과 내부 이메일 변환.
 *
 * 화면에서 묻는 것은 **아이디와 비밀번호**뿐이다. 이메일은 한 번도 보여주지 않는다.
 * 그런데 Supabase Auth는 이메일 + 비밀번호로만 로그인한다. 그래서 관례대로
 * 아이디를 우리끼리만 쓰는 이메일 한 개로 바꿔서 넘긴다.
 *
 *   아이디 hongildong  →  hongildong@id.oneuldo.local
 *
 * 도메인을 `.local`로 잡은 이유: RFC 6762가 예약한 이름이라 인터넷에 존재할 수 없다.
 * 누가 그 도메인을 사서 우리 계정 메일을 가로채는 일이 원천적으로 불가능하다.
 * (가입 확인 메일은 Supabase 설정에서 꺼져 있어 실제로 메일이 나가지도 않는다.)
 *
 * 이 파일은 서버·브라우저 양쪽에서 쓴다. 서버 전용 모듈을 import하지 않는다.
 */

export const USERNAME_MIN_LENGTH = 4
export const USERNAME_MAX_LENGTH = 16

/**
 * 영문 소문자와 숫자만, 4~16자.
 *
 * 한글 아이디를 허용하지 않은 이유:
 * 아이디는 그대로 이메일 주소의 앞부분(local-part)이 된다. 이메일 주소의 앞부분은
 * ASCII만 쓸 수 있어서(SMTPUTF8은 Supabase Auth가 쓰지 않는다) 한글을 넣으면
 * 가입 요청이 주소 형식 오류로 거절된다. 화면에서 막지 않으면 사용자는 이유를
 * 알 수 없는 오류만 보게 된다. 그래서 애초에 규칙으로 못 박는다.
 * 대문자를 빼는 것도 같은 맥락이다 — 이메일 앞부분은 서버에 따라 대소문자를
 * 구분하기도 해서, 'Hong'과 'hong'이 다른 계정이 되는 사고를 막는다.
 */
export const USERNAME_PATTERN = /^[a-z0-9]{4,16}$/

/** 아이디를 붙일 내부 전용 도메인. 이 값이 바뀌면 기존 계정이 로그인하지 못한다. */
export const USERNAME_EMAIL_DOMAIN = 'id.oneuldo.local'

/** 화면에 보여줄 아이디 규칙 한 줄. 폼 안내와 오류 문구가 어긋나지 않게 한곳에 둔다. */
export const USERNAME_RULE_HINT = `영문 소문자와 숫자로 ${USERNAME_MIN_LENGTH}~${USERNAME_MAX_LENGTH}자`

/** 입력값을 저장·비교에 쓸 형태로 다듬는다. 앞뒤 공백을 없애고 소문자로 맞춘다. */
export function normalizeUsername(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

/**
 * 아이디가 규칙에 맞는지 본다.
 * 맞으면 null, 아니면 그대로 화면에 띄울 수 있는 한국어 문구를 돌려준다.
 */
export function validateUsername(username: string): string | null {
  if (!username) return '아이디를 입력해주세요.'

  if (/[^a-z0-9]/.test(username)) {
    return '아이디는 영문 소문자와 숫자만 쓸 수 있어요. (한글·대문자·특수문자 불가)'
  }
  if (
    username.length < USERNAME_MIN_LENGTH ||
    username.length > USERNAME_MAX_LENGTH
  ) {
    return `아이디는 ${USERNAME_MIN_LENGTH}자에서 ${USERNAME_MAX_LENGTH}자 사이로 만들어주세요.`
  }
  if (!USERNAME_PATTERN.test(username)) {
    return `아이디는 ${USERNAME_RULE_HINT}로 만들어주세요.`
  }
  return null
}

/** 아이디 → Supabase Auth에 넘길 내부 이메일. */
export function usernameToEmail(username: string): string {
  return `${username}@${USERNAME_EMAIL_DOMAIN}`
}

/**
 * 우리가 만들어 붙인 내부 이메일인지 본다.
 *
 * 이 주소는 사람에게 절대 보여주지 않는다 — 사용자는 자기 이메일을 적은 적이 없는데
 * 화면에 이메일이 떠 있으면 그것부터가 오해다.
 */
export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email.toLowerCase().endsWith(`@${USERNAME_EMAIL_DOMAIN}`)
}

/**
 * 내부 이메일에서 아이디만 도로 꺼낸다. 우리가 만든 주소가 아니면 null.
 *
 * `users.username` 이 비어 있는데 계정 주소는 내부 주소인 경우를 위한 안전망이다.
 * (가입 트리거가 username을 넣어주므로 정상 경로에서는 생기지 않는다. 다만
 * 그 트리거 하나에 "합성 주소가 화면에 안 뜬다"를 통째로 걸어두지 않으려고 둔다.)
 * 화면은 이 값을 아이디로 보여주면 되고, 어떤 경우에도 주소 전체를 보여주지 않는다.
 */
export function usernameFromEmail(email: string | null | undefined): string | null {
  if (!isInternalEmail(email)) return null
  return String(email).toLowerCase().split('@')[0] || null
}

/**
 * 로그인 입력칸에 적힌 값을 Supabase에 넘길 이메일로 바꾼다.
 *
 * 개발 초기에 이메일로 만든 계정(dev 계정)이 아직 남아 있다. 그분들이 갑자기
 * 로그인하지 못하면 안 되므로, `@`가 들어 있으면 이메일을 그대로 쓴다.
 * `@`가 없으면 아이디로 보고 규칙 검사를 거친 뒤 내부 이메일로 바꾼다.
 */
export function resolveLoginEmail(
  raw: string,
): { email: string } | { error: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { error: '아이디를 입력해주세요.' }

  // 기존 이메일 계정용 통로. 새로 만드는 계정은 이 길로 오지 않는다.
  if (trimmed.includes('@')) return { email: trimmed.toLowerCase() }

  const username = normalizeUsername(trimmed)
  const error = validateUsername(username)
  if (error) return { error }

  return { email: usernameToEmail(username) }
}
