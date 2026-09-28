import type { Metadata } from 'next'
import Link from 'next/link'

import { ButtonLink } from '@/components/ui/Button'
import { safeNextPath } from '@/lib/safe-redirect'

export const metadata: Metadata = { title: '가입 준비 중 · 오늘도 사랑해' }

export default async function SignupPage({
  searchParams,
}: PageProps<'/signup'>) {
  const params = await searchParams
  // 기존 회원이 초대 링크를 타고 왔다면 로그인 뒤 같은 초대장으로 돌아간다.
  const next = safeNextPath(params.next)
  const loginHref =
    next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">가입 준비 중이에요</h1>
        <p className="text-base leading-relaxed text-muted">
          지금은 신규 가입을 받지 않고 있어요. 이미 계정이 있다면 로그인해서
          계속 이용할 수 있어요.
        </p>
      </header>

      <ButtonLink href={loginHref} fullWidth>
        기존 계정으로 로그인
      </ButtonLink>
      <p className="text-center text-base text-muted">
        가입 없이 둘러보고 싶다면{' '}
        <Link
          href="/demo"
          className="font-bold text-primary underline underline-offset-4"
        >
          데모 체험하기
        </Link>
      </p>
    </main>
  )
}
