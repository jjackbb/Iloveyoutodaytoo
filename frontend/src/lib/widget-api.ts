import { createClient as createSupabase } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

/**
 * /api/widget/* 라우트가 같이 쓰는 조각들.
 *
 * route.ts 에는 HTTP 핸들러(GET/POST…)와 설정만 export 할 수 있다 — 다른 것을 내보내면
 * Next 가 빌드에서 거부한다. 그래서 두 라우트가 나눠 쓰는 것은 여기 둔다.
 */

/** 위젯 응답은 항상 최신이어야 한다. 캐시되면 "앱 안 켜도 마음이 보임"이 30분 뒤 것이 된다. */
export const NO_STORE = { 'Cache-Control': 'no-store' } as const

/** `Authorization: Bearer <token>` 에서 토큰만. 없거나 비어 있으면 null. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  const matched = /^Bearer\s+(.+)$/i.exec(header)
  const token = matched?.[1]?.trim() ?? ''
  return token.length > 0 ? token : null
}

/**
 * 세션 없는 익명 클라이언트.
 * 쿠키를 읽지 않는다 — 위젯 요청에는 쿠키가 없고, 있어도 믿을 이유가 없다.
 * 검사는 전부 DB 함수(widget_latest · widget_knock)가 토큰으로 한다.
 */
export function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase 환경변수가 없습니다.')
  return createSupabase<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * ⚠️ service_role 의 유일한 예외 (사용자 승인 2026-09-06).
 *
 * 이 프로젝트는 service_role 키를 쓰지 않는 것이 규칙이다(PRD 결정 — lib/push.ts 참고).
 * 위젯 사진만은 예외다: 비공개 버킷의 서명 URL 은 Storage API 의 일이라 DB 함수가
 * 못 만들고, 위젯에는 서명할 세션이 없다. 그래서 **DB 가 "이 토큰은 이 사진을 봐도
 * 된다"고 답한 경로 하나에만** 서명 도장을 찍는다. 검사는 여전히 DB 가 한다.
 *
 * 키가 없으면(Vercel 환경변수 미설정) null — 사진만 빠지고 위젯은 글로 그린다.
 * 다른 곳에서 이 함수를 부르지 마라. 부르고 싶다면 그건 규칙을 바꾸는 결정이다.
 *
 * residue-scan-allow: service-role-key — 위젯 사진 서명 한 곳에만 허용. 사용자 승인 2026-09-06.
 */
export function serviceClientForWidgetPhoto() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabase<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** 우리가 다루는 id 는 전부 uuid 다. 모양이 아니면 DB 까지 갈 필요가 없다. */
export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}
