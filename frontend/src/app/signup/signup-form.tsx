'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { BirthDateField } from '@/components/ui/BirthDateField'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { signUp, type AuthState } from '@/lib/actions/auth'
import { needsGuardianConsent } from '@/lib/age'
import {
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_RULE_HINT,
  validateUsername,
} from '@/lib/username'

/**
 * 가입 폼.
 *
 * 입력칸과 버튼은 공용 부품(Field/Button)을 쓴다.
 * 예전에는 이 파일이 테두리·여백 클래스를 직접 들고 있었는데, 그러면
 * 시니어 기준(글자 크기·최소 52px 버튼)을 한 화면만 못 지키는 일이 생긴다.
 *
 * 묻는 것은 아이디와 비밀번호다. 이메일은 묻지 않는다 —
 * 계정 주소는 아이디로 만들어 서버에서 조립한다(lib/username.ts).
 */
export function SignupForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signUp,
    null,
  )
  const [birthDate, setBirthDate] = useState('')
  const [username, setUsername] = useState('')
  /** 한 번 칸을 벗어난 뒤에만 잔소리한다. 두 글자 쳤을 때부터 빨간 글씨면 성가시다. */
  const [usernameTouched, setUsernameTouched] = useState(false)

  const usernameError =
    usernameTouched && username ? validateUsername(username) : null

  // 만 14세 미만이면 법정대리인 동의 항목을 보여준다 (개인정보보호법)
  const minor = birthDate.length === 10 && needsGuardianConsent(birthDate)

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* 초대 링크를 타고 온 사람을 가입 후 그 초대장으로 돌려보내기 위한 값 */}
      <input type="hidden" name="next" value={next} />

      {/*
        defaultValue가 붙은 칸들의 사정:
        React는 폼 액션이 끝나면 제어하지 않는 입력칸을 비운다. 아이디 중복 하나 때문에
        이름·보호자 칸·약관 체크가 통째로 지워져 처음부터 다시 적어야 했다.
        서버가 실패하면서 값을 함께 돌려주고(AuthState.values), 여기서 다시 채운다.
        비밀번호만 일부러 안 채운다 — 서버가 돌려준 비밀번호가 화면에 남으면 안 된다.
      */}
      <Field
        id="name"
        name="name"
        label="이름"
        required
        autoComplete="name"
        defaultValue={state?.values?.name}
      />

      {/*
        생년월일 칸은 버튼이라 브라우저의 required가 걸리지 않는다(누르면 시트가 뜨는 칸이다).
        비어 있는 채로 제출하면 서버가 "생년월일을 입력해주세요."로 되돌려준다.
      */}
      <BirthDateField name="birth_date" onValueChange={setBirthDate} />

      {minor ? (
        <fieldset className="flex flex-col gap-4 rounded-[14px] bg-primary-soft p-4">
          <legend className="px-1 text-base font-medium text-primary">
            보호자 동의가 필요해요
          </legend>
          <p className="text-base leading-relaxed text-ink">
            만 14세 미만은 법에 따라 법정대리인의 동의가 있어야 가입할 수 있어요.
            보호자와 함께 입력해주세요.
          </p>

          <Field
            id="guardian_name"
            name="guardian_name"
            label="보호자 성함"
            required
            defaultValue={state?.values?.guardianName}
          />

          <Field
            id="guardian_phone"
            name="guardian_phone"
            label="보호자 연락처"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            defaultValue={state?.values?.guardianPhone}
          />

          <label className="flex min-h-[44px] items-center gap-3 text-base text-ink">
            <input
              type="checkbox"
              name="guardian_consented"
              required
              className="size-6 shrink-0 accent-[#d50e68]"
            />
            <span>보호자가 이 가입에 동의합니다.</span>
          </label>
        </fieldset>
      ) : null}

      {/*
        아이디는 대문자·한글이 섞이면 계정 주소를 만들 수 없어서(lib/username.ts)
        치는 대로 소문자로 맞춰준다. 지우지는 않는다 — 글자가 조용히 사라지면
        무엇을 잘못했는지 알 수 없으니, 규칙에 어긋나는 글자는 아래 문구로 알린다.
      */}
      <Field
        id="username"
        name="username"
        label="아이디"
        hint={`${USERNAME_RULE_HINT}. 로그인할 때 쓰는 이름이에요.`}
        error={usernameError}
        autoComplete="username"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={USERNAME_MAX_LENGTH}
        required
        value={username}
        onChange={(event) => setUsername(normalizeUsername(event.target.value))}
        onBlur={() => setUsernameTouched(true)}
      />

      <Field
        id="password"
        name="password"
        label="비밀번호"
        hint="8자 이상으로 만들어주세요."
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />

      <label className="flex min-h-[44px] items-start gap-3 text-base leading-relaxed text-ink">
        <input
          type="checkbox"
          name="agree_terms"
          required
          defaultChecked={state?.values?.agreed}
          className="mt-1 size-6 shrink-0 accent-[#d50e68]"
        />
        {/*
          두 링크는 반드시 새 탭에서 연다.
          같은 탭에서 열면 지금 적어둔 이름·생년월일·아이디·비밀번호가 전부 사라진다.
          게다가 아직 로그인 전이라 약관 화면에서 되돌아올 길이 마땅치 않아
          (홈으로 가면 proxy가 /login으로 보낸다) 처음부터 다시 적어야 했다.
          rel은 새 탭이 이 화면을 조작하지 못하게 막는 짝꿍이다.
        */}
        <span>
          <Link
            href="/legal/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            이용약관
          </Link>
          과{' '}
          <Link
            href="/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            개인정보 처리방침
          </Link>
          에 동의합니다. (새 창에서 열려요)
        </span>
      </label>

      {state?.error ? (
        <p role="alert" className="text-base text-primary">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" fullWidth pending={pending} pendingText="만드는 중…">
        시작하기
      </Button>

      <p className="text-center text-base text-muted">
        이미 계정이 있으신가요?{' '}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="text-primary underline"
        >
          로그인
        </Link>
      </p>
    </form>
  )
}
