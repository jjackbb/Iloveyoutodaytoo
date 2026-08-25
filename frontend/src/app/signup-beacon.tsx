'use client'

import { useEffect } from 'react'

import { track } from '@/lib/analytics'
import { SIGNUP_DONE_COOKIE } from '@/lib/signup-done'

/**
 * 가입 완료를 GA4에 한 번만 알리는 조각.
 *
 * 가입 서버액션은 성공하면 곧바로 다른 화면으로 보내버려서, 폼은 "성공했다"를
 * 볼 기회가 없다. 그래서 서버가 쿠키에 잠깐 적어두고, 도착한 화면에서 이 조각이
 * 그걸 집어 이벤트를 보낸 뒤 **곧바로 지운다.** 지우지 않으면 새로고침할 때마다
 * 가입이 또 일어난 것처럼 세어져 퍼널이 부풀어 오른다.
 *
 * 화면에는 아무것도 그리지 않는다.
 */
export function SignupBeacon() {
  useEffect(() => {
    const hit = document.cookie
      .split('; ')
      .find((one) => one.startsWith(`${SIGNUP_DONE_COOKIE}=`))
    if (!hit) return

    document.cookie = `${SIGNUP_DONE_COOKIE}=; Max-Age=0; path=/`
    track('signup_complete', { minor: hit.slice(SIGNUP_DONE_COOKIE.length + 1) === 'minor' })
  }, [])

  return null
}
