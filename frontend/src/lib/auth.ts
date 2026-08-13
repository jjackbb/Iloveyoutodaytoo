import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

export type AppUser = Tables<'users'>

/**
 * 지금 로그인한 사람의 프로필. 로그인 안 했으면 null.
 *
 * proxy.ts에서도 리디렉트를 하지만 그건 편의용이다.
 * 서버에서 데이터를 다룰 때는 반드시 여기서 다시 확인한다.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile ?? null
}

/** 로그인이 필수인 화면에서 쓴다. 로그인 안 했으면 /login으로 보낸다. */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

// 나이 계산은 브라우저에서도 써야 해서 서버 전용이 아닌 곳에 두었다.
export { calculateAge, needsGuardianConsent } from '@/lib/age'
