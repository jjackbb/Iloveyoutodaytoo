import type { Metadata } from 'next'
import Link from 'next/link'

import { SocialSoonDrawer } from '@/app/start/social-soon-button'
import { BrandMark } from '@/components/brand/BrandMark'
import { Mongsil } from '@/components/brand/Mongsil'
import { ButtonLink } from '@/components/ui/Button'
import { safeNextPath } from '@/lib/safe-redirect'

export const metadata: Metadata = { title: '시작하기 · 오늘도 사랑해' }

/**
 * 시작 화면 — 로그인하지 않은 사람이 처음 닿는 곳.
 *
 * ## 2026-08-25 리디자인
 *
 * 전에는 똑같이 생긴 버튼 4개가 쌓여 있었고 그중 3개가 [준비 중]이었다. 그리고
 * 제일 중요한 감정 문장이 **화면에서 제일 작고 흐린 회색 글씨**였다.
 * 무엇을 파는 곳인지 2초 안에 알 수 없었다.
 *
 * 바뀐 것 셋:
 *
 * 1. **몽실이가 화면 한가운데로.** 이 서비스에서 색과 성격을 내는 건 몽실이뿐이고
 *    바탕은 조용히 있는다. 캐릭터가 먼저 말을 걸고 글이 받는다.
 * 2. **되는 길 하나만 큰 버튼.** 준비 중 셋은 [다른 방법으로 시작하기] 안에 접었다.
 *    지우지는 않았다 — 이유는 SocialSoonDrawer 주석에 적었다.
 * 3. **문구가 찌르지 않고 받아준다.** "못 한 말이 있죠"는 첫 화면에서 사람을 내보낸다.
 *    "쑥스러워도 괜찮아요"로 먼저 안아주고 나서 권한다.
 *
 * 그리고 문구에서 **'가족'을 뺐다** — 1순위이긴 하지만 연인·나 자신도 쓰는 서비스라
 * 첫 화면이 "가족 앱"이라고 못 박으면 나머지가 남의 얘기가 된다(사용자 결정 2026-08-25).
 *
 * 시안·근거는 `_workspace/mock/` 아래 문서들에 정리해 두었다.
 */
export default async function StartPage({ searchParams }: PageProps<'/start'>) {
  const params = await searchParams
  // 초대 링크로 들어온 사람은 ?next=/invite/{토큰} 을 달고 온다. 끝까지 들고 간다.
  const next = safeNextPath(params.next)
  const withNext = (path: string) =>
    next === '/' ? path : `${path}?next=${encodeURIComponent(next)}`

  return (
    // 100dvh: 모바일 주소창이 접혔다 펴져도 높이가 흔들리지 않는다.
    // 안쪽은 위(브랜드) / 가운데(몽실이+문구) / 아래(행동) 3단이고,
    // 가운데는 남는 자리를 나눠 가져 화면이 길든 짧든 균형이 유지된다.
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-1 flex-col px-screen-x pb-screen-b">
      <div className="flex items-center gap-2 pt-7">
        <BrandMark size={22} />
        <span className="text-base font-bold tracking-[-0.02em] text-ink">
          오늘도 사랑해
        </span>
      </div>

      {/* 남는 자리를 위아래로 나눠 가진다 — 내용이 길어지면 0이 되어 밀리지 않는다 */}
      <div className="min-h-0 flex-1" />

      {/*
        몽실이가 말을 건다. 말풍선이 먼저고 몽실이가 그 아래에 있다 —
        위에서 내려다보는 게 아니라 **아래에서 올려다보며 말하는** 자세다.
      */}
      <div className="flex flex-col items-center">
        <p className="relative max-w-[85%] rounded-[20px] bg-surface-soft px-5 py-3 text-center text-base font-semibold tracking-[-0.02em] break-keep text-ink after:absolute after:bottom-[-8px] after:left-1/2 after:h-2.5 after:w-[18px] after:-translate-x-1/2 after:bg-surface-soft after:[clip-path:polygon(0_0,100%_0,50%_100%)] after:content-['']">
          쑥스러워도 괜찮아요.
        </p>

        <Mongsil className="mt-1 w-[62%] max-w-[250px]" />
      </div>

      <h1 className="mt-5 text-center text-[27px] leading-[1.42] font-bold tracking-[-0.04em] break-keep text-ink">
        쑥스러운 마음도
        <br />
        <span className="text-primary">여기서는 편해요.</span>
      </h1>

      <p className="mt-3 text-center text-base leading-relaxed break-keep text-muted">
        목소리로 남겨두면, 소중한 사람이
        <br />
        언젠가 그 자리에서 들어요.
      </p>

      <div className="min-h-0 flex-1" />

      <div className="mt-8 flex flex-col gap-3">
        {/* 지금 실제로 되는 유일한 길. 화면에서 제일 진한 것이 이것이어야 한다. */}
        <ButtonLink href={withNext('/signup')} fullWidth>
          시작하기
        </ButtonLink>

        <SocialSoonDrawer />
      </div>

      <p className="mt-4 text-center text-base text-muted">
        이미 함께하고 계신가요?{' '}
        <Link
          href={withNext('/login')}
          className="font-bold text-primary underline underline-offset-4"
        >
          로그인
        </Link>
      </p>

      <p className="mt-4 text-center text-sm leading-relaxed break-keep text-muted">
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
