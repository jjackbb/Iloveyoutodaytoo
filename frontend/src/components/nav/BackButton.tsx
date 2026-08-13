import Link from 'next/link'

/**
 * 정해진 곳으로 돌아가는 뒤로 버튼.
 *
 * 방 화면의 BackLink와 달리 목적지가 고정이라 서버 컴포넌트로 둔다.
 * 브라우저 뒤로가기(history.back)를 쓰지 않는 이유는 BackLink 쪽 주석에 적어두었다.
 *
 * 글자 없이 화살표만 두지 않는다 — 시니어 사용자에게 화살표만으로는 어디로 가는지 알기 어렵다.
 * 다만 제목 줄에 들어갈 때는 자리가 좁아 화살표만 남기고 목적지는 aria-label로 알린다.
 */
export function BackButton({
  href,
  label,
  compact = false,
}: {
  href: string
  /** "마이로 돌아가기"처럼 목적지가 드러나게 적는다. */
  label: string
  /** 제목 줄에 넣을 때. 화살표만 보이고 글자는 화면 낭독기에만 전달된다. */
  compact?: boolean
}) {
  return (
    <Link
      href={href}
      aria-label={compact ? label : undefined}
      className={[
        'inline-flex min-h-[44px] items-center gap-1 rounded-[8px] text-base text-muted active:bg-surface-soft',
        compact ? 'w-11 shrink-0 justify-center' : 'w-fit px-2',
      ].join(' ')}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 5 8 12l7 7" />
      </svg>
      {compact ? null : label}
    </Link>
  )
}
