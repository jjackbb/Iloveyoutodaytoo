'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'

import { BirthDateField } from '@/components/ui/BirthDateField'
import { Button } from '@/components/ui/Button'
import { controlClassName, Field, FieldShell } from '@/components/ui/Field'
import { RuleList } from '@/components/ui/RuleList'
import { signUp, type AuthState } from '@/lib/actions/auth'
import { checkUsername, type UsernameCheck } from '@/lib/actions/username'
import { needsGuardianConsent } from '@/lib/age'
import { track } from '@/lib/analytics'
import {
  normalizeUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
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
  /*
    이름은 이제 화면이 들고 있는다(제어 입력).
    [아무 이름이나 넣어주세요]가 칸을 채우려면 값을 쥐고 있어야 하고,
    저장에 실패했을 때 서버가 돌려준 값으로 시작해야 다시 적지 않아도 된다.
  */
  /*
    가입 퍼널 계측.

    `signup_field_error` 의 field 가 이 서비스에서 사람들이 실제로 막히는 칸을
    알려준다. 오류 문구만 세면 "가입에서 막혔다"까지밖에 못 보고, 그러면
    어느 칸을 고쳐야 할지 알 수 없다.

    성공은 여기서 못 본다 — 서버가 곧바로 다른 화면으로 보내기 때문이다.
    도착한 화면의 SignupBeacon 이 대신 보낸다.
  */
  useEffect(() => {
    track('signup_begin')
  }, [])

  useEffect(() => {
    if (state?.error && state.field) {
      track('signup_field_error', { field: state.field })
    }
  }, [state])

  const [name, setName] = useState(state?.values?.name ?? '')

  const [birthDate, setBirthDate] = useState('')
  const [username, setUsername] = useState('')
  /*
    비밀번호도 제어 입력으로 바꿨다 — 아래 규칙 목록에 불이 들어오려면
    지금 몇 글자인지를 화면이 알아야 한다.
    실패하고 돌아왔을 때 **일부러 안 채운다**(서버가 돌려준 비밀번호를 화면에 남기지 않는다).
  */
  const [password, setPassword] = useState('')
  /*
    중복확인 결과.

    아이디를 한 글자라도 고치면 **반드시 비운다** — 다른 아이디에 대해 받은
    "쓸 수 있어요"가 그대로 남아 있으면 거짓말이 된다.
    확인하지 않고 제출해도 막지 않는다. 진짜 방어선은 users.username 의 unique 제약이고
    이건 미리 알려주는 편의일 뿐이다.
  */
  const [check, setCheck] = useState<UsernameCheck | null>(null)
  const [checking, setChecking] = useState(false)

  /*
    화면에 거는 규칙들.

    ⚠️ 서버가 실제로 보는 것보다 **느슨하면 안 된다** — 전부 체크됐는데 퇴짜를 맞으면
    사용자는 이유를 알 수 없다. 아이디 규칙은 validateUsername 과 같은 조건을 쓰고,
    비밀번호는 minLength(8)과 같은 값을 쓴다.

    이름은 반대로 **서버보다 엄격하다.** 서버는 비어 있지만 않으면 받는데
    여기서는 2자 이상·특수문자 없음을 권한다. 전부터 안내 문구가 그렇게 말해 왔고,
    막지는 않으므로(제출은 그대로 된다) 권장으로 읽힌다.
  */
  const trimmedName = name.trim()
  const nameRules = [
    { label: '2~10자', met: trimmedName.length >= 2 && trimmedName.length <= 10 },
    {
      label: '특수문자 없이',
      met:
        trimmedName.length > 0 &&
        !/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ]/.test(trimmedName),
    },
  ]

  const usernameRules = [
    {
      label: '영문 소문자와 숫자만',
      met: username.length > 0 && !/[^a-z0-9]/.test(username),
    },
    {
      label: `${USERNAME_MIN_LENGTH}~${USERNAME_MAX_LENGTH}자`,
      met:
        username.length >= USERNAME_MIN_LENGTH &&
        username.length <= USERNAME_MAX_LENGTH,
    },
  ]

  const passwordRules = [{ label: '8자 이상', met: password.length >= 8 }]

  /** 형식이 틀린 아이디는 물어볼 것도 없다. 규칙이 다 켜져야 [중복확인]이 열린다. */
  const usernameReady = usernameRules.every((rule) => rule.met)

  const handleCheck = async () => {
    setChecking(true)
    try {
      setCheck(await checkUsername(username))
    } finally {
      setChecking(false)
    }
  }

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
      {/*
        어떻게 불러드릴까요 (캡처 02·03).
        캡처는 이 질문을 가입 다음의 별도 화면에 뒀지만, 여기 이미 같은 것을 묻는 칸이
        있어서 한 화면에 둔다 — 같은 것을 두 번 물으면 "아까 적었는데?"가 된다.
        캡처에서 가져온 것은 **[아무거나] 버튼과 규칙 두 줄**이다.
      */}
      <FieldShell id="name" label="어떻게 불러드릴까요?">
        <div className="flex items-stretch gap-2">
          <input
            id="name"
            name="name"
            required
            maxLength={10}
            autoComplete="name"
            aria-describedby="name-hint"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={controlClassName({ className: 'min-w-0 flex-1' })}
          />

          {/*
            이름 짓기가 막막한 분을 위한 길 (캡처 02의 [랜덤 입력]).
            아무 이름이나 넣는 것이 아니라 **다정한 이름 중 하나**를 넣는다 —
            이 앱에서 이름은 서로를 부르는 말이다.

            높이를 입력칸에 맞춰 못 박는다(52px). 버튼 기본값(md=44px)을 쓰면
            옆의 입력칸보다 낮아서 두 개가 한 줄로 안 읽힌다.
          */}
          <Button
            variant="secondary"
            size="md"
            onClick={() => setName(randomName())}
            className="min-h-[52px] shrink-0 px-5"
          >
            랜덤
          </Button>
        </div>

        {/* 규칙은 입력칸 **아래**에 둔다 — 치면서 바로 아래에서 불이 들어와야 눈이 안 흔들린다 */}
        <RuleList id="name-hint" rules={nameRules} />
      </FieldShell>

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
              className="size-6 shrink-0 accent-primary"
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
      <FieldShell id="username" label="아이디">
        <div className="flex items-stretch gap-2">
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={USERNAME_MAX_LENGTH}
            required
            aria-describedby="username-rules"
            value={username}
            onChange={(event) => {
              setUsername(normalizeUsername(event.target.value))
              // 아이디가 바뀌면 앞서 받은 결과는 남의 것이다. 즉시 버린다.
              setCheck(null)
            }}
            className={controlClassName({ className: 'min-w-0 flex-1' })}
          />

          <Button
            variant="secondary"
            size="md"
            onClick={handleCheck}
            disabled={!usernameReady || checking}
            pending={checking}
            pendingText="확인 중"
            className="min-h-[52px] shrink-0 px-4"
          >
            중복확인
          </Button>
        </div>

        <RuleList id="username-rules" rules={usernameRules} />

        {check ? (
          <p
            role="status"
            className={[
              'text-base leading-relaxed',
              check.status === 'available'
                ? 'font-medium text-primary'
                : 'text-muted',
            ].join(' ')}
          >
            {check.status === 'available'
              ? '쓸 수 있는 아이디예요.'
              : check.status === 'taken'
                ? '이미 쓰고 있는 아이디예요. 다른 아이디로 만들어주세요.'
                : check.status === 'invalid'
                  ? check.message
                  : '지금은 확인할 수 없어요. 잠시 후 다시 눌러주세요.'}
          </p>
        ) : null}
      </FieldShell>

      <FieldShell id="password" label="비밀번호">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          aria-describedby="password-hint"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={controlClassName()}
        />

        <RuleList id="password-hint" rules={passwordRules} />
      </FieldShell>

      <label className="flex min-h-[44px] items-start gap-3 text-base leading-relaxed text-ink">
        <input
          type="checkbox"
          name="agree_terms"
          required
          defaultChecked={state?.values?.agreed}
          className="mt-1 size-6 shrink-0 accent-primary"
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
          에 동의합니다.
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

/**
 * 이름이 막막할 때 넣어줄 다정한 이름들 (캡처 02의 [랜덤 입력]).
 *
 * 아무 글자나 만들어 넣지 않는다 — 이 앱에서 이름은 가족이 서로를 부르는 말이다.
 * 규칙(2~10자, 특수문자 없음)을 이미 지키는 값만 둔다.
 */
const FRIENDLY_NAMES = [
  '햇살', '포근한하루', '봄바람', '달빛', '토닥토닥', '단짝',
  '따뜻한마음', '오늘도맑음', '별하나', '소중한사람',
] as const

function randomName(): string {
  return FRIENDLY_NAMES[Math.floor(Math.random() * FRIENDLY_NAMES.length)]
}
