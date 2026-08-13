import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * 공용 카드. 흰 면이 따뜻한 바탕(canvas) 위에 그림자로 떠 있다.
 *
 * 예전에는 테두리 선으로 카드를 구분했는데, 바탕이 흰색이라 카드가 눌려 보였다.
 * 이제는 바탕을 오프화이트로 낮추고 카드를 흰색으로 띄운다 — 선 없이 그림자만 쓴다.
 * 모서리 22px·그림자 값은 프로토타입에서 가져왔다.
 *
 * href를 주면 카드 전체가 눌리는 링크가 된다.
 */

export type CardElement = 'div' | 'section' | 'article' | 'li'

/** 카드 모양 클래스. 다른 태그를 카드처럼 보이게 할 때 쓴다. */
export function cardClassName(options?: {
  padded?: boolean
  interactive?: boolean
  className?: string
}): string {
  const { padded = true, interactive = false, className } = options ?? {}

  return [
    'rounded-card bg-card shadow-card',
    padded ? 'p-5' : '',
    interactive
      ? 'block transition-colors hover:bg-surface-soft active:bg-surface-soft'
      : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
}

export interface CardProps {
  children: ReactNode
  /** 주면 카드 전체가 링크가 된다. */
  href?: string
  /** 감쌀 태그. 목록 안에서는 'li'를 준다. 기본값 'div' */
  as?: CardElement
  /** 안쪽 여백을 뺀다. 사진처럼 가장자리까지 채우는 내용에 쓴다. 기본값 false */
  flush?: boolean
  className?: string
  'aria-label'?: string
}

export function Card({
  children,
  href,
  as = 'div',
  flush = false,
  className,
  'aria-label': ariaLabel,
}: CardProps) {
  const padded = !flush

  if (href) {
    const link = (
      <Link
        href={href}
        aria-label={ariaLabel}
        className={cardClassName({ padded, interactive: true, className })}
      >
        {children}
      </Link>
    )

    // <ul> 안에서는 직계 자식이 <li>여야 하므로 한 겹 감싼다.
    return as === 'li' ? <li className="list-none">{link}</li> : link
  }

  const Element = as
  return (
    <Element
      aria-label={ariaLabel}
      className={cardClassName({ padded, className })}
    >
      {children}
    </Element>
  )
}
