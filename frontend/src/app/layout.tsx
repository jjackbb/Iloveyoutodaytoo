import { GoogleAnalytics } from '@next/third-parties/google'
import type { Metadata, Viewport } from 'next'
import { Noto_Sans_KR } from 'next/font/google'

import { SignupBeacon } from '@/app/signup-beacon'
import { GA_ID } from '@/lib/analytics'
import { readLargeTextCookie } from '@/lib/large-text'

import './globals.css'

/**
 * 800·900은 제목용이다. 프로토타입이 제목을 굵게 눌러 쓰는데, 700까지만 있으면
 * 그 눌린 느낌이 안 나온다. 한글 웹폰트는 유니코드 구간별로 쪼개져 필요한 조각만
 * 받아오므로, 굵기를 늘려도 첫 화면에서 받는 양이 그만큼 늘지는 않는다.
 */
const notoSansKr = Noto_Sans_KR({
  variable: '--font-noto-sans-kr',
  subsets: ['latin'],
  weight: ['400', '500', '700', '800', '900'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: '오늘도 사랑해',
  description: '소중한 사람에게 매일 마음 한마디를 전하는 습관',
  // manifest가 있어야 아이폰에서도 "홈 화면에 추가"가 웹푸시를 받는 PWA로 설치된다.
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  // 아이폰 Safari는 manifest만으로는 부족하고 이 메타 태그들도 따로 봐야
  // "홈 화면에 추가"한 화면이 브라우저 주소창 없는 앱처럼 열린다.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '오늘도 사랑해',
  },
}

export const viewport: Viewport = {
  themeColor: '#5b4be0',
  // 시니어 사용자가 확대해서 볼 수 있어야 하므로 확대를 막지 않는다
  initialScale: 1,
  width: 'device-width',
}

/**
 * 큰 글자 모드는 <html>의 글자 크기를 바꾼다(globals.css의 .large-text).
 * 모든 rem이 그 값을 기준으로 하므로 여백·버튼 높이까지 같이 커진다 —
 * 글자만 키우고 칸은 그대로면 줄이 서로 붙어 오히려 읽기 어려워진다.
 *
 * 값을 DB가 아니라 쿠키에서 읽는 이유는 @/lib/large-text 에 적어두었다.
 */
export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const largeText = await readLargeTextCookie()

  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} h-full${largeText ? ' large-text' : ''}`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <SignupBeacon />
      </body>
      {/*
        GA4. 측정 ID가 없으면 아예 붙이지 않는다 — 로컬에서 개발할 때
        빈 ID로 스크립트만 불러오는 낭비를 막는다.
        이벤트를 보내는 쪽은 @/lib/analytics 의 track() 하나로 모았다.
      */}
      {GA_ID ? <GoogleAnalytics gaId={GA_ID} /> : null}
    </html>
  )
}
