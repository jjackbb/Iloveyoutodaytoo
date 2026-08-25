import type { ReactNode } from 'react'

import { ButtonLink } from '@/components/ui/Button'

/**
 * 아직 아무것도 없을 때 보여주는 안내.
 *
 * 문구는 담담하고 따뜻하게. "없어요"로 끝내지 말고 다음에 뭘 하면 되는지 알려준다.
 * 재촉하거나 죄책감을 주는 표현은 쓰지 않는다(04_PROJECT_SPEC.md).
 */
export interface EmptyStateProps {
  title: string
  description?: ReactNode
  /**
   * 제목 위에 놓을 그림. 프로토타입 `.empty-emoji`의 원형 자리다.
   * 장식이라 낭독기에서는 숨긴다 — 뜻은 아래 글이 이미 말해준다.
   */
  icon?: ReactNode
  /** 버튼을 직접 넣고 싶을 때. actionHref보다 우선한다. */
  action?: ReactNode
  /** 간단한 이동 버튼을 붙일 때. actionLabel과 함께 준다. */
  actionHref?: string
  actionLabel?: string
  className?: string
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  actionHref,
  actionLabel,
  className,
}: EmptyStateProps) {
  const fallbackAction =
    !action && actionHref && actionLabel ? (
      <ButtonLink href={actionHref} fullWidth>
        {actionLabel}
      </ButtonLink>
    ) : null

  return (
    <div
      className={[
        // 프로토타입 .empty-hero: 26px 모서리에 흰색→분홍 그라데이션.
        // 아무것도 없는 화면이 휑해 보이지 않게 이 칸만 조금 크고 부드럽게 잡는다.
        'flex flex-col items-center gap-3 rounded-[26px] px-6 py-10 text-center',
        'bg-linear-to-b from-card to-primary-soft shadow-card',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon ? (
        // 118px 원은 프로토타입 .empty-emoji 실측값이다.
        // 색만 우리 토큰으로 바꿨다 — 프로토타입의 분홍 그라데이션(#FFE1E9→#FFC9D8)은
        // 대비 검증을 거치지 않은 색이라 가져오지 않는다.
        // mb-2: 부모 gap-3(12.75px)에 얹어 프로토타입의 아래 여백 22px를 맞춘다.
        <div
          aria-hidden
          className="mb-2 flex h-[118px] w-[118px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
        >
          {icon}
        </div>
      ) : null}

      <p className="text-xl font-bold text-ink">{title}</p>

      {description ? (
        <p className="text-base leading-relaxed text-muted">{description}</p>
      ) : null}

      {(action ?? fallbackAction) ? (
        <div className="mt-2 w-full max-w-xs">{action ?? fallbackAction}</div>
      ) : null}
    </div>
  )
}
