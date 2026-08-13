'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { signIn, type AuthState } from '@/lib/actions/auth'

/**
 * 로그인 폼.
 *
 * 입력칸과 버튼은 공용 부품(Field/Button)을 쓴다 — 가입 폼과 똑같은 모양이어야
 * 두 화면을 오가는 분이 헷갈리지 않는다.
 */
export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signIn,
    null,
  )

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* 초대 링크 등 원래 가려던 곳. 값 검사는 서버의 safeNextPath가 한 번 더 한다. */}
      <input type="hidden" name="next" value={next} />

      {/*
        아이디 한 칸이다. 이메일은 묻지 않는다.
        (개발 초기에 이메일로 만든 계정은 이 칸에 그 이메일을 적으면 그대로 들어간다.
         서버의 resolveLoginEmail이 `@`가 있는지로 갈라 본다.)
      */}
      <Field
        id="username"
        name="username"
        label="아이디"
        autoComplete="username"
        autoCapitalize="off"
        spellCheck={false}
        required
      />

      <Field
        id="password"
        name="password"
        label="비밀번호"
        type="password"
        autoComplete="current-password"
        required
      />

      {state?.error ? (
        <p role="alert" className="text-base text-primary">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        fullWidth
        pending={pending}
        pendingText="들어가는 중…"
      >
        로그인
      </Button>

      <p className="text-center text-base text-muted">
        아직 계정이 없으신가요?{' '}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="text-primary underline"
        >
          가입하기
        </Link>
      </p>
    </form>
  )
}
