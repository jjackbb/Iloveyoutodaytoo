import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

/**
 * 로그인한 본인의 정보 = 방 참여자에게 보이는 프로필(users) + 본인만 읽는 계정 정보(user_private).
 * 2026-09-26 새 DB에서 둘을 나눴다 — 방 사람에게 생년월일·보호자 연락처가 새지 않게.
 * 본인 화면에서는 예전처럼 한 덩어리로 쓴다.
 */
export type AppUser = Tables<'users'> & Omit<Tables<'user_private'>, 'id'>

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

  const [{ data: profile }, { data: account }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('user_private').select('*').eq('id', user.id).single(),
  ])

  if (!profile || !account) return null
  return { ...account, ...profile }
}

/** 로그인이 필수인 화면에서 쓴다. 로그인 안 했으면 /login으로 보낸다. */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

// 나이 계산은 브라우저에서도 써야 해서 서버 전용이 아닌 곳에 두었다.
export { calculateAge, needsGuardianConsent } from '@/lib/age'
