import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { NicknameForm } from './nickname-form'
import { RoomAppBar } from '@/components/room/RoomAppBar'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { loadRoomName } from '@/lib/room-look'

export const metadata: Metadata = { title: '별명 설정 · 오늘도 사랑해' }

/**
 * 별명 설정 — 이 방에서만 쓰는 내 이름 (더보기 서랍의 "별명 설정").
 *
 * 저장되는 곳은 **이 방의 내 멤버십**(`room_members.nickname`)이다. 그래서
 * 마이 탭의 전역 이름을 바꿔도 이 방에서는 별명이 이기고, 같은 방의 다른 분들에게도
 * 이 이름으로 보인다 — 내 화면에만 걸리는 표시가 아니다.
 *
 * 지금 값은 서버가 매번 DB에서 읽는다. 입력칸의 첫 글자로만 쓰이고,
 * 저장은 서버 액션이 다시 DB에 적는다(`setRoomNickname`).
 */
export default async function RoomNicknamePage({
  params,
}: PageProps<'/rooms/[roomId]/nickname'>) {
  const { roomId } = await params
  const viewer = await requireUser()
  const supabase = await createClient()

  const [roomNameResult, membershipResult] = await Promise.all([
    // 방 이름은 사람마다 다를 수 있다 — 내가 바꿔 부르는 이름이 있으면 그것이다(@/lib/room-look).
    loadRoomName(roomId),
    supabase
      .from('room_members')
      .select('nickname, user:users!room_members_user_id_fkey(id, name)')
      .eq('room_id', roomId)
      .eq('user_id', viewer.id)
      .eq('status', 'active')
      .maybeSingle(),
  ])

  const roomName = roomNameResult ?? '앨범방'

  if (membershipResult.error) {
    console.error('[별명] 내 정보 조회 실패:', membershipResult.error.message)
  }

  // 레이아웃이 이미 걸러주지만, 값을 다루기 전에 여기서도 한 번 더 확인한다.
  if (!membershipResult.error && !membershipResult.data) redirect('/')

  const membership = membershipResult.data

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <RoomAppBar
        backHref={`/rooms/${roomId}`}
        backLabel={`${roomName}으로 돌아가기`}
        title="별명 설정"
      />

      <main className="flex flex-1 flex-col gap-6 px-screen-x pt-2 pb-screen-b">
        {membershipResult.error ? (
          <p
            role="alert"
            className="mt-4 rounded-inner bg-surface-soft px-4 py-4 text-base leading-relaxed text-ink"
          >
            내 정보를 불러오지 못했어요. 잠시 후 다시 열어봐 주세요.
          </p>
        ) : (
          <>
            <p className="text-base leading-relaxed break-keep text-muted">
              ‘{roomName}’ 방에서만 쓰는 이름이에요. 다른 방과 마이 화면의 이름은
              그대로예요. 이 방의 다른 분들에게도 이 이름으로 보여요.
            </p>

            <NicknameForm
              roomId={roomId}
              initialNickname={membership?.nickname ?? ''}
              // 이름을 못 읽는 경우에도 칸이 비어 보이지 않게 담담한 기본값을 둔다.
              globalName={membership?.user?.name ?? '이름 없음'}
            />
          </>
        )}
      </main>
    </div>
  )
}
