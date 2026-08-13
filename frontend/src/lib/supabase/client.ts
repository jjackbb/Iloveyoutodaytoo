import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/types/database'

/**
 * 브라우저(클라이언트 컴포넌트)에서 쓰는 Supabase 클라이언트.
 * 여기서 쓰는 키는 공개용이라 노출돼도 안전하다 — 실제 접근 제어는 DB의 RLS가 담당한다.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      '.env.local에 NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정해주세요.',
    )
  }

  return createBrowserClient<Database>(url, key)
}
