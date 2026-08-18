import type { Metadata, Viewport } from 'next'
import { Noto_Sans_KR } from 'next/font/google'

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
}

export const viewport: Viewport = {
  themeColor: '#d50e68',
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
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  )
}
