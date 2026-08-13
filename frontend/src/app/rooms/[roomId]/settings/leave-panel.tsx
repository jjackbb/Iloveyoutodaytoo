'use client'

import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { leaveRoom, type LeaveRoomState } from '@/lib/actions/members'

/**
 * 이 방 나가기.
 *
 * 되돌리기 어려운 동작이라 두 걸음으로 나눴다.
 * 첫 화면에는 버튼 하나만 두고, 누르면 무슨 일이 일어나는지 설명하는 칸이 펼쳐진다.
 *
 * 설명에서 반드시 지키는 것(작업 지시):
 *  - 이 방의 기록은 사라지지 않는다
 *  - 내가 남긴 마음은 상대의 사서함에 그대로 남는다
 *  - 다시 초대받으면 돌아올 수 있다
 * 재촉하거나 붙잡는 문구는 쓰지 않는다. 떠나는 것도 사용자의 선택이다.
 */

export type LeavePanelProps = {
  roomId: string
  roomName: string
  /** 내가 이 방의 방장인지 */
  iAmAdmin: boolean
  /** 나 말고 이 방에 남아 있는 사람 수 */
  remainingCount: number
  /**
   * 남아 있는 분 중 내가 차단한 사람 수. 확인하지 못했으면 null.
   *
   * accept_invitation의 차단 검사가 넓어졌다: 초대한 분뿐 아니라
   * **그 방의 활성 구성원 중 한 명이라도** 나와 차단 관계면 입장이 막힌다.
   * 그래서 "한 명이라도 초대해 줄 수 있으면 된다"가 아니라
   * "차단한 분이 한 분도 없어야 한다"가 돌아올 수 있는 조건이다.
   *
   * null은 0이 아니다. settings/page.tsx의 blocks 조회가 실패하면 null이 오고,
   * 그때는 "돌아올 수 있어요"도 "차단한 분이 있어요"도 단정하지 않는다.
   */
  blockedCount: number | null
  /** 내가 나가면 방장을 이어받을 분의 이름. 넘길 일이 없으면 null */
  successorName: string | null
}

export function LeavePanel({
  roomId,
  roomName,
  iAmAdmin,
  remainingCount,
  blockedCount,
  successorName,
}: LeavePanelProps) {
  const [state, formAction, pending] = useActionState<LeaveRoomState, FormData>(
    leaveRoom,
    null,
  )

  const [confirming, setConfirming] = useState(false)

  /*
   * 돌아올 수 있다고 말해도 되는 경우인지.
   *
   * 남이 나를 차단했는지는 blocks RLS(blocker_id = auth.uid()) 때문에 알 수 없다.
   * accept_invitation은 양방향을 다 보므로, 내가 아무도 차단하지 않았어도
   * 상대가 나를 차단해 두었으면 입장이 막힌다.
   * 그래서 아래 문구에서 "언제든"을 뺐다 — 지킬 수 있다고 확신할 수 없는 말은 쓰지 않는다.
   *
   * blockedCount가 null이면 차단 여부를 확인하지 못한 것이다.
   * 그때는 "돌아올 수 있어요"도 "차단한 분이 있어요"도 띄우지 않는다.
   * 둘 다 틀릴 수 있는 말이라, 아무 말도 안 하는 쪽이 정직하다.
   */
  const canReturn = remainingCount > 0 && blockedCount === 0

  if (!confirming) {
    return (
      <div className="flex flex-col gap-3">
        <Button variant="secondary" fullWidth onClick={() => setConfirming(true)}>
          이 방 나가기
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 rounded-[14px] bg-surface-soft p-5">
      {/* 바깥 절(section)의 제목이 h3이라 그 아래인 h4로 둔다. */}
      <h4 className="text-lg font-bold text-ink">
        ‘{roomName}’ 방에서 나갈까요?
      </h4>

      <ul className="flex list-none flex-col gap-2 text-base leading-relaxed text-ink">
        <li>· 이 방에 쌓인 기록은 <strong>사라지지 않아요.</strong></li>
        <li>
          · 내가 남긴 마음은 <strong>상대의 사서함에 그대로 남아요.</strong> 없어지지 않아요.
        </li>
        <li>· 나가면 이 방은 홈 목록에서 보이지 않고, 새 마음을 남길 수 없어요.</li>
        {/*
          음성·영상 파일은 "그 방의 구성원"에게만 열린다(스토리지 규칙 media_voice_select).
          나가면 글로 남긴 마음은 사서함에서 그대로 읽히지만 음성·영상은 재생되지 않는다.
          되돌리기 어려운 선택이라 미리 정확히 알린다.
        */}
        <li>
          · 이 방에서 오간 <strong>음성·영상은 나가면 다시 듣거나 볼 수 없어요.</strong>{' '}
          글로 남긴 마음은 사서함에서 그대로 보여요.
        </li>
        {/*
          남는 분이 없거나, 그중 내가 차단한 분이 한 분이라도 있으면 돌아올 길이 막힌다.
          지키지 못할 약속은 적지 않는다.
        */}
        {canReturn ? (
          <li>
            · 다시 초대를 받으면 돌아올 수 있어요. 그때 지금까지의 기록도 그대로 있어요.
            초대 링크는 한 번만 쓸 수 있으니, <strong>새 링크</strong>를 받으시면 돼요.
          </li>
        ) : null}
        <li>· 이 방의 연속 일수는 여기서 멈춰요. 돌아오면 다시 시작하면 돼요.</li>
      </ul>

      {/* 방장이 나갈 때는 누구에게 무엇이 넘어가는지 미리 알려준다. */}
      {iAmAdmin && successorName ? (
        <p className="text-base leading-relaxed text-ink">
          내가 이 방의 방장이라, 나가면 방장 역할이{' '}
          <strong>{successorName}님</strong>께 넘어가요.
        </p>
      ) : null}

      {/* 마지막 한 사람이 나가는 경우. 돌아올 길이 막힌다는 걸 숨기지 않는다. */}
      {remainingCount === 0 ? (
        <p className="text-base leading-relaxed text-ink">
          지금 이 방에는 다른 분이 없어요. 나가면 초대해 줄 사람이 없어서 이 방으로는
          돌아오기 어려워요. 주고받은 마음은 사서함에 그대로 남아 있어요.
        </p>
      ) : blockedCount !== null && blockedCount > 0 ? (
        /*
         * 남는 분 중 내가 차단한 분이 있는 경우.
         * 차단한 분이 한 분이라도 이 방에 계시면 초대를 받아도 입장이 막힌다
         * (accept_invitation이 방의 활성 구성원 전체를 두고 차단 관계를 본다).
         * 그래서 "전부 차단한 분일 때"가 아니라 "한 분이라도 있을 때" 알린다.
         */
        <p className="text-base leading-relaxed text-ink">
          지금 이 방에 남는 분 중에 내가 차단한 분이 있어요. 차단한 분이 계신 방에는
          초대를 받아도 들어올 수 없어서, 차단을 풀기 전에는 이 방으로 돌아오기 어려워요.
          주고받은 마음은 사서함에 그대로 남아 있어요.
        </p>
      ) : null}

      {state?.error ? (
        <p role="alert" className="text-base text-primary">
          {state.error}
        </p>
      ) : null}

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="room_id" value={roomId} />

        <Button
          type="submit"
          fullWidth
          pending={pending}
          pendingText="나가는 중…"
        >
          네, 나갈게요
        </Button>

        <Button
          variant="ghost"
          fullWidth
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          그만두기
        </Button>
      </form>
    </div>
  )
}
