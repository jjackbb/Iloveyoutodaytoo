import type { Metadata } from 'next'

import { safeNextPath } from '@/lib/safe-redirect'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: '로그인 · 오늘도 사랑해' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  // '//evil.com' 같은 값을 걸러낸다. 검사 규칙은 safeNextPath 한 곳에만 둔다.
  const next = safeNextPath(params.next)

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">오늘도 사랑해</h1>
        <p className="text-muted">소중한 사람에게 매일 마음 한마디를.</p>
      </header>

      <LoginForm next={next} />

      <p className="rounded-inner bg-surface-soft px-4 py-3 text-base text-muted">
        기존 계정은 아이디로 로그인할 수 있어요. 신규 가입은 준비 중이에요.
      </p>
    </main>
  )
}
