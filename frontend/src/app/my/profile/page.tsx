import type { Metadata } from 'next'
import Link from 'next/link'

import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { ProfilePhotoRow } from '@/app/my/profile/photo-row'
import { PasswordRow } from '@/app/my/profile/password-row'
import { TabScreen } from '@/components/layout/TabScreen'
import { BackButton } from '@/components/nav/BackButton'
import { Button, ButtonLink } from '@/components/ui/Button'
import { removeProfileImage } from '@/lib/actions/profile'
import { requireUser } from '@/lib/auth'
import { loadAvatarUrl } from '@/lib/avatars'
import { isInternalEmail, usernameFromEmail } from '@/lib/username'

export const metadata: Metadata = { title: '내 정보 · 오늘도 사랑해' }

/**
 * 내 정보 (참고/마이_프로필탭_상세.png).
 *
 * 마이 화면 맨 위 카드를 누르면 여기로 온다. 하는 일은 세 가지뿐이다 —
 * 프로필 사진 바꾸기, 비밀번호 바꾸기, 계정 탈퇴로 가기.
 *
 * 이름(닉네임)은 여기서 바꾸지 않는다. 캡처에도 바꾸는 자리가 없고,
 * 이름은 방마다 상대가 나를 알아보는 표시라 조용히 바뀌면 안 된다.
 * (방별 별명은 별도 작업으로 예정되어 있다 — _workspace/PROGRESS.md)
 *
 * 사진 지우기 확인은 주소의 ?remove=1 로 편다. /my/blocks 의 차단 해제와 같은 방식이다 —
 * 브라우저 자바스크립트 없이도 동작하고, 되돌릴 수 없는 동작 앞에 한 걸음을 둔다.
 */
export default async function ProfilePage({
  searchParams,
}: PageProps<'/my/profile'>) {
  const [user, query] = await Promise.all([requireUser(), searchParams])

  const avatarUrl = await loadAvatarUrl(user.profile_image)

  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value
  const confirmingRemove = Boolean(user.profile_image) && first(query.remove) === '1'

  /*
    로그인 이름 한 줄.

    캡처는 이 자리에 이메일을 가려서(minkyu***@gmail.com) 보여준다.
    그런데 우리 계정의 식별자는 이메일이 아니라 **아이디**다. 그리고 아이디는 가리지 않는다 —
    내 화면에서 내 아이디를 못 읽게 하면 잊어버렸을 때 확인할 곳이 없어진다.
    가려야 할 것은 남에게 보이는 개인정보이지, 본인이 봐야 할 로그인 이름이 아니다.

    이메일 줄은 **개발 초기에 진짜 이메일로 가입한 계정에만** 뜬다. 그 값은
    사용자가 직접 적은 개인정보라 캡처대로 일부를 가린다.
    아이디로 만든 내부 주소(@id.oneuldo.local)는 적은 적이 없는 값이라 한 글자도 보여주지 않는다.
  */
  const loginId = user.username ?? usernameFromEmail(user.email)
  const signupEmail =
    !loginId && user.email && !isInternalEmail(user.email) ? user.email : null

  return (
    <TabScreen
      title="내 정보"
      leading={<BackButton href="/my" label="마이로 돌아가기" compact />}
    >
      <section className="flex flex-col items-center gap-4 rounded-card bg-card px-5 py-7 shadow-card">
        <h2 className="sr-only">내 프로필</h2>

        <div className="relative">
          <AvatarCircle url={avatarUrl} name={user.name} size="lg" />

          {/*
            사진 지우기(캡처의 작은 ×). 지울 사진이 없으면 아예 그리지 않는다 —
            눌러도 아무 일이 없는 버튼은 시니어 사용자에게 고장 난 화면으로 보인다.
            보이는 동그라미는 28px이지만 누를 수 있는 자리는 44px이다.
          */}
          {user.profile_image ? (
            <Link
              href="/my/profile?remove=1"
              aria-label="프로필 사진 지우기"
              className="absolute -top-2 -right-2 flex h-11 w-11 items-center justify-center"
            >
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline-strong bg-card text-muted shadow-chip"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                >
                  <path d="M6 6 18 18M18 6 6 18" />
                </svg>
              </span>
            </Link>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="text-xl font-bold break-keep text-ink">{user.name}</p>

          {loginId ? (
            <p className="text-base break-all text-muted">
              아이디 <span className="text-ink">{loginId}</span>
            </p>
          ) : signupEmail ? (
            <p className="text-base break-all text-muted">
              이메일 <span className="text-ink">{maskEmail(signupEmail)}</span>
            </p>
          ) : null}
        </div>

        {confirmingRemove ? (
          <div className="flex w-full flex-col gap-3 rounded-inner bg-surface-soft px-4 py-4">
            <p className="text-base leading-relaxed break-keep text-ink">
              프로필 사진을 지우고 기본 그림으로 되돌릴까요? 지운 사진은 다시
              가져올 수 없어요.
            </p>
            {/*
              되돌릴 수 없는 확정 동작이라 Button 기본 크기(lg)를 그대로 쓴다.
              폼 하나에 버튼 하나 — 자바스크립트가 없어도 그대로 동작한다.
            */}
            <form action={removeProfileImage}>
              <Button type="submit" fullWidth>
                사진 지우기
              </Button>
            </form>
            <ButtonLink href="/my/profile" variant="ghost" fullWidth>
              그만두기
            </ButtonLink>
          </div>
        ) : null}
      </section>

      {/*
        캡처와 같은 묶음. 사진·비밀번호는 "내 계정을 손보는 일"이라 한 카드에 모으고,
        계정 탈퇴는 성격이 달라 한 칸 띄워 따로 둔다.
      */}
      <section className="flex flex-col gap-4">
        <h2 className="sr-only">계정 설정</h2>

        <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-card bg-card shadow-card">
          <ProfilePhotoRow />
          <PasswordRow />
        </ul>

        {/*
          계정 탈퇴. 캡처처럼 빨간(강조색) 글자로 두되, 여기서 바로 지워지지 않는다 —
          탈퇴 화면에서 확인 문구를 직접 적어야 한다.
        */}
        <ul className="flex flex-col overflow-hidden rounded-card bg-card shadow-card">
          <li>
            <Link
              href="/my/withdraw"
              className="flex min-h-[52px] items-center justify-between gap-3 px-5 py-4 text-lg font-medium text-primary active:bg-surface-soft"
            >
              계정 탈퇴
              <span aria-hidden className="shrink-0 text-muted">
                ›
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </TabScreen>
  )
}

/**
 * 이메일 일부 가리기. 예) minkyunam@gmail.com → minkyu***@gmail.com
 *
 * 앞부분을 절반(최대 6자)만 남기고 나머지를 별로 덮는다. 남기는 글자 수를 고정하지 않는 이유:
 * 짧은 주소(ab@…)에서 고정 6자를 쓰면 가릴 것이 없어져 그대로 다 보인다.
 * 도메인은 가리지 않는다 — 어느 메일인지 알아야 본인 계정임을 알아볼 수 있다.
 */
function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at <= 0) return '***'

  const local = email.slice(0, at)
  const keep = Math.max(1, Math.min(6, Math.ceil(local.length / 2)))
  return `${local.slice(0, keep)}***${email.slice(at)}`
}
