'use client'

import { useRouter } from 'next/navigation'
import { useActionState } from 'react'

import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import {
  acceptInvitation,
  type AcceptInviteState,
} from '@/lib/actions/invitations'

/**
 * 초대를 받아들이고 방으로 들어가는 부분.
 *
 * 입장 처리는 DB 함수 accept_invitation(p_token, p_label)이 전부 한다.
 * 여기서는 "방에서 불릴 호칭"만 한 번 확인받는다 — 초대한 분이 적어준 값이
 * 미리 채워져 있으니 그대로 두고 눌러도 된다.
 *
 * 이 화면이 보인다는 건 방금 전까지는 쓸 수 있는 초대장이었다는 뜻이다
 * (부모 화면이 preview_invitation의 used·expired를 먼저 확인한다).
 * 그래도 실패할 수 있다 — 초대 링크는 한 분만 쓸 수 있어서, 이 화면을 열어둔
 * 사이에 다른 분이 먼저 들어가면 그때부터 닫힌다. 그래서 오류가 나면
 * 다시 눌러보라고만 하지 않고, 초대장 상태를 다시 확인할 길을 함께 준다.
 */
export function AcceptPanel({
  token,
  defaultLabel,
  roomName,
}: {
  token: string
  /** 초대장에 적힌 호칭. 그대로 쓰면 된다. */
  defaultLabel: string
  roomName: string
}) {
  const router = useRouter()

  const [state, formAction, pending] = useActionState<AcceptInviteState, FormData>(
    acceptInvitation,
    null,
  )

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="token" value={token} />

      <Field
        id="label"
        name="label"
        label={`‘${roomName}’에서 불릴 내 호칭`}
        hint="그대로 두셔도 괜찮아요. 바꾸고 싶으시면 고쳐주세요."
        defaultValue={defaultLabel}
        maxLength={20}
        autoComplete="off"
      />

      {state?.error ? (
        <div role="alert" className="flex flex-col gap-2">
          <p className="text-base leading-relaxed text-primary">{state.error}</p>
          {/*
            초대장이 방금 닫혔을 수도 있다. 화면을 새로 읽으면
            preview_invitation이 지금 상태(이미 사용됨·기간 지남)를 알려주고,
            부모 화면이 그에 맞는 안내로 바꿔 그린다.
            "잠시 후 다시" 눌러봐야 소용없는 경우를 여기서 걷어낸다.
          */}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="self-start text-base text-primary underline"
          >
            초대장 상태 다시 확인하기
          </button>
        </div>
      ) : null}

      <Button
        type="submit"
        fullWidth
        pending={pending}
        pendingText="들어가는 중…"
      >
        들어가기
      </Button>

      <p className="text-center text-base leading-relaxed text-muted">
        답장을 꼭 해야 하는 건 아니에요. 마음이 날 때 한마디 남기면 돼요.
      </p>
    </form>
  )
}
