/**
 * 연속 실천일 배지.
 *
 * 가장 중요한 규칙: 0일일 때 절대 죄책감을 주지 않는다.
 * "끊겼어요", "실패", "놓쳤어요" 같은 표현은 쓰지 않고
 * 바로 다시 시작할 수 있다는 말만 담담하게 전한다(04_PROJECT_SPEC.md).
 */

export type StreakBadgeSize = 'sm' | 'md'

export interface StreakBadgeProps {
  /** 현재 연속 일수. DB 함수 effective_streak(room_member_id) 값을 넣으면 된다. */
  count: number
  /** 최고 기록. 주면 이어서 작게 보여준다. */
  bestCount?: number | null
  size?: StreakBadgeSize
  className?: string
}

/**
 * 글자 크기는 두 크기 모두 17px(text-base)로 같다.
 * 목록 안에서 자리를 덜 차지해야 할 때는 글자가 아니라 안쪽 여백만 줄인다.
 */
const SIZE_CLASS: Record<StreakBadgeSize, string> = {
  // 카드 안처럼 좁은 자리(RoomCard).
  sm: 'px-3 py-1 text-base',
  // 방 화면 머리처럼 넉넉한 자리.
  md: 'px-4 py-1.5 text-base',
}

/** 배지에 쓸 문구. 화면 밖에서도 쓸 수 있게 따로 뺐다. */
export function streakLabel(count: number, bestCount?: number | null): string {
  if (count > 0) return `연속 ${count}일`
  // 한 번이라도 해본 적 있으면 "다시", 아직 없으면 "오늘부터".
  return (bestCount ?? 0) > 0 ? '오늘 다시 시작해요' : '오늘부터 시작해요'
}

export function StreakBadge({
  count,
  bestCount,
  size = 'md',
  className,
}: StreakBadgeProps) {
  const active = count > 0
  const label = streakLabel(count, bestCount)
  const showBest = active && (bestCount ?? 0) > count

  return (
    <span
      className={[
        // 배지와 '최고 N일'이 한 줄에 안 들어가면 아래로 접힌다(글자를 줄이지 않는다).
        'inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={[
          'inline-flex items-center whitespace-nowrap rounded-chip font-bold',
          SIZE_CLASS[size],
          active
            ? 'bg-primary-soft text-primary'
            : // 아직 시작 전일 때는 분홍기를 빼고 가라앉힌다. canvas는 흰 카드 위에서
              // 옅은 회색면으로 보인다(대비 5.09:1).
              'bg-canvas text-muted',
        ].join(' ')}
      >
        {label}
      </span>

      {showBest ? (
        <span className="whitespace-nowrap text-sm text-muted">
          최고 {bestCount}일
        </span>
      ) : null}
    </span>
  )
}
