'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { changePassword, type PasswordState } from '@/lib/actions/profile'
import { PASSWORD_MIN_LENGTH } from '@/lib/limits'

/**
 * "비밀번호 변경" 한 줄 + 그 다이얼로그 (참고/마이_프로필탭_상세.png).
 *
 * 왜 화면을 새로 만들지 않고 다이얼로그인가:
 * 비밀번호 변경은 한 번에 끝나는 짧은 일이고, 끝나면 곧바로 원래 자리로 돌아와야 한다.
 * 별도 화면으로 만들면 뒤로 가기를 한 번 더 눌러야 하고, 중간에 화면을 나가면
 * 적던 값이 어디로 갔는지 알 수 없다. <dialog>는 초점 가두기·Esc·뒤 화면 잠금이
 * 브라우저에 이미 들어 있어 직접 만들 때 놓치기 쉬운 셋을 공짜로 얻는다.
 *
 * 목록에 놓이는 부품이라 <li>를 직접 그린다. 감싸는 <ul>은 서버 화면에 있다.
 */
export function PasswordRow() {
  const [open, setOpen] = useState(false)

  /*
    다이얼로그를 열 때마다 1씩 올린다. 이 값을 key로 주면 다이얼로그가 통째로
    새로 만들어져 **적던 값과 지난 결과가 남지 않는다.**
    useActionState는 한 번 담긴 결과를 스스로 비우지 못한다 — 그대로 두면
    다시 열었을 때 지난번 "바꿨어요"가 그대로 떠 있다. 폐기된 프로토타입이
    화면을 지우지 않아 생기던 문제와 같은 종류라, 애초에 남지 않게 만든다.
  */
  const [session, setSession] = useState(0)

  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={() => {
          setSession((value) => value + 1)
          setOpen(true)
        }}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 px-5 py-4 text-left text-lg text-ink active:bg-surface-soft"
      >
        비밀번호 변경
        <span aria-hidden className="shrink-0 text-muted">
          ›
        </span>
      </button>

      {open ? (
        <PasswordDialog key={session} onClose={() => setOpen(false)} />
      ) : null}
    </li>
  )
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(
    changePassword,
    null,
  )

  const dialogRef = useRef<HTMLDialogElement>(null)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')

  // showModal이라야 초점이 갇히고 뒤 화면이 잠긴다.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()
  }, [])

  const filled = Boolean(current && next && confirm)
  const matched = next === confirm

  /*
    사용자 지시: 세 칸이 다 차고 새 비밀번호와 확인이 같아야만 제출 버튼이 열린다.
    버튼을 잠글 때는 **왜 안 눌리는지**를 반드시 화면에 적어야 한다 —
    잠긴 버튼만 있고 이유가 없으면 시니어 사용자에게는 고장 난 화면이 된다.
  */
  const canSubmit = filled && matched
  const mismatchHint = confirm && !matched ? '새 비밀번호와 확인이 서로 달라요.' : null

  const fieldError = (name: 'current' | 'next' | 'confirm') =>
    state?.status === 'error' && state.field === name ? state.message : null
  const formError =
    state?.status === 'error' && !state.field ? state.message : null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="password-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      /*
        m-auto를 직접 준다. <dialog>는 원래 margin:auto로 화면 가운데에 서는데,
        Tailwind 프리플라이트가 모든 요소의 margin을 0으로 되돌려 왼쪽 위에 붙어 버린다.
        max-h + overflow-y: 글자 크기를 키운 기기에서 내용이 화면보다 길어져도
        아래 버튼까지 닿을 수 있어야 한다.
      */
      className="m-auto max-h-[calc(100dvh-40px)] w-[calc(100vw-40px)] max-w-md overflow-y-auto rounded-card border-0 bg-card p-0 text-ink shadow-card backdrop:bg-ink/50"
    >
      {state?.status === 'done' ? (
        <div role="status" className="flex flex-col gap-5 px-5 py-6">
          <h2 id="password-dialog-title" className="text-xl font-bold text-ink">
            비밀번호를 바꿨어요
          </h2>
          <p className="text-base leading-relaxed break-keep text-muted">
            {state.message}
          </p>
          <Button fullWidth onClick={onClose}>
            확인
          </Button>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-5 px-5 py-6">
          <h2 id="password-dialog-title" className="text-xl font-bold text-ink">
            비밀번호 변경
          </h2>

          <Field
            id="current_password"
            name="current_password"
            type="password"
            label="지금 쓰는 비밀번호"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            error={fieldError('current')}
            required
          />

          <Field
            id="new_password"
            name="new_password"
            type="password"
            label="새 비밀번호"
            hint={`${PASSWORD_MIN_LENGTH}자 이상으로 만들어주세요.`}
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            error={fieldError('next')}
            required
          />

          <Field
            id="confirm_password"
            name="confirm_password"
            type="password"
            label="새 비밀번호 확인"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            error={fieldError('confirm') ?? mismatchHint}
            required
          />

          {formError ? (
            <p role="alert" className="text-base break-keep text-primary">
              {formError}
            </p>
          ) : null}

          {/*
            버튼이 잠겨 있는 이유를 글로 알린다. aria-describedby가 아니라 눈에 보이는
            문구로 두는 이유: 이 화면을 쓰는 분 대부분은 낭독기를 켜지 않는다.
          */}
          {!canSubmit ? (
            <p className="text-base break-keep text-muted">
              세 칸을 모두 채우고 새 비밀번호와 확인을 같게 적으면 아래 버튼이
              눌려요.
            </p>
          ) : null}

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              fullWidth
              disabled={!canSubmit}
              pending={pending}
              pendingText="바꾸는 중…"
            >
              비밀번호 바꾸기
            </Button>
            <Button
              type="button"
              variant="ghost"
              fullWidth
              disabled={pending}
              onClick={onClose}
            >
              그만두기
            </Button>
          </div>
        </form>
      )}
    </dialog>
  )
}
