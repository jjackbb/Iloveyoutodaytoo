'use server'

import { createClient } from '@/lib/supabase/server'
import { normalizeUsername, validateUsername } from '@/lib/username'

/**
 * 아이디가 이미 쓰이고 있는지 본다 — 가입 화면의 [중복확인].
 *
 * ## 왜 서버 액션인가
 *
 * users 테이블은 로그인한 사람에게만, 그것도 "본인이거나 같은 방 사람"만 보인다.
 * 가입 화면은 로그인 전(anon)이라 화면에서 직접 조회할 방법이 없다.
 * 그래서 DB에 **있다/없다 한 가지만** 돌려주는 함수를 두고(username_taken)
 * 여기서 부른다. 이름·생년월일 같은 다른 값은 절대 나가지 않는다.
 * (마이그레이션: username_taken_lookup, 사용자 승인 2026-08-25)
 *
 * ## 이것이 중복을 막는 장치는 아니다
 *
 * 여기서 "쓸 수 있어요"가 나와도 **제출하는 순간까지 비어 있으리란 보장은 없다** —
 * 그 사이에 다른 사람이 같은 아이디로 가입할 수 있다. 진짜 방어선은
 * users.username 의 unique 제약과 signUp 의 중복 처리다.
 * 이 함수는 **미리 알려주는 것**이지 막는 것이 아니다.
 */
export type UsernameCheck =
  | { status: 'available' }
  | { status: 'taken' }
  /** 형식이 틀려서 물어볼 것도 없는 경우. message 를 그대로 보여주면 된다. */
  | { status: 'invalid'; message: string }
  /** 네트워크·DB 문제. 이때는 "확인됨"으로 넘어가면 안 된다. */
  | { status: 'error' }

export async function checkUsername(raw: string): Promise<UsernameCheck> {
  const username = normalizeUsername(raw)

  // 형식이 틀리면 DB까지 갈 필요가 없다. 규칙은 가입 때와 같은 것을 쓴다 —
  // 여기서 통과한 아이디가 제출에서 걸리면 사용자는 이유를 알 수 없다.
  const formatError = validateUsername(username)
  if (formatError) return { status: 'invalid', message: formatError }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('username_taken', {
    p_username: username,
  })

  if (error) {
    console.error('[아이디 중복확인] 조회 실패:', error.message)
    // 모르면 "쓸 수 있다"고 하지 않는다. 모른다고 말한다.
    return { status: 'error' }
  }

  return data ? { status: 'taken' } : { status: 'available' }
}
