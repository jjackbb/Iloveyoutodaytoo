import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LeavePanel } from './leave-panel'
import { MemberList, type RoomMemberView } from './member-list'
import { RoomAppBar } from '@/components/room/RoomAppBar'
import { requireUser } from '@/lib/auth'
import { MyLookPanel } from '@/app/rooms/[roomId]/settings/my-look-panel'
import { roomMemberName } from '@/lib/member-name'
import { loadMyRoomLook } from '@/lib/room-look'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: '방 설정 · 오늘도 사랑해' }

/** 커버 사진 주소의 유효 시간(초). 설정 화면을 오래 열어둬도 안 끊길 만큼만. */
const COVER_URL_TTL_SEC = 60 * 60

/**
 * 방 설정 — 함께 있는 분들과 이 방에서 나가기.
 *
 * 이 방의 구성원이 맞는지는 상위 layout.tsx가 이미 확인했다(아니면 홈으로 보낸다).
 * 여기서는 구성원 목록과 "내가 차단한 사람"만 챙겨서 화면 조각에 넘긴다.
 *
 * 차단 여부를 여기서 미리 읽는 이유:
 * blocks에는 RLS(blocker_id = auth.uid())가 걸려 있어 내 차단 기록만 돌아온다.
 * 남이 누구를 차단했는지는 알 수 없다 — 알 필요도 없다.
 */
export default async function RoomSettingsPage({
  params,
}: PageProps<'/rooms/[roomId]/settings'>) {
  const { roomId } = await params
  const user = await requireUser()
  const supabase = await createClient()

  const [look, membersResult] = await Promise.all([
    loadMyRoomLook(roomId),
    supabase
      .from('room_members')
      // 한 줄로 둔다 — 문자열을 이어 붙이면 타입 추론이 풀려서 결과가 unknown이 된다.
      .select(
        'id, user_id, nickname, relationship_label, role, joined_at, user:users!room_members_user_id_fkey(id, name)',
      )
      .eq('room_id', roomId)
      .eq('status', 'active')
      .order('joined_at', { ascending: true }),
  ])

  if (membersResult.error) {
    console.error('[방 설정] 구성원 조회 실패:', membersResult.error.message)
    return (
      <RoomSettingsShell roomId={roomId}>
        <p role="alert" className="text-lg leading-relaxed text-primary">
          방 정보를 불러오지 못했어요. 잠시 후 다시 열어주세요.
        </p>
      </RoomSettingsShell>
    )
  }

  const activeMembers = membersResult.data ?? []
  const myMembership = activeMembers.find((member) => member.user_id === user.id)

  // 레이아웃이 이미 걸러주지만, 데이터를 다루기 전에 여기서도 한 번 더 확인한다.
  if (!myMembership) redirect('/')

  const others = activeMembers.filter((member) => member.user_id !== user.id)

  // 내가 차단한 사람만 뽑아온다. 이 방에 있는 분들 중에서만 확인하면 충분하다.
  //
  // null = 조회가 실패해서 "모른다". 빈 Set(= 차단한 분이 없다)과 반드시 구분해야 한다.
  // 둘을 뭉뚱그리면 조회가 실패했을 때 "다시 초대받으면 돌아올 수 있어요"라는
  // 지킬 수 없는 안내가 나간다.
  let blockedIds: Set<string> | null = new Set<string>()
  if (others.length > 0) {
    const { data: blocks, error: blocksError } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id)
      .in(
        'blocked_id',
        others.map((member) => member.user_id),
      )

    if (blocksError) {
      // 차단 표시가 빠져도 목록 자체는 보여준다. 원인은 로그에 남긴다.
      // 다만 "차단한 분이 없다"고 단정하지는 않는다 — 아래로 '모름'을 넘긴다.
      console.error('[방 설정] 차단 여부 조회 실패:', blocksError.message)
      blockedIds = null
    } else {
      blockedIds = new Set((blocks ?? []).map((row) => row.blocked_id))
    }
  }

  const members: RoomMemberView[] = activeMembers.map((member) => ({
    memberId: member.id,
    userId: member.user_id,
    /*
      이 방에서 부르는 이름. 본인이 정한 별명이 있으면 그것, 없으면 전역 이름이다.
      피드·갤러리와 같은 규칙을 쓴다(@/lib/member-name) — 같은 사람이 화면마다
      다른 이름으로 보이면 두 화면이 서로 다른 사람 얘기를 하는 것처럼 읽힌다.
    */
    name: roomMemberName({
      userId: member.user_id,
      nickname: member.nickname,
      name: member.user?.name,
    }),
    label: member.relationship_label,
    isAdmin: member.role === 'admin',
    joinedAt: member.joined_at,
    isMe: member.user_id === user.id,
    // 조회가 실패해 모를 때는 표시를 붙이지 않는다(없다고 단정하는 게 아니라, 확인된 것만 표시).
    isBlocked: blockedIds?.has(member.user_id) ?? false,
  }))

  // 내가 나가면 방장을 이어받을 분. 이미 방장인 분이 있으면 그분, 없으면 가장 오래 있던 분.
  // (실제 판단은 leaveRoom 서버 액션이 다시 한다. 여기 값은 안내 문구용이다)
  const successor =
    others.find((member) => member.role === 'admin') ?? others[0] ?? null

  /*
    커버 사진은 비공개 버킷이라 서명된 주소가 있어야 보인다.
    [원래대로] 타일과 내가 올린 사진, 둘 다 필요할 수 있어 한 번에 서명한다 —
    따로 부르면 왕복이 두 번이 된다. 사진을 쓰지 않는 방은 요청 자체가 없다.
  */
  const coverPaths = [look?.originalCoverPath, look?.customCoverPath].filter(
    (path): path is string => Boolean(path),
  )
  const coverUrlByPath = new Map<string, string>()
  if (coverPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('covers')
      .createSignedUrls(coverPaths, COVER_URL_TTL_SEC)
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl && !item.error) {
        coverUrlByPath.set(item.path, item.signedUrl)
      }
    }
  }
  // 서명에 실패하면 null이 되고, 타일은 조용히 프리셋 색으로 그려진다.
  // 깨진 이미지 아이콘을 보여주지 않는다.
  const coverUrl = (path: string | null | undefined) =>
    path ? (coverUrlByPath.get(path) ?? null) : null

  return (
    <RoomSettingsShell roomId={roomId}>
      <p className="text-base leading-relaxed text-muted">
        {look ? `‘${look.name}’ 방에 ` : ''}함께 있는 분들이에요.
      </p>

      {/*
        내 화면에서 이 방을 어떻게 부를지 (노션 IA 6.7 개정).
        방장만 쓰던 자리가 아니다 — 모든 구성원에게 보인다. 여기서 바꾼 이름과 커버는
        나만 보고, 다른 분들 화면은 그대로다.
      */}
      {look ? (
        <section className="flex flex-col gap-4">
          <h3 className="text-lg font-medium text-ink">내 화면에서 부를 이름</h3>
          <p className="text-base leading-relaxed text-muted">
            여기서 바꾼 이름과 커버는 <b className="font-medium text-ink">내 화면에서만</b>{' '}
            보여요. 함께 계신 분들 화면은 그대로예요.
          </p>
          <MyLookPanel
            roomId={roomId}
            originalName={look.originalName}
            customName={look.customName}
            originalCoverPreset={look.originalCoverPreset}
            originalCoverUrl={coverUrl(look.originalCoverPath)}
            customCoverPreset={look.customCoverPreset}
            customCoverUrl={coverUrl(look.customCoverPath)}
          />
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-medium text-ink">함께하는 분</h3>
        <MemberList members={members} />
      </section>

      {/*
        id="leave": 더보기 서랍의 [앨범방 나가기]가 이 자리로 바로 온다(#leave).
        나가기 화면을 따로 만들지 않은 이유 — 나가면 무슨 일이 생기는지 설명하는 글이
        여기 이미 있고, 두 벌로 나뉘면 한쪽만 고쳐진다.
        scroll-mt는 머리띠에 가려지지 않을 만큼의 여유다.
      */}
      <section
        id="leave"
        className="flex scroll-mt-16 flex-col gap-3 border-t border-hairline pt-8"
      >
        <h3 className="text-lg font-medium text-ink">이 방에서 나가기</h3>
        <p className="text-base leading-relaxed text-muted">
          나가도 지금까지 나눈 마음은 사라지지 않아요. 눌러보시면 무슨 일이 생기는지
          자세히 알려드릴게요.
        </p>

        <LeavePanel
          roomId={roomId}
          roomName={look?.name ?? '이 방'}
          iAmAdmin={myMembership.role === 'admin'}
          remainingCount={others.length}
          // 내가 차단한 분이 이 방에 한 분이라도 계시면 초대를 받아도 입장이 막힌다
          // (accept_invitation이 방의 활성 구성원 전체와 차단 관계를 본다).
          // 조회에 실패했으면 0이 아니라 null(모름)을 넘긴다.
          blockedCount={
            blockedIds === null
              ? null
              : others.filter((member) => blockedIds.has(member.user_id)).length
          }
          successorName={
            successor
              ? roomMemberName({
                  userId: successor.user_id,
                  nickname: successor.nickname,
                  name: successor.user?.name,
                })
              : null
          }
        />
      </section>

      <Link
        href="/my/blocks"
        className="inline-flex min-h-[52px] items-center justify-center rounded-[8px] px-4 text-base font-medium text-primary active:bg-primary-soft"
      >
        내가 차단한 분 목록 보기
      </Link>
    </RoomSettingsShell>
  )
}

/**
 * 이 화면의 껍데기 — 머리띠 + 본문 칸.
 *
 * layout.tsx가 머리띠를 그리지 않게 되면서(화면마다 제목·동작이 달라서다) 여기서 그린다.
 * 오류로 일찍 끝나는 경우에도 뒤로 갈 길은 있어야 해서 두 갈래가 같은 껍데기를 쓴다.
 */
function RoomSettingsShell({
  roomId,
  children,
}: {
  roomId: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <RoomAppBar
        backHref={`/rooms/${roomId}`}
        backLabel="앨범방으로 돌아가기"
        title="방 설정"
      />
      <main className="flex w-full flex-1 flex-col gap-8 px-6 pt-2 pb-8">
        {children}
      </main>
    </div>
  )
}
