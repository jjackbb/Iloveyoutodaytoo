'use client'

import { useActionState, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { formatKstFullDate } from '@/lib/format'
import { blockUser, type BlockState } from '@/lib/actions/blocks'

/**
 * 이 방에 함께 있는 분들 목록.
 *
 * 여기는 "친구 목록"이 아니다. 지금 이 방 안에 있는 분들만 보여주고,
 * 할 수 있는 일도 차단 하나뿐이다(01_PRD.md §6 — 친구 목록 화면은 만들지 않는다).
 *
 * 차단은 되돌리기가 번거로운 동작이라 한 번에 되지 않게 만들었다.
 * "차단하기"를 누르면 무슨 일이 일어나는지 설명하는 칸이 먼저 펼쳐지고,
 * 거기서 한 번 더 눌러야 차단된다.
 */

export type RoomMemberView = {
  /** room_members.id */
  memberId: string
  /** users.id — 차단 대상 */
  userId: string
  name: string
  /** 이 방에서 부르는 호칭. room_members.relationship_label */
  label: string
  isAdmin: boolean
  /** 이 방에 들어온 시각(UTC ISO) */
  joinedAt: string
  isMe: boolean
  /** 내가 이미 차단한 분인지 */
  isBlocked: boolean
}

export function MemberList({ members }: { members: RoomMemberView[] }) {
  const [state, formAction, pending] = useActionState<BlockState, FormData>(
    blockUser,
    null,
  )

  /** 지금 차단 확인 칸을 펼쳐 둔 사람의 userId. 없으면 null. */
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const errorMessage = state && !state.ok ? state.error : null

  return (
    <div className="flex flex-col gap-4">
      {/* 차단이 끝났다는 사실을 화면 낭독기에도 알린다. */}
      <div aria-live="polite" className={state?.ok ? 'text-base text-primary' : 'sr-only'}>
        {state?.ok
          ? `${state.blockedName}님을 차단했어요. 마이 > 차단한 분 목록에서 언제든 풀 수 있어요.`
          : ''}
      </div>

      <ul className="flex flex-col gap-3">
        {members.map((member) => {
          // 차단이 끝나 목록이 새로 그려지면 확인 칸은 스스로 닫힌다.
          // (닫지 않으면 "차단한 분이에요" 아래에 "차단할까요?" 칸이 그대로 남아
          //  이미 끝난 일을 다시 물어보는 화면이 된다)
          const confirming = confirmingId === member.userId && !member.isBlocked

          return (
            <li
              key={member.memberId}
              className="flex flex-col gap-3 rounded-card bg-card p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-ink">
                    {member.name}
                    {/* 색만으로 알리지 않는다. 글자로 함께 적는다. */}
                    {member.isMe ? (
                      <span className="ml-2 text-base font-normal text-muted">(나)</span>
                    ) : null}
                  </p>

                  <p className="mt-1 text-base text-muted">
                    {member.label}
                    {member.isAdmin ? ' · 방장' : ''}
                  </p>

                  <p className="mt-1 text-base text-muted">
                    {formatKstFullDate(member.joinedAt)}부터 함께해요
                  </p>

                  {member.isBlocked ? (
                    <p className="mt-2 text-base font-medium text-primary">
                      ✕ 차단한 분이에요
                    </p>
                  ) : null}
                </div>

                {/* 나 자신과 이미 차단한 분에게는 버튼을 두지 않는다. */}
                {!member.isMe && !member.isBlocked && !confirming ? (
                  <Button
                    size="md"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => setConfirmingId(member.userId)}
                    disabled={pending}
                  >
                    차단하기
                  </Button>
                ) : null}
              </div>

              {member.isBlocked ? (
                <p className="text-base leading-relaxed text-muted">
                  이분이 보내는 마음은 사서함에 보이지 않아요. 지금까지의 기록은 그대로 있고,
                  마이 &gt; 차단한 분에서 차단을 풀면 다시 보여요.
                </p>
              ) : null}

              {confirming ? (
                <BlockConfirm
                  member={member}
                  formAction={formAction}
                  pending={pending}
                  errorMessage={errorMessage}
                  onCancel={() => setConfirmingId(null)}
                />
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * 차단하기 전에 무슨 일이 일어나는지 정확히 알려주는 칸.
 *
 * 문구를 두루뭉술하게 쓰지 않는다. 특히 "기록이 지워지지 않는다"는 점과
 * "방에서 나가지는 않는다"는 점은 사람들이 가장 많이 오해하는 부분이다.
 */
function BlockConfirm({
  member,
  formAction,
  pending,
  errorMessage,
  onCancel,
}: {
  member: RoomMemberView
  formAction: (formData: FormData) => void
  pending: boolean
  errorMessage: string | null
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[14px] bg-surface-soft p-5">
      <h4 className="text-lg font-bold text-ink">
        {member.name}님을 차단할까요?
      </h4>

      <ul className="flex list-none flex-col gap-2 text-base leading-relaxed text-ink">
        <li>· 앞으로 이분이 보내는 마음이 내 사서함과 이 방에 보이지 않아요.</li>
        <li>· 지금까지 주고받은 기록은 <strong>지워지지 않아요.</strong> 차단을 풀면 다시 보여요.</li>
        <li>· 이분이 보내는 새 초대장은 받을 수 없어요.</li>
        <li>· 이분에게는 차단했다는 사실이 알려지지 않아요.</li>
        <li>· 차단해도 이 방에서 나가지는 않아요.</li>
      </ul>

      <p className="text-base leading-relaxed text-muted">
        차단은 마이 &gt; 차단한 분에서 언제든 풀 수 있어요.
      </p>

      {errorMessage ? (
        <p role="alert" className="text-base text-primary">
          {errorMessage}
        </p>
      ) : null}

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="target_id" value={member.userId} />
        <input type="hidden" name="target_name" value={member.name} />

        <Button
          type="submit"
          fullWidth
          pending={pending}
          pendingText="차단하는 중…"
        >
          네, 차단할게요
        </Button>

        <Button variant="ghost" fullWidth onClick={onCancel} disabled={pending}>
          그만두기
        </Button>
      </form>
    </div>
  )
}
