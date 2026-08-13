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

      {/* 아이디 로그인은 개발용 임시 수단이다 (01_PRD.md §8).
          Phase 2에서 카카오·구글·휴대폰 로그인으로 교체하고 이 화면은 사라진다. */}
      <p className="rounded-[14px] bg-surface-soft px-4 py-3 text-base text-muted">
        지금은 개발 중이라 아이디로 로그인해요. 정식 오픈 때는 카카오·구글·휴대폰
        번호로 바뀔 예정이에요.
      </p>
    </main>
  )
}
