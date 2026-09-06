import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { isNativeAppUserAgent } from '@/lib/native'

/** 로그인하지 않아도 들어갈 수 있는 경로 */
const PUBLIC_PATHS = ['/start', '/login', '/signup', '/invite', '/legal', '/auth']

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

/*
  ── 브라우저에게도 그대로 내주는 것들 ──────────────────────────────

  PRD §6⑮로 웹 서비스는 폐기했다. 브라우저로 들어온 사람은 앱을 받으라는
  랜딩(/welcome)으로 보낸다. 다만 아래 셋은 브라우저에서도 살아 있어야 한다.

  1. 사람이 봐야 하는 것 — /welcome(랜딩), /invite/*(초대장: 설치를 결심하는 자리),
     /legal/*(약관·개인정보. 스토어 심사와 법이 요구하는 공개 문서다)
  2. 기계가 읽는 것 — /.well-known/*(App Links 검증. 여기가 막히면 구글이
     "이 도메인은 이 앱 것"이라는 확인을 못 해 초대 링크가 앱으로 안 열린다),
     robots.txt, manifest.json, sw.js
  3. 화면을 그리는 데 필요한 것 — /_next/*, /api/*, 정적 파일

  ⚠️ 여기서 경로를 빼면 그 기능이 조용히 죽는다. 특히 /.well-known 은
  사람이 눈으로 확인할 일이 없어서, 막혀도 한참 뒤에야 알게 된다.
*/
const BROWSER_ALLOWED_PREFIXES = [
  '/welcome',
  '/invite',
  '/legal',
  '/.well-known',
  '/api',
  '/_next',
  '/icons',
]

const BROWSER_ALLOWED_PATHS = [
  '/robots.txt',
  '/manifest.json',
  '/sw.js',
  '/llms.txt',
  '/logo.png',
  '/favicon.ico',
]

/** 확장자가 붙은 것은 화면이 아니라 파일이다 — 랜딩으로 보내면 깨진다. */
const STATIC_FILE_PATTERN =
  /\.(?:png|jpe?g|gif|webp|avif|svg|ico|json|js|mjs|css|map|txt|xml|woff2?|ttf|otf|mp3|mp4|webm)$/i

function isBrowserAllowed(pathname: string) {
  if (BROWSER_ALLOWED_PATHS.includes(pathname)) return true
  if (STATIC_FILE_PATTERN.test(pathname)) return true
  return BROWSER_ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

/**
 * Next.js 16부터 `middleware.ts`는 `proxy.ts`로 이름이 바뀌었다.
 *
 * 여기서 하는 일은 세 가지다.
 *  0. 앱이 아닌 접속(브라우저)을 /welcome 랜딩으로 돌려보내기 (PRD §6⑮)
 *  1. 만료된 로그인 세션 갱신
 *  2. 로그인 안 한 사람을 /start(시작 화면)로 보내기 (편의용)
 *
 * 2번은 UX용 방어선일 뿐이다. 실제 접근 제어는 DB의 RLS와
 * 서버 코드의 requireUser()가 담당한다 — proxy만 믿으면 안 된다.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  /*
    앱이 아닌 접속은 여기서 끝난다(PRD §6⑮ — 웹 서비스 폐기).

    세션 갱신보다 **먼저** 판단한다. 어차피 랜딩으로 보낼 요청에 Supabase
    왕복을 붙일 이유가 없고, /welcome 은 로그인과 무관한 화면이다.

    UA 표식은 capacitor.config.ts 의 appendUserAgent 가 붙인다.
    판별은 src/lib/native.ts 한 곳에서만 한다.
  */
  if (
    !isNativeAppUserAgent(request.headers.get('user-agent')) &&
    !isBrowserAllowed(pathname)
  ) {
    const welcomeUrl = request.nextUrl.clone()
    welcomeUrl.pathname = '/welcome'
    welcomeUrl.search = ''
    return NextResponse.redirect(welcomeUrl)
  }

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

  if (!user && !isPublic(pathname)) {
    /*
      처음 오신 분은 시작 화면으로 보낸다(캡처 01). 곧장 로그인 폼을 들이밀면
      계정이 없는 분은 "아이디가 뭐지" 하고 막힌다. 시작 화면에는 가입·로그인이
      둘 다 있다.
    */
    const startUrl = request.nextUrl.clone()
    startUrl.pathname = '/start'
    startUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(startUrl)
  }

  if (
    user &&
    (pathname === '/start' || pathname === '/login' || pathname === '/signup')
  ) {
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
