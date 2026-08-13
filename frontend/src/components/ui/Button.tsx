import Link from 'next/link'
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from 'react'

/**
 * 공용 버튼.
 *
 * 시니어 사용자가 주요 대상이라 기본 크기를 크게 잡았다(최소 52px).
 * 흰 글자는 bg-primary(#d50e68) 위에만 올린다 — 로고 원본색은 대비가 모자란다.
 *
 * 크기 고르는 법 (사용자가 확정한 기준):
 * - lg  기본값. 되돌릴 수 없거나 중요한 확정 동작은 **반드시 lg**다.
 *       예) 탈퇴하기, 차단하기, 방 나가기, 초대 취소·삭제, 마음 보내기.
 *       size를 아예 넘기지 않으면 lg가 된다 — 확정 버튼은 그냥 비워 두는 편이 안전하다.
 * - md  되돌릴 수 있고 무게가 가벼운 보조 동작에만 쓴다.
 *       예) 신고 버튼, 녹음 다시 하기처럼 눌러도 잃는 게 없는 것.
 *       md도 글자는 17px(text-base) 이상이고 터치 목표 44px는 지킨다.
 *
 * 글자 크기는 두 크기 모두 17px 이상이다. 어떤 경우에도 이보다 작게 만들지 마라.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'lg' | 'md'

const BASE_CLASS =
  // 모서리 17px·굵기 800은 프로토타입 값이다. 얇은 글씨로는 그 눌린 느낌이 안 난다.
  'inline-flex items-center justify-center gap-2 rounded-button font-extrabold ' +
  'tracking-[-0.01em] transition-colors select-none ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:opacity-60'

const SIZE_CLASS: Record<ButtonSize, string> = {
  // 기본(52px). 손이 불편한 분도 편하게 누를 수 있는 크기.
  // 되돌릴 수 없거나 중요한 확정 동작은 예외 없이 이 크기를 쓴다.
  lg: 'min-h-[52px] px-6 py-3 text-lg',
  // 보조 동작 전용(44px). 눌러도 되돌릴 수 있는 것에만 쓴다.
  // 확정 동작에는 쓰지 마라 — "네, 취소할게요" 같은 버튼이 md면 lg로 올려야 한다.
  md: 'min-h-[44px] px-5 py-2.5 text-base',
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  // 그라데이션·그림자·눌림은 .btn-primary-surface 한 곳에 모아뒀다(globals.css).
  primary: 'btn-primary-surface text-white',
  // 카드 위에 놓이는 일이 많아 바탕을 canvas가 아니라 card(흰색)로 둔다.
  secondary:
    'border-2 border-primary bg-card text-primary hover:bg-primary-soft active:bg-primary-soft',
  ghost:
    'bg-transparent text-primary hover:bg-primary-soft active:bg-primary-soft',
}

/**
 * 버튼 모양의 클래스 문자열.
 * <label>이나 <a> 같은 다른 태그를 버튼처럼 보이게 할 때 쓴다.
 * (예: 파일 선택 label)
 */
export function buttonClassName(options?: {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  className?: string
}): string {
  const {
    variant = 'primary',
    size = 'lg',
    fullWidth,
    className,
  } = options ?? {}

  return [
    BASE_CLASS,
    SIZE_CLASS[size],
    VARIANT_CLASS[variant],
    fullWidth ? 'w-full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
}

export interface ButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  variant?: ButtonVariant
  /** 기본 'lg'. 되돌릴 수 없거나 중요한 확정 동작은 'md'로 내리지 마라. */
  size?: ButtonSize
  /** 가로를 꽉 채운다. 폼 제출 버튼에 주로 쓴다. */
  fullWidth?: boolean
  /**
   * 처리 중인지 여부. true면 버튼이 잠기고 문구가 pendingText로 바뀐다.
   * useActionState의 pending 값을 그대로 넘기면 된다.
   */
  pending?: boolean
  /** 처리 중일 때 보여줄 문구. 기본값 "잠시만요…" */
  pendingText?: ReactNode
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'lg',
  fullWidth,
  pending = false,
  pendingText = '잠시만요…',
  className,
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...rest}
    >
      {pending ? pendingText : children}
    </button>
  )
}

export interface ButtonLinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'children'
> {
  href: string
  variant?: ButtonVariant
  /** 기본 'lg'. 이동 링크라도 중요한 다음 단계로 가는 것은 lg로 둔다. */
  size?: ButtonSize
  fullWidth?: boolean
  children: ReactNode
}

/** 버튼처럼 보이는 링크. 이동이 목적일 때는 button 대신 이걸 쓴다. */
export function ButtonLink({
  href,
  variant = 'primary',
  size = 'lg',
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...rest}
    >
      {children}
    </Link>
  )
}
