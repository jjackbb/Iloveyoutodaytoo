import type { Metadata, Viewport } from 'next'
import { Noto_Sans_KR } from 'next/font/google'

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

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  )
}
