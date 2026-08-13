import Link from 'next/link'

/**
 * 법적 고지 문서 화면들의 공통 껍데기.
 *
 * 이 경로는 proxy.ts의 공개 경로다 — 로그인하지 않아도 볼 수 있어야 한다.
 * 가입 화면에서 동의 체크 옆의 링크를 누르면 (아직 계정이 없는 상태로) 여기로 온다.
 * 그래서 여기서는 로그인 여부를 확인하지 않고, 아래 탭(BottomNav)도 두지 않는다.
 *
 * 맨 위 안내 배너를 layout에 둔 이유:
 * 두 문서 모두 아직 검토 전 초안이다. 어느 문서로 들어오든 이 사실을 먼저 봐야 한다.
 * 한쪽에만 붙이면 언젠가 한쪽이 빠진다.
 */
export default function LegalLayout({ children }: LayoutProps<'/legal'>) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pt-6 pb-16">
      <header className="flex flex-col gap-4">
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center self-start rounded-[8px] px-2 text-base font-medium text-primary active:bg-primary-soft"
        >
          오늘도 사랑해
        </Link>

        {/*
          초안 안내.
          없는 문서에 동의를 받고 있었으므로, 최소한 지금 보고 있는 것이
          무엇인지는 정확히 알려야 한다. 사용자를 속이지 않는다.
          색만으로 알리지 않도록 제목 글자와 기호를 함께 쓴다.
        */}
        <aside
          aria-label="문서 안내"
          className="rounded-[14px] bg-primary-soft px-5 py-5 text-primary"
        >
          {/*
            일부러 제목 태그(h2)를 쓰지 않았다.
            이 배너는 본문 h1보다 위에 있어서, 여기에 h2를 두면
            화면낭독기가 읽는 제목 순서가 h2 → h1로 뒤집힌다.
          */}
          <p className="text-lg leading-relaxed font-bold">
            ⚠️ 아직 검토를 받지 않은 초안이에요
          </p>
          {/*
            본문 글자는 먹색(text-ink)으로 둔다.

            처음 판단은 분홍 배경이 #fdebf3 이던 때 나왔다 — 그 위의 #d50e68 은 4.49:1 로
            WCAG AA(4.5:1) 미달이었다. 토큰이 #fef0f6 으로 밝아진 지금은 4.65:1 로
            기준을 넘기지만, 본문 크기(17px)에 여유가 거의 없어 먹색을 유지한다.
            ⚠️ 기호와 굵은 제목이 이미 있으므로 색을 빼도 뜻은 전달된다.
          */}
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-ink">
            <li>
              이 문서는 <strong className="font-bold">초안</strong>입니다.
              변호사 등 법률 전문가의 검토를 아직 받지 않았습니다.
            </li>
            <li>
              사업자명, 개인정보 보호책임자, 시행일처럼{' '}
              <strong className="font-bold">[ ] 로 표시된 빈칸</strong>은 아직
              채워지지 않았습니다.
            </li>
            <li>
              내용은 정식 오픈 전에 바뀔 수 있고, 바뀌면 서비스 안에서 미리
              알려드릴게요.
            </li>
          </ul>
        </aside>
      </header>

      {/*
        "다른 문서 보기"는 각 문서 화면(page.tsx)이 그린다.
        layout은 지금 어느 문서를 보고 있는지 모르기 때문에, 여기 두면
        이용약관을 보는 중에도 "이용약관 보기"가 같이 떴다.
      */}
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
