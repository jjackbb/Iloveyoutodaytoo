/**
 * 가입 흐름에서 서버와 브라우저가 **같은 말을 써야 하는 것들**.
 *
 * `lib/actions/auth.ts` 는 `'use server'` 라 함수 말고는 내보낼 수 없어서
 * 여기 따로 뒀다.
 */

/** 가입 직후 딱 한 번, 브라우저에 "방금 가입했다"를 알리는 쿠키 이름. */
export const SIGNUP_DONE_COOKIE = 'oneuldo-signup-done'

/**
 * 가입 폼에서 막힐 수 있는 칸.
 *
 * 서버가 "어디서 막혔는지"를 이 이름으로 돌려주고, 브라우저가 같은 이름으로
 * GA4에 보낸다(`signup_field_error`). 한 곳에서 정해야 둘이 어긋나지 않는다.
 */
export type SignupField =
  | 'username'
  | 'password'
  | 'name'
  | 'birth_date'
  | 'guardian'
  | 'terms'
