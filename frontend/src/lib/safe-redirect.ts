/**
 * 로그인·가입 뒤에 돌아갈 주소(?next=)를 안전하게 걸러낸다.
 *
 * 왜 필요한가:
 * 이 서비스의 초대 링크는 문자·카톡으로 오간다. 로그인 화면 주소에 ?next= 를 붙여
 * 보내는 것만으로 가입 직후 아무 데나 보낼 수 있으면 피싱에 그대로 쓰인다.
 *
 * `next.startsWith('/')` 검사만으로는 부족하다:
 *   '//evil.com'      → 슬래시로 시작하지만 브라우저는 프로토콜 상대 URL로 읽어 외부로 나간다
 *   '/\evil.com'      → 일부 브라우저가 역슬래시를 슬래시처럼 다룬다
 * 그래서 우리 사이트 안의 경로가 확실할 때만 통과시키고, 아니면 홈으로 보낸다.
 */

/** 안전하지 않은 값이 들어왔을 때 돌아갈 기본 주소. */
const FALLBACK = '/'

export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string') return FALLBACK

  const next = value.trim()

  // 반드시 '/' 하나로 시작해야 한다. '//' 와 '/\' 는 외부로 나가는 길이다.
  if (!next.startsWith('/')) return FALLBACK
  if (next.startsWith('//') || next.startsWith('/\\')) return FALLBACK

  // 'javascript:' 같은 스킴이 섞여 들어올 여지를 남기지 않는다.
  if (next.includes(':')) return FALLBACK

  return next
}
