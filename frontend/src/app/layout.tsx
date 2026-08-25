import { GoogleAnalytics } from '@next/third-parties/google'
import type { Metadata, Viewport } from 'next'

import { SignupBeacon } from '@/app/signup-beacon'
import { GA_ID } from '@/lib/analytics'
import { readLargeTextCookie } from '@/lib/large-text'

/*
  Pretendard (2026-08-25: Noto Sans KR 에서 갈아탔다).

  왜 바꿨나: 제목을 900으로 눌러 쓰던 화면이 "공지·커머스"의 목소리로 읽혔다.
  다루는 감정이 쑥스러움·미안함이라 소리를 낮춰야 했다. Pretendard 는
  한국 앱(토스 계열)의 사실상 표준이고 획이 곧아 같은 크기에서 덜 시끄럽다.
  토스 전용 폰트와 애플 SF Pro 는 라이선스 때문에 못 쓴다.

  dynamic-subset 을 쓴다 — 92개 조각으로 쪼개져 있어서 브라우저가
  **그 화면에 실제로 나온 글자의 조각만** 받는다. 통짜 파일(약 2MB)을 받지 않는다.
  자체 호스팅이라 외부 CDN에 기대지 않는다.
*/
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'

import './globals.css'


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
      className={`h-full${largeText ? ' large-text' : ''}`}
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
