import type { Metadata } from 'next'
import Link from 'next/link'

import { SocialSoonButton } from '@/app/start/social-soon-button'
import { ButtonLink } from '@/components/ui/Button'
import { safeNextPath } from '@/lib/safe-redirect'

export const metadata: Metadata = { title: '시작하기 · 오늘도 사랑해' }

/**
 * 시작 화면 (캡처 01).
 *
 * 로그인하지 않은 사람이 처음 닿는 곳이다. 캡처에는 카카오·휴대폰·Google·Apple
 * 네 버튼과 아래 약관 문구가 있다.
 *
 * **네 가지 모두 아직 실제로는 안 된다.** 외부 서비스에 앱 등록이 끝나지 않았다
 * (03_capture_flow.md의 기록: "UI는 캡처대로 만들되 동작은 가능한 수단으로 연결하고
 * 사실대로 보고"). 그래서 자리는 캡처대로 두되 **[준비 중] 표시를 붙이고**,
 * 눌렀을 때 지금 되는 길을 알려준다.
 *
 * 왜 감추지 않았나: 감추면 나중에 켤 때 화면을 다시 짜야 하고, 무엇보다
 * "카카오로 되겠지" 하고 온 분이 왜 없는지 알 수 없다. 있는 그대로 말하는 편이 낫다.
 * 왜 그냥 눌리게 두지 않았나: 눌러도 아무 일이 없는 버튼은 시니어 사용자에게
 * 고장 난 화면으로 읽힌다 — 이 앱이 지키는 규칙이다.
 */
export default async function StartPage({ searchParams }: PageProps<'/start'>) {
  const params = await searchParams
  // 초대 링크로 들어온 사람은 ?next=/invite/{토큰} 을 달고 온다. 끝까지 들고 간다.
  const next = safeNextPath(params.next)
  const withNext = (path: string) =>
    next === '/' ? path : `${path}?next=${encodeURIComponent(next)}`

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <HeartMark />
        <h1 className="text-3xl font-bold text-ink">오늘도 사랑해</h1>
        <p className="text-base leading-relaxed break-keep text-muted">
          쑥스러운 마음을 추억으로 전하는 곳,
          <br />
          우리 가족 비밀 감정 사서함
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {/* 지금 실제로 되는 길. 캡처의 네 버튼 위에 둔다 — 되는 것이 먼저 보여야 한다. */}
        <ButtonLink href={withNext('/signup')} fullWidth>
          아이디로 시작하기
        </ButtonLink>

        <SocialSoonButton provider="카카오" />
        <SocialSoonButton provider="휴대폰 번호" />
        <SocialSoonButton provider="Google" />
        <SocialSoonButton provider="Apple" />
      </div>

      <p className="text-center text-base text-muted">
        이미 함께하고 계신가요?{' '}
        <Link
          href={withNext('/login')}
          className="font-bold text-primary underline underline-offset-4"
        >
          로그인
        </Link>
      </p>

      {/* 캡처 01 하단의 약관 문구. 실제 문서로 이어진다. */}
      <p className="text-center text-sm leading-relaxed break-keep text-muted">
        시작하면{' '}
        <Link href="/legal/terms" className="underline underline-offset-4">
          이용약관
        </Link>
        과{' '}
        <Link href="/legal/privacy" className="underline underline-offset-4">
          개인정보 처리방침
        </Link>
        에 동의하는 것으로 봐요.
      </p>
    </main>
  )
}

/** 앱바·스플래시와 같은 브랜드 하트. */
function HeartMark() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-primary"
      aria-hidden
    >
      <path d="M12 20.4 4.6 13.2a4.7 4.7 0 0 1 6.6-6.7l.8.8.8-.8a4.7 4.7 0 0 1 6.6 6.7z" />
    </svg>
  )
}
