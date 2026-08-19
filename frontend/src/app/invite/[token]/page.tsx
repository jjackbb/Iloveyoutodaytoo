import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { InviteLetter } from '@/components/invite/InviteLetter'
import { ButtonLink } from '@/components/ui/Button'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AcceptPanel } from './accept-panel'

/**
 * 이 화면은 로그인 없이도 열리고, 초대한 분의 실명·방 이름·첫 마디가 그대로 보인다.
 * 초대 링크는 문자·카카오톡으로 오가다 블로그나 공개 게시판에 붙는 일이 생기므로
 * 검색엔진이 주워 담지 못하게 막아둔다.
 */
export const metadata: Metadata = {
  title: '초대장 · 오늘도 사랑해',
  robots: { index: false, follow: false },
}

/**
 * 초대받은 사람이 여는 화면. 로그인 전에도 볼 수 있다(proxy.ts의 공개 경로).
 *
 * invitations 테이블을 토큰으로 직접 조회하지 않는다.
 * 로그인 안 한 사람도 볼 수 있어야 하므로 DB 함수 preview_invitation(p_token)만 쓴다.
 * 이 함수는 방 이름·초대한 사람 이름·첫 마디·상태(expired, used)만 돌려주고
 * 그 밖의 정보는 내주지 않는다.
 *
 * 판단 순서를 accept_invitation과 똑같이 맞춘다:
 *   ① 이미 그 방 구성원인가 → 통과 (used·expired와 무관하다)
 *   ② 이미 쓰인 링크인가(used)
 *   ③ 기간이 지났는가(expired)
 * DB 함수가 통과시키는 사람을 화면이 막으면, 들어갈 수 있는 분이 문 앞에서 되돌아간다.
 */
export default async function InvitePreviewPage({
  params,
}: PageProps<'/invite/[token]'>) {
  const { token } = await params

  const supabase = await createClient()
  const { data } = await supabase.rpc('preview_invitation', { p_token: token })

  const invitation = data?.[0] ?? null

  if (!invitation) {
    return (
      <Shell title="초대장을 찾지 못했어요">
        <p className="text-base leading-relaxed text-muted">
          링크가 중간에 잘렸거나, 초대장이 지워졌을 수 있어요. 초대해 주신 분께
          링크를 다시 한번 보내달라고 부탁해 보세요.
        </p>
        <ButtonLink href="/" variant="secondary" fullWidth>
          첫 화면으로
        </ButtonLink>
      </Shell>
    )
  }

  const user = await getCurrentUser()

  // ① 이미 이 방에 있는 분인지를 used·expired 확인보다 먼저 본다.
  // accept_invitation도 이 순서다 — 이미 구성원이면 링크가 이미 쓰였든 기간이
  // 지났든 그냥 통과시킨다. 화면이 여기서 막아버리면, 정작 들어갈 수 있는 분이
  // "쓸 수 없는 링크"라는 말을 듣고 방을 못 찾고 헤매게 된다.
  if (user) {
    const { data: membership } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', invitation.room_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (membership) {
      return (
        <Shell title={`이미 ‘${invitation.room_name}’에 함께 계세요`}>
          <p className="text-base leading-relaxed text-muted">
            바로 들어가서 오늘의 마음 한마디를 남겨보세요.
          </p>
          <ButtonLink href={`/rooms/${invitation.room_id}`} fullWidth>
            방으로 들어가기
          </ButtonLink>
        </Shell>
      )
    }
  }

  // ② 이미 한 분이 쓰고 닫힌 링크. 초대 링크는 한 번만 쓸 수 있다.
  //
  // 로그인 안 한 분에게는 단정하지 않는다. 이 화면은 로그인 전에도 열리는데,
  // 그 상태로는 이 분이 이미 그 방 구성원인지를 알 방법이 없다. 구성원이라면
  // accept_invitation은 통과시킨다 — "당신은 못 들어와요"라고 말해버리면 거짓말이 된다.
  if (invitation.used) {
    return user ? (
      <Shell title="이 초대장은 이미 사용됐어요">
        {/*
          "다른 분이 썼다"고 단정하지 않는다. preview_invitation은 used(boolean)만
          돌려주고 누가 썼는지는 알려주지 않는다. 실제로 이 링크로 들어왔다가
          방을 나간 분이 같은 링크를 다시 열면 여기로 오는데(활성 구성원이 아니라
          위 ①을 통과하지 못한다), 그분에게 "다른 분이 사용했어요"는 거짓말이다.
        */}
        <p className="text-base leading-relaxed text-muted">
          초대 링크는 한 분만 쓸 수 있어요. {invitation.inviter_name}님께 새 링크를
          부탁해보시면 ‘{invitation.room_name}’에 들어오실 수 있어요.
        </p>
        <ButtonLink href="/" variant="secondary" fullWidth>
          내 관계방 보러 가기
        </ButtonLink>
      </Shell>
    ) : (
      <Shell title="이 초대장은 이미 사용됐어요">
        <p className="text-base leading-relaxed text-muted">
          초대 링크는 한 분만 쓸 수 있어요. 혹시 이미 ‘{invitation.room_name}’에
          들어와 계신 분이라면, 로그인하시면 그대로 방으로 가실 수 있어요.
        </p>
        <p className="text-base leading-relaxed text-muted">
          처음 받으신 링크라면 {invitation.inviter_name}님께 새 링크를
          부탁해보세요.
        </p>
        <ButtonLink href={`/login?next=/invite/${encodeURIComponent(token)}`} fullWidth>
          로그인하고 확인하기
        </ButtonLink>
      </Shell>
    )
  }

  // ③ 기간이 지난 링크. used와 같은 이유로, 로그인 전에는 단정하지 않는다.
  if (invitation.expired) {
    return user ? (
      <Shell title="이 초대장은 기간이 지났어요">
        <p className="text-base leading-relaxed text-muted">
          {invitation.inviter_name}님이 보내주신 초대장이지만, 쓸 수 있는 기간이
          지났어요. 새 링크를 부탁드리면 다시 들어오실 수 있어요.
        </p>
        <ButtonLink href="/" variant="secondary" fullWidth>
          내 관계방 보러 가기
        </ButtonLink>
      </Shell>
    ) : (
      <Shell title="이 초대장은 기간이 지났어요">
        <p className="text-base leading-relaxed text-muted">
          {invitation.inviter_name}님이 보내주신 초대장이지만, 쓸 수 있는 기간이
          지났어요. 혹시 이미 ‘{invitation.room_name}’에 들어와 계신 분이라면,
          로그인하시면 그대로 방으로 가실 수 있어요.
        </p>
        <ButtonLink href={`/login?next=/invite/${encodeURIComponent(token)}`} fullWidth>
          로그인하고 확인하기
        </ButtonLink>
      </Shell>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-7 px-6 py-12">
      {/*
        보내는 분이 미리 보는 화면(방 > 초대하기)도 **이 부품을 그대로** 쓴다.
        미리 본 것과 실제로 가는 것이 달라지면 미리보기가 없느니만 못하다.
      */}
      <InviteLetter
        inviterName={invitation.inviter_name}
        relationshipLabel={invitation.relationship_label}
        roomName={invitation.room_name}
        message={invitation.invite_message}
      />

      {user ? (
        <AcceptPanel
          token={token}
          defaultLabel={invitation.relationship_label}
          roomName={invitation.room_name}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <ButtonLink
            href={`/login?next=/invite/${encodeURIComponent(token)}`}
            fullWidth
          >
            로그인하고 들어가기
          </ButtonLink>
          <p className="text-center text-base text-muted">
            처음이시라면{' '}
            <Link
              href={`/signup?next=/invite/${encodeURIComponent(token)}`}
              className="text-primary underline"
            >
              가입하기
            </Link>
            를 눌러 짧게 등록하고 오시면 돼요.
          </p>
        </div>
      )}
    </main>
  )
}

/** 안내 한 장짜리 화면(초대장 없음·이미 구성원·이미 사용됨·기간 지남)의 공통 껍데기. */
function Shell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-6 py-12 text-center">
      <h1 className="text-2xl font-bold leading-snug text-ink">{title}</h1>
      {children}
    </main>
  )
}
