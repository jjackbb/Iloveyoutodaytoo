import type { Metadata } from 'next'
import Link from 'next/link'

import { BrandMark } from '@/components/brand/BrandMark'
import { ButtonLink } from '@/components/ui/Button'

/**
 * 브라우저 방문자를 포트폴리오 데모로 안내한다(2026-09-22 사용자 결정).
 * 기존 소개 레이아웃은 유지하고 설치 대신 체험 진입을 연결했다.
 * 소개 문구는 2026-09-28 사용자가 직접 정했다(앞선 AI 초안을 바꿈).
 */
export const metadata: Metadata = {
  title: '오늘도 사랑해',
  description:
    '소중한 존재에게 마음껏 표현해요',
}

export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <BrandMark size={64} />
        <h1 className="text-3xl font-bold tracking-[-0.02em] text-ink">
          오늘도 사랑해
        </h1>
        <p className="text-lg leading-relaxed text-muted">
          소중한 존재에게 마음껏 표현해요
        </p>
      </div>

      {/* 실제 가입과 분리된 가상 앨범방 체험. */}
      <ButtonLink
        href="/demo"
        fullWidth
      >
        데모 체험하기
      </ButtonLink>

      <p className="text-sm leading-relaxed text-muted">
        가입 없이 가상의 앨범방을 둘러보세요.
        <br />
        체험한 내용은 이 브라우저에만 저장돼요.
      </p>

      <p className="text-base text-muted">
        <Link href="/legal/terms" className="underline">
          이용약관
        </Link>
        <span aria-hidden className="px-2">
          ·
        </span>
        <Link href="/legal/privacy" className="underline">
          개인정보처리방침
        </Link>
      </p>
    </main>
  )
}
