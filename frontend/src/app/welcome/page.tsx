import type { Metadata } from 'next'
import Link from 'next/link'

import { BrandMark } from '@/components/brand/BrandMark'
import { ButtonLink } from '@/components/ui/Button'
import { PLAY_STORE_URL } from '@/lib/native'

/**
 * ⚠️ **임시 화면이다. 디자인 관문(시안 비교·구현)을 밟지 않았다.**
 *
 * 사용자 결정(2026-09-06): "지금은 길만 막고, 랜딩 디자인은 로고 뒤에."
 * 브랜드(새 로고·강조색)가 아직 안 정해졌는데 랜딩을 예쁘게 짜면,
 * 로고가 나오는 순간 통째로 다시 짜게 된다. 그래서 지금은
 * **브라우저로 온 사람이 막다른 길에 서지 않게 하는 것**만 한다.
 *
 * 로고와 강조색이 확정되면 이 파일은 디자인 관문 7단계를 밟아 다시 짠다.
 * 그때까지 여기에 색·장식을 더하지 마라 — 어차피 버릴 것이다.
 *
 * ── 이 화면이 왜 있나 ──
 * PRD §6⑮로 웹 서비스는 폐기했다(안드로이드 앱 하나로 간다).
 * 그래서 proxy.ts 가 앱이 아닌 접속을 전부 여기로 보낸다.
 * 로그인 여부와 상관없이 누구에게나 같은 화면을 보여준다.
 */
export const metadata: Metadata = {
  title: '오늘도 사랑해',
  description:
    '쑥스러운 마음을 목소리로 남기는 곳, 우리끼리의 비밀 감정 사서함',
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
          쑥스러운 마음을 목소리로 남기는 곳,
          <br />
          우리끼리의 비밀 감정 사서함
        </p>
      </div>

      {/*
        들어오는 길은 앱 하나다. 웹으로 가입시키지 않는다 —
        웹에서 가입해봐야 다음 화면부터 다시 여기로 돌아온다.
      */}
      <ButtonLink
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        fullWidth
      >
        Google Play에서 받기
      </ButtonLink>

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
