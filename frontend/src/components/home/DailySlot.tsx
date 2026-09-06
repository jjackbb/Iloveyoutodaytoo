import Link from 'next/link'

import type { DailySlotData } from '@/lib/daily'

/**
 * 홈 맨 위 "매일 바뀌는 자리" (DAILY-01, PRD §6⑱). 사용자 결정: 홈 맨 위.
 *
 * ⚠️ 겉모습은 임시다. 브랜드(로고·색)가 미정이라 기존 토큰(surface-soft · ink · muted)만
 * 썼고, 디자인 관문은 로고가 나온 뒤에 밟는다 — 랜딩(/welcome)과 같은 결정이다.
 * 여기에 색·장식을 더하지 마라. 어차피 다시 그린다.
 *
 * 두 가지 중 하나만 보인다:
 *  - 작년 오늘 우리 방에 남겨진 추억이 있으면 그것(누르면 그 추억으로)
 *  - 없으면 "이번 달 N번 남겼어요". 0이면 첫 마음을 권한다 — 숫자 0을 보여주면 빈 성적표다
 */
export function DailySlot({ data }: { data: DailySlotData }) {
  if (data.lastYear) {
    const { memoryId, roomId, roomName, authorName } = data.lastYear
    return (
      <section aria-label="작년 오늘" className="mt-card">
        <Link
          href={`/rooms/${roomId}/memories/${memoryId}`}
          className="block rounded-inner bg-surface-soft px-4 py-4 active:bg-hairline"
        >
          <p className="text-sm text-muted">작년 오늘</p>
          <p className="mt-1 text-base font-bold break-keep text-ink">
            {roomName} · {authorName}님의 추억
          </p>
          <p className="mt-1 text-sm text-muted">다시 보기 →</p>
        </Link>
      </section>
    )
  }

  const { monthCount, monthLabel } = data
  return (
    <section
      aria-label="이번 달 남긴 마음"
      className="mt-card rounded-inner bg-surface-soft px-4 py-4"
    >
      <p className="text-sm text-muted">{monthLabel}</p>
      <p className="mt-1 text-base font-bold break-keep text-ink">
        {monthCount > 0
          ? `${monthCount}번 남겼어요`
          : '첫 마음을 남겨볼까요'}
      </p>
    </section>
  )
}
