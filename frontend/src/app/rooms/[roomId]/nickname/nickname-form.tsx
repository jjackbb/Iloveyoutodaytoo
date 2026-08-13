'use client'

import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { setRoomNickname, type RoomNicknameState } from '@/lib/actions/members'
import { ROOM_NICKNAME_MAX_LENGTH } from '@/lib/limits'

/**
 * 이 방에서 쓸 별명 입력칸.
 *
 * 들고 있는 상태는 **지금 칸에 적힌 글자**뿐이다. 저장하면 서버가 방 화면들을 다시 읽고
 * 피드로 돌려보낸다 — 이 부품이 "저장된 별명"을 따로 기억하지 않는다.
 *
 * 비우고 저장하는 것도 정식 동작이다(전역 이름으로 돌아간다). 그래서 지우기 버튼을
 * 따로 두지 않았다 — 같은 칸, 같은 버튼으로 정하고 지운다.
 */
export function NicknameForm({
  roomId,
  initialNickname,
  globalName,
}: {
  roomId: string
  /** 지금 저장돼 있는 별명. 없으면 빈 문자열. */
  initialNickname: string
  /** 별명을 비웠을 때 보이게 될 이름(users.name). */
  globalName: string
}) {
  const [state, formAction, pending] = useActionState<RoomNicknameState, FormData>(
    setRoomNickname,
    null,
  )
  const [value, setValue] = useState(initialNickname)

  const trimmed = value.trim()
  const previewName = trimmed || globalName

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="room_id" value={roomId} />

      <Field
        id="nickname"
        name="nickname"
        label="이 방에서 쓸 별명"
        hint="비워두고 저장하면 원래 이름으로 돌아가요."
        error={state?.error}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={ROOM_NICKNAME_MAX_LENGTH}
        autoComplete="off"
        placeholder={globalName}
        // 세는 값은 maxLength가 막는 값과 같아야 한다(trim한 길이가 아니라 적힌 그대로).
        labelSuffix={`${value.length}/${ROOM_NICKNAME_MAX_LENGTH}`}
      />

      {/*
        지금 무엇으로 보이게 되는지 미리 보여준다.
        "저장했는데 어디가 바뀐 거지"를 없애는 자리다.
      */}
      <p
        aria-live="polite"
        className="rounded-inner bg-surface-soft px-4 py-3.5 text-base leading-relaxed break-keep text-ink"
      >
        이 방에서 <strong className="font-extrabold">{previewName}</strong>님으로 보여요.
      </p>

      <Button type="submit" fullWidth pending={pending} pendingText="저장하는 중…">
        저장하기
      </Button>
    </form>
  )
}
