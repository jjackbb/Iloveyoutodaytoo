'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * 관계방 화면들의 "뒤로".
 *
 * 왜 클라이언트 컴포넌트인가:
 * 목적지가 지금 보고 있는 화면에 따라 달라진다. 방 안쪽 화면(마음 쓰기, 초대하기)에서
 * 뒤로를 눌렀는데 홈으로 튕기면, 방금 하던 일이 있던 자리로 돌아갈 방법이 없다.
 * 현재 경로는 usePathname으로만 알 수 있어서 이 조각만 브라우저 쪽으로 뺐다.
 * (감싸는 layout.tsx는 구성원 확인을 해야 하므로 서버 컴포넌트로 남는다)
 *
 * 왜 브라우저 뒤로가기(history.back)를 쓰지 않는가:
 * 초대 링크를 타고 바로 들어온 경우처럼 앞 기록이 없을 수 있고,
 * 방금 왔던 화면으로 되돌아가 같은 동작을 두 번 하게 되기도 한다.
 * 목적지를 눈에 보이는 대로 정해두는 편이 헷갈리지 않는다.
 *
 * 목적지 규칙:
 *   /rooms/{id}        → 홈(/)
 *   /rooms/{id}/그 외  → /rooms/{id}
 */
export function BackLink({ roomId }: { roomId: string }) {
  const pathname = usePathname()
  const roomPath = `/rooms/${roomId}`

  // 방 주소 뒤에 뭔가 더 붙어 있으면(=방 안쪽 화면이면) 방으로 돌아간다.
  const rest = pathname?.startsWith(roomPath)
    ? pathname.slice(roomPath.length)
    : ''
  const insideRoom = rest.replace(/\/+$/, '').length > 0

  const href = insideRoom ? roomPath : '/'
  const label = insideRoom ? '방으로 돌아가기' : '홈으로 돌아가기'

  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex min-h-[44px] items-center gap-1 rounded-[8px] px-3 text-base text-muted active:bg-surface-soft"
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
      뒤로
    </Link>
  )
}
