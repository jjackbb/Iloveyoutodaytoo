'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { renameRoom, type RenameRoomState } from '@/lib/actions/rooms'
import { ROOM_NAME_MAX_LENGTH } from '@/lib/limits'

/**
 * 앨범방 이름 바꾸기 (노션 IA 6.7).
 *
 * 방장에게만 보인다. 방장이 아닌 분에게 칸을 보여주고 눌렀을 때 "권한이 없다"고
 * 막으면, 시니어 사용자에게는 고장으로 읽힌다 — 애초에 안 보이는 편이 친절하다.
 * 그래도 서버는 다시 확인한다(RLS). 화면을 감추는 것은 안내이지 방어가 아니다.
 */
export function RenamePanel({
  roomId,
  currentName,
}: {
  roomId: string
  currentName: string
}) {
  const [state, formAction, pending] = useActionState<RenameRoomState, FormData>(
    renameRoom,
    null,
  )

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="room_id" value={roomId} />

      <Field
        id="room-name"
        name="name"
        label="앨범방 이름"
        defaultValue={currentName}
        maxLength={ROOM_NAME_MAX_LENGTH}
        required
        error={state?.status === 'error' ? state.message : null}
      />

      {state?.status === 'done' ? (
        <p role="status" className="text-base text-muted">
          이름을 바꿨어요.
        </p>
      ) : null}

      <Button type="submit" variant="secondary" pending={pending} pendingText="바꾸는 중…">
        이름 바꾸기
      </Button>
    </form>
  )
}
