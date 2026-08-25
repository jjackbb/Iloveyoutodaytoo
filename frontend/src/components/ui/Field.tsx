import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react'

/**
 * 공용 폼 필드. 라벨 + 입력칸 + 도움말 + 오류 메시지를 한 덩어리로 묶는다.
 *
 * 라벨은 htmlFor/id로 입력칸과 연결되고, 도움말·오류는 aria-describedby로 이어진다.
 * 화면 낭독기를 쓰는 분도 무엇을 입력하는 칸인지 알 수 있어야 한다.
 */

// 입력칸은 흰색(card)이다. 바탕(canvas)과 같은 색이면 "여기에 쓰세요"로 안 읽힌다.
const CONTROL_CLASS =
  'w-full rounded-inner border border-hairline-strong bg-card px-4 py-3 text-lg text-ink ' +
  'placeholder:text-muted focus:border-primary disabled:bg-canvas disabled:text-muted'

const CONTROL_ERROR_CLASS = 'border-primary'

/** 입력칸 모양 클래스. select 등 직접 만든 컨트롤에 쓴다. */
export function controlClassName(options?: {
  hasError?: boolean
  className?: string
}): string {
  const { hasError, className } = options ?? {}
  return [CONTROL_CLASS, hasError ? CONTROL_ERROR_CLASS : '', className ?? '']
    .filter(Boolean)
    .join(' ')
}

export interface FieldShellProps {
  /** 안에 든 컨트롤의 id와 반드시 같아야 한다. */
  id: string
  label: ReactNode
  /** 입력 방법을 알려주는 짧은 안내. */
  hint?: ReactNode
  /** 오류 메시지. 있으면 빨간 문구가 뜨고 aria-invalid가 켜진다. */
  error?: string | null
  /** 라벨 오른쪽에 붙는 것(글자 수 표시 등). */
  labelSuffix?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * 라디오 묶음, 파일 선택처럼 직접 만든 컨트롤을 감쌀 때 쓴다.
 * 도움말 id는 `${id}-hint`, 오류 id는 `${id}-error`다.
 */
export function FieldShell({
  id,
  label,
  hint,
  error,
  labelSuffix,
  className,
  children,
}: FieldShellProps) {
  return (
    <div
      className={['flex flex-col gap-2', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-base font-medium text-ink">
          {label}
        </label>
        {/*
          글자 수 표시 등. 라벨과 같은 17px이고, 위계는 색(text-muted)으로만 구분한다.
          숫자가 바뀔 때 폭이 흔들리지 않도록 tabular-nums, 줄바꿈으로 밀리지 않도록 shrink-0.
        */}
        {labelSuffix ? (
          <span className="shrink-0 tabular-nums text-base text-muted">
            {labelSuffix}
          </span>
        ) : null}
      </div>

      {/*
        p 가 아니라 div 인 이유: 도움말 자리에 규칙 체크 목록(RuleList)이 들어오는
        화면이 있는데, <p> 안에는 <ul>을 넣을 수 없다(브라우저가 태그를 끊어버린다).
        글자만 들어올 때의 모양은 이전과 같다.
      */}
      {hint ? (
        <div id={`${id}-hint`} className="text-base leading-relaxed text-muted">
          {hint}
        </div>
      ) : null}

      {children}

      {error ? (
        <p id={`${id}-error`} role="alert" className="text-base text-primary">
          {error}
        </p>
      ) : null}
    </div>
  )
}

type FieldCommonProps = Omit<FieldShellProps, 'children'>

export type FieldProps =
  | (FieldCommonProps & {
      as?: 'input'
    } & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'>)
  | (FieldCommonProps & {
      as: 'textarea'
    } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'>)

/**
 * 한 줄 입력(기본) 또는 여러 줄 입력(as="textarea").
 *
 * 예)
 *   <Field id="roomName" name="name" label="방 이름" hint="엄마, 우리 가족처럼 부르기 쉬운 이름" error={state?.error} required />
 *   <Field id="message" name="content" label="오늘의 한마디" as="textarea" rows={4} />
 */
export function Field({
  id,
  label,
  hint,
  error,
  labelSuffix,
  className,
  ...rest
}: FieldProps) {
  const { as = 'input', ...control } = rest as {
    as?: 'input' | 'textarea'
  } & Record<string, unknown>

  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(' ') || undefined

  const shared = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? (true as const) : undefined,
    className: controlClassName({ hasError: Boolean(error) }),
  }

  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      labelSuffix={labelSuffix}
      className={className}
    >
      {as === 'textarea' ? (
        <textarea
          {...shared}
          {...(control as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          {...shared}
          {...(control as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
    </FieldShell>
  )
}
