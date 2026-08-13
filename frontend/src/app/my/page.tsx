import type { Metadata } from 'next'
import Link from 'next/link'

import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { TabScreen } from '@/components/layout/TabScreen'
import { Button } from '@/components/ui/Button'
import { signOut } from '@/lib/actions/auth'
import { requireUser } from '@/lib/auth'
import { loadAvatarUrl } from '@/lib/avatars'
import { kstDaysBetween } from '@/lib/format'

export const metadata: Metadata = { title: '마이 · 오늘도 사랑해' }

/**
 * 마이 — 내 정보와 로그아웃.
 *
 * 아래 탭(BottomNav)의 '마이'가 이 화면을 가리킨다. 이 파일이 없으면 탭이 404였다.
 *
 * 여기서 갈 수 있는 곳:
 *   /my/profile      내 정보(프로필 사진·비밀번호·탈퇴) — 맨 위 카드를 누르면 간다
 *   /my/blocks       차단한 분 목록(해제)
 *   /legal/terms     이용약관
 *   /legal/privacy   개인정보 처리방침
 *   /my/contact      문의하기(권리 행사·신고 접수 창구)
 *   /my/withdraw     회원 탈퇴
 * 방 나가기·구성원 차단은 각 방의 설정 화면(/rooms/{id}/settings)에 있다.
 *
 * 약관·처리방침 링크를 여기 둔 이유:
 * 이용약관 제3조 1항이 "서비스 내에 게시"를 요구한다. 가입 화면에만 있으면
 * 이미 가입한 사람은 자기가 무엇에 동의했는지 다시 볼 방법이 없다.
 *
 * 없는 기능을 있는 것처럼 버튼만 놓아두지 않는다 — 눌렀을 때 아무 일도 없으면
 * 시니어 사용자에게는 고장 난 화면으로 보인다.
 */
export default async function MyPage() {
  const user = await requireUser()

  // 사진은 비공개 버킷에 있어 서명된 주소가 필요하다. 안 올렸으면 요청 자체를 보내지 않는다.
  const avatarUrl = await loadAvatarUrl(user.profile_image)

  /*
    "함께한 지 N일째".

    가입한 날이 1일째다. 그래서 지난 날 수에 1을 더한다 —
    가입 당일에 "0일째"라고 적히면 아직 시작도 안 한 것처럼 읽힌다.
    KST 자정 기준으로 세므로 서버(UTC)와 기기 시간대가 달라도 숫자가 흔들리지 않는다.
  */
  const daysTogether = (kstDaysBetween(user.created_at, new Date()) ?? 0) + 1

  return (
    <TabScreen title="마이">
      {/*
        맨 위 프로필 카드 (참고/마이_프로필탭.png).

        예전에는 이름·아이디·가입일을 늘어놓은 **눌리지 않는** 카드였다.
        캡처는 카드 전체가 '내 정보'로 들어가는 입구다 — 오른쪽 › 화살표가 그 약속이다.
        아이디·이메일 같은 세부는 그 화면으로 옮겼다. 마이 첫 화면에는
        "나"와 "함께한 날" 두 가지만 남긴다.
      */}
      <section>
        <h2 className="sr-only">내 정보</h2>

        <Link
          href="/my/profile"
          className="flex items-center gap-4 rounded-card bg-card px-5 py-4 shadow-card active:bg-surface-soft"
        >
          <AvatarCircle url={avatarUrl} name={user.name} />

          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-xl font-bold text-ink">
              {user.name}
            </span>
            <span className="text-base break-keep text-muted">
              오늘도 사랑해와 함께한 지 {daysTogether}일째
            </span>
          </span>

          {/* 장식이라 낭독기에서 숨긴다 — 갈 곳은 이름과 화면 제목이 이미 말해준다. */}
          <span aria-hidden className="shrink-0 text-xl text-muted">
            ›
          </span>
        </Link>
      </section>

      {/*
        안전 관련 화면으로 가는 입구. 목록 모양으로 두어 나중에 항목이 늘어도
        화면이 흐트러지지 않게 했다.
      */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium text-ink">안전</h2>

        <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-card bg-card shadow-card">
          <MenuLink href="/my/blocks">차단한 분</MenuLink>
        </ul>
      </section>

      {/*
        약관·처리방침.
        '안전'과 한 목록에 섞지 않았다 — 차단은 내가 하는 동작이고 이 둘은 읽는 문서다.
        시니어 사용자에게는 성격이 다른 것을 같은 줄에 세우지 않는 편이 덜 헷갈린다.
      */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium text-ink">약관·정책</h2>

        <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-card bg-card shadow-card">
          <MenuLink href="/legal/terms">이용약관</MenuLink>
          <MenuLink href="/legal/privacy">개인정보 처리방침</MenuLink>
          {/*
            문의하기를 여기 둔 이유:
            개인정보 처리방침 제10조가 열람·정정·삭제·처리정지 요구를 "마이 > 문의하기"로
            받는다고 안내한다. 그 문장이 가리키는 화면이 바로 이 링크다.
          */}
          <MenuLink href="/my/contact">문의하기</MenuLink>
        </ul>
      </section>

      <form action={signOut}>
        <Button type="submit" variant="secondary" fullWidth>
          로그아웃
        </Button>
      </form>

      {/*
        회원 탈퇴.
        눈에 먼저 띄지 않도록 맨 아래 보조 위치에 작게 두되, 숨기지는 않는다 —
        개인정보보호법상 탈퇴는 가입만큼 쉽게 찾을 수 있어야 한다.
        실수로 눌려도 바로 지워지지 않는다. 탈퇴 화면에서 확인 문구를 직접 적어야 한다.
      */}
      <div className="flex justify-center pt-4">
        <Link
          href="/my/withdraw"
          className="inline-flex min-h-[44px] items-center rounded-[8px] px-3 text-base text-muted underline underline-offset-4 active:bg-surface-soft"
        >
          회원 탈퇴
        </Link>
      </div>
    </TabScreen>
  )
}

/**
 * 목록 한 줄.
 *
 * 손가락으로 짚기 쉽도록 줄 전체(52px 이상)가 링크다.
 * '›' 표시는 장식이라 낭독기에서 숨긴다 — 갈 곳은 글자가 이미 말해준다.
 */
function MenuLink({ href, children }: { href: string; children: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-[52px] items-center justify-between gap-3 px-5 py-4 text-lg text-ink active:bg-surface-soft"
      >
        {children}
        <span aria-hidden className="text-muted">
          ›
        </span>
      </Link>
    </li>
  )
}
