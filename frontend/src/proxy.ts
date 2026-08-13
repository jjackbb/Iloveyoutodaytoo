import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/** 로그인하지 않아도 들어갈 수 있는 경로 */
const PUBLIC_PATHS = ['/login', '/signup', '/invite', '/legal', '/auth']

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

/**
 * Next.js 16부터 `middleware.ts`는 `proxy.ts`로 이름이 바뀌었다.
 *
 * 여기서 하는 일은 두 가지다.
 *  1. 만료된 로그인 세션 갱신
 *  2. 로그인 안 한 사람을 /login으로 보내기 (편의용)
 *
 * 2번은 UX용 방어선일 뿐이다. 실제 접근 제어는 DB의 RLS와
 * 서버 코드의 requireUser()가 담당한다 — proxy만 믿으면 안 된다.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // 만료된 세션을 갱신한다. getUser()는 서버에서 토큰을 검증하므로 getSession()보다 안전하다.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !isPublic(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    homeUrl.search = ''
    return NextResponse.redirect(homeUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * 정적 파일과 이미지 최적화 경로는 건너뛴다.
     *
     * .txt / .xml 을 빼먹으면 robots.txt·llms.txt 요청까지 로그인으로 리디렉트되어
     * 크롤러가 차단 규칙 자체를 못 읽는다. 규칙 파일을 만들어두고도 무력해지므로
     * 확장자 목록에서 지우지 마라.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
}
