import type { Metadata } from 'next'

import { RoomAppBar } from '@/components/room/RoomAppBar'
import { loadMyAliveInvitations } from '@/lib/actions/invitations'
import { loadRoomInvitations } from '@/lib/actions/invitations-manage'
import { requireUser } from '@/lib/auth'
import { loadRoomName } from '@/lib/room-look'
import { InvitePanel } from './invite-panel'
import { InvitationList } from './invitation-list'

export const metadata: Metadata = { title: '초대하기 · 오늘도 사랑해' }

/**
 * 초대 만들기 화면.
 *
 * 이 방의 구성원이 맞는지는 상위 layout.tsx가 이미 확인했다(아니면 홈으로 돌려보낸다).
 * 여기서는 방 이름과 "아직 살아 있는 내 초대장"만 챙겨서 화면에 넘긴다.
 */
export default async function InvitePage({
  params,
}: PageProps<'/rooms/[roomId]/invite'>) {
  const { roomId } = await params

  // 방 이름은 안내 문구에 쓴다. RLS 덕분에 내가 속한 방만 조회된다.
  // 미리보기에 "누가 부르고 있는지"를 실제 이름으로 적으려면 내 이름이 필요하다.
  const me = await requireUser()

  const [roomName, alive, invitations] = await Promise.all([
    loadRoomName(roomId),
    loadMyAliveInvitations(roomId),
    // 잘못 보낸 링크를 되돌릴 수 있도록 이 방의 초대장 목록도 함께 가져온다.
    loadRoomInvitations(roomId),
  ])

  return (
    // 머리띠는 화면마다 그린다(layout.tsx는 멤버 확인만 한다 — RoomAppBar 주석 참고).
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <RoomAppBar
        backHref={`/rooms/${roomId}`}
        backLabel="앨범방으로 돌아가기"
        title="초대하기"
      />

      <main className="flex w-full flex-1 flex-col gap-6 px-6 pt-2 pb-8">
        <p className="text-base leading-relaxed text-muted">
          {roomName ? `‘${roomName}’ 방에 ` : ''}함께할 분에게 링크나 QR
          코드를 보내주세요. 그분이 열어보면 바로 들어올 수 있어요.
        </p>

        <InvitePanel
          roomId={roomId}
          aliveInvitations={alive}
          // 받는 분 화면 미리보기(노션 IA 3.2)에 그대로 쓰인다.
          inviterName={me.name}
          roomName={roomName ?? '앨범방'}
        />

        <InvitationList roomId={roomId} invitations={invitations} />
      </main>
    </div>
  )
}
