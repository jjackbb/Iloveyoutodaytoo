import type { Metadata } from 'next'

import { safeNextPath } from '@/lib/safe-redirect'
import { SignupForm } from './signup-form'

export const metadata: Metadata = { title: '가입하기 · 오늘도 사랑해' }

export default async function SignupPage({
  searchParams,
}: PageProps<'/signup'>) {
  const params = await searchParams
  // 초대 링크로 들어온 사람은 ?next=/invite/{토큰} 을 달고 온다.
  // 이 값을 폼까지 넘겨줘야 가입이 끝난 뒤 초대장으로 돌아갈 수 있다.
  const next = safeNextPath(params.next)

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">시작해볼까요</h1>
        <p className="text-muted">오늘 한마디가 내일의 사이를 바꿔요.</p>
      </header>

      <SignupForm next={next} />
    </main>
  )
}
