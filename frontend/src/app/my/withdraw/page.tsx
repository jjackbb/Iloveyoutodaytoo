import type { Metadata } from 'next'
import Link from 'next/link'

import {
  WithdrawFarewell,
  WithdrawPanel,
  type WithdrawRoomSummary,
} from '@/app/my/withdraw/withdraw-form'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: '회원 탈퇴 · 오늘도 사랑해' }

/**
 * 회원 탈퇴 화면.
 *
 * 개인정보보호법상 탈퇴는 가입만큼 쉬워야 한다. 그래서 /my 아래에 링크를 두되
 * 실수로 눌리지 않도록 마지막에 확인 문구를 직접 적게 한다.
 *
 * 여기서 방 목록을 미리 읽는 이유:
 * 탈퇴해도 함께 쓰던 방은 남는다(rooms.owner_id 는 nullable + ON DELETE SET NULL이고,
 * withdraw_account 가 탈퇴 전에 방장을 남은 분께 넘긴다).
 * 오직 **나 말고 아무도 발을 들인 적 없는 방**만 나와 함께 정리된다 —
 * withdraw_account 가 `owner_id = 나` 이면서 `room_members 에 나 외의 user_id 행이
 * 하나도 없는` 방만 지운다(status는 보지 않는다. 나갔던 분도 사서함에 기록이 남아 있다).
 *
 * "방이 남는다/정리된다"는 말만으로는 그게 내 이야기인지 알기 어려우니
 * 실제로 내 방이 어떻게 되는지 이름을 보여준다. 짐작이 아니라 지금 내 데이터다.
 *
 * 로그인 확인에 requireUser()가 아니라 getCurrentUser()를 쓴다:
 * 탈퇴가 끝나면 세션 쿠키가 사라지고 Next.js가 이 화면을 서버에서 다시 그린다.
 * 그때 /login으로 튕겨내면 작별 인사를 볼 새가 없다. 대신 작별 인사를 보여준다.
 * (로그인하지 않은 사람의 평범한 접속은 proxy.ts가 이미 /login으로 보낸다)
 */
export default async function WithdrawPage() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6">
        <WithdrawFarewell />
      </div>
    )
  }

  const supabase = await createClient()

  /*
   * 내가 만든 방과 그 방의 구성원 기록. RLS 덕분에 내가 볼 수 있는 방만 돌아온다.
   *
   * status로 거르지 않는다. withdraw_account 도 거르지 않기 때문이다 —
   * 이미 나간 분(status='left')이라도 그 방에서 오간 마음은 그분 사서함에 남아 있어서
   * (heart_messages_select 는 room_members 가 아니라 sender_id/receiver_id 를 본다)
   * 그 방은 "나 혼자만 있던 방"이 아니고, 따라서 지워지지 않는다.
   */
  const { data: ownedRooms, error: ownedError } = await supabase
    .from('rooms')
    .select('id, name, room_members(user_id, status)')
    .eq('owner_id', user.id)

  /*
   * 내가 속했던 방 전부. 여기서도 status로 거르지 않는다 —
   * 내가 나온 방이라도 방은 그대로 있고, 그 방에 내가 남긴 마음도 그대로 남는다.
   * 나간 방까지 세어야 "남는 마음이 없다"는 말을 함부로 하지 않는다.
   *
   * rooms를 조인해 owner_id를 보지 않고 room_id만 받는 이유:
   * rooms_select RLS가 `owner_id = auth.uid() OR is_room_member(id)`인데
   * is_room_member는 status='active'만 참이다. 나온 방은 조인하면 null로 와서
   * 그대로 세면 오히려 빠진다. 대신 아래에서 내가 만든 방 id와 대조해 걸러낸다.
   */
  const { data: memberships, error: membershipError } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('user_id', user.id)

  if (ownedError || membershipError) {
    // 목록을 못 읽었다고 탈퇴를 막지는 않는다. 대신 숫자 없이 일반 안내만 보여준다.
    console.error(
      '[회원 탈퇴] 방 목록 조회 실패:',
      ownedError?.message ?? membershipError?.message,
    )
  }

  const owned = ownedRooms ?? []
  const ownedRoomIds = new Set(owned.map((room) => room.id))

  /*
   * 내가 만든 방을 withdraw_account 와 똑같은 기준으로 세 갈래로 나눈다.
   *
   *  keptRoomNames  나 말고 다른 분의 기록이 들어 있는 방 → 그대로 남는다.
   *                 지금 나가 계신 분도 센다(status를 보지 않는다).
   *  soloRoomNames  나 말고 아무도 들어온 적 없는 방 → 나와 함께 정리된다.
   *  unverified     내가 이미 나온 내 방. 구성원을 확인할 방법이 없다(아래 참고).
   *
   * unverified 를 따로 두는 이유 — RLS 때문이다:
   * room_members_select 는 `user_id = auth.uid() OR is_room_member(room_id)` 이고
   * is_room_member 는 내 status='active' 일 때만 참이다.
   * 그래서 내가 나온 방에서는 **내 행 하나만** 보인다. 다른 분이 안 보이는 것이
   * "없다"는 뜻인지 "못 본다"는 뜻인지 구분할 수 없다.
   * 이때 없다고 단정하면 화면이 "이 방은 사라집니다" 하고 거짓말을 하게 된다.
   * 확인한 것만 이름을 대고, 확인 못 한 것은 세지 않는다.
   */
  const keptRoomNames: string[] = []
  const handoverRoomNames: string[] = []
  const soloRoomNames: string[] = []
  let unverifiedRoomCount = 0

  for (const room of owned) {
    const members = room.room_members ?? []
    const others = members.filter((member) => member.user_id !== user.id)

    if (others.length > 0) {
      keptRoomNames.push(room.name)

      // withdraw_account 는 status='active' 인 분에게만 방장을 넘긴다.
      // 남은 분이 모두 나가 계시면 방은 남되 방장 자리는 비워진다(owner_id = null).
      if (others.some((member) => member.status === 'active')) {
        handoverRoomNames.push(room.name)
      }
      continue
    }

    const iAmActiveHere = members.some(
      (member) => member.user_id === user.id && member.status === 'active',
    )

    if (iAmActiveHere) soloRoomNames.push(room.name)
    else unverifiedRoomCount += 1
  }

  const summary: WithdrawRoomSummary = {
    keptRoomNames,
    handoverRoomNames,
    soloRoomNames,
    // 내가 만들지 않은 방 = 내가 사라져도 남는 방. 지금 나온 방도 포함된다.
    // withdraw_account 의 delete 는 `owner_id = 나` 인 방만 보므로 여기는 손대지 않는다.
    guestRoomCount: (memberships ?? []).filter(
      (row) => !ownedRoomIds.has(row.room_id),
    ).length,
    unverifiedRoomCount,
    unavailable: Boolean(ownedError || membershipError),
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-hairline px-2 py-2">
        <Link
          href="/my"
          aria-label="마이 화면으로 돌아가기"
          className="inline-flex min-h-[44px] items-center gap-1 rounded-[8px] px-3 text-base text-muted active:bg-surface-soft"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 5 8 12l7 7" />
          </svg>
          뒤로
        </Link>

        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-lg font-bold text-ink">회원 탈퇴</h1>
        </div>

        {/* 좌우 균형을 맞추기 위한 빈 자리 */}
        <div aria-hidden className="w-[72px] shrink-0" />
      </header>

      <div className="flex flex-1 flex-col px-6 py-8">
        <WithdrawPanel summary={summary} />
      </div>
    </div>
  )
}
