'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatKstDay, formatKstFullDate, formatKstTime } from '@/lib/format'
import {
  cancelInvitation,
  type CancelInviteState,
  type ManagedInvitation,
} from '@/lib/actions/invitations-manage'

/** formatKstDay가 날짜 대신 돌려주는 말들. 이 말들 뒤에는 '에'를 붙이지 않는다. */
const SPOKEN_DAYS = new Set(['오늘', '어제', '그저께', '내일'])

/** "오늘 만들었어요" / "8월 3일에 만들었어요" — 조사를 잘못 붙이지 않도록 나눠 쓴다. */
function createdPhrase(createdAt: string): string {
  const day = formatKstDay(createdAt)
  if (!day) return ''
  return SPOKEN_DAYS.has(day) ? `${day} 만들었어요` : `${day}에 만들었어요`
}

/**
 * "2026년 9월 6일 오후 3:12" — 시각까지 적는다.
 *
 * 만료는 만든 날로부터 30일 뒤 '그 시각'이다. 날짜만 적으면 그날 저녁까지
 * 쓸 수 있다고 읽히는데 실제로는 낮에 이미 닫힌다. 안내와 동작이 어긋나면 안 된다.
 */
function expiryPhrase(expiresAt: string): string {
  return `${formatKstFullDate(expiresAt)} ${formatKstTime(expiresAt)}`
}

/**
 * "오늘 오후 3:12에 민수님이 이 링크로 들어오셨어요"
 *
 * 이름을 못 읽는 경우가 있다 — 들어왔다가 방을 나간 분, 탈퇴한 분은
 * RLS(users_select) 때문에 이름이 오지 않는다. 그럴 땐 있지도 않은 이름을
 * 지어내지 말고 "누군가"로 담담하게 적는다.
 *
 * 시각 뒤에 '에'가 붙으므로 "오늘/어제" 같은 말이 와도 조사가 어색하지 않다.
 */
function usedPhrase(usedAt: string, name: string | null): string {
  const who = name ? `${name}님이 이 링크로 들어오셨어요` : '누군가 이 링크로 들어왔어요'

  const day = formatKstDay(usedAt)
  if (!day) return who

  return `${day} ${formatKstTime(usedAt)}에 ${who}`
}

/** 초대장 한 장이 지금 어떤 상태인지. 화면 문구와 버튼이 전부 이 값에서 갈린다. */
type InviteStatus = 'open' | 'used' | 'expired'

/**
 * 상태를 정하는 순서가 accept_invitation과 같아야 한다.
 * DB 함수는 used_at을 먼저 보고, 그다음 expires_at을 본다. 기간도 지나고 이미
 * 쓰이기도 한 초대장을 "기간 지남"으로 적으면, 사용자는 "기간만 늘리면 되나?"로
 * 잘못 읽는다. 실제 이유는 이미 한 분이 들어왔기 때문이다.
 */
function statusOf(invitation: ManagedInvitation): InviteStatus {
  if (invitation.used) return 'used'
  if (invitation.expired) return 'expired'
  return 'open'
}

const STATUS_LABEL: Record<InviteStatus, string> = {
  open: '아직 안 썼어요',
  used: '이미 사용됨',
  expired: '기간 지남',
}

/**
 * 상태 알약.
 *
 * 색만으로 구분하지 않는다 — 색을 못 가리는 분에게는 아무 정보도 아니다.
 * 항상 글자 라벨이 함께 있고, 색은 거들기만 한다. 글자 크기도 줄이지 않는다
 * (시니어 사용자 기준 본문 17px 유지).
 */
function StatusBadge({ status }: { status: InviteStatus }) {
  const tone =
    status === 'open'
      ? 'border-hairline bg-primary-soft text-primary'
      : 'border-hairline bg-surface-soft text-muted'

  return (
    <span className={`rounded-full border px-3 py-0.5 text-base ${tone}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

/**
 * 이 방에 만들어 둔 초대장 목록 + 취소.
 *
 * 왜 필요한가:
 * 초대 링크는 한 분만 쓸 수 있다(1회용). 그래서 이 목록의 일은 두 가지다 —
 * 아직 안 쓴 링크를 취소해 미리 닫는 것, 그리고 이미 누가 들어왔는지 확인하는 것.
 *
 * 화면 원칙:
 * - 취소는 되돌릴 수 없으므로 반드시 "정말 취소할까요?" 한 단계를 거친다.
 * - 무슨 일이 일어나는지 사용자 말로 적는다. "삭제됩니다" 같은 말은 쓰지 않는다.
 * - 보여줄 초대장이 없으면 아무것도 그리지 않는다(빈 안내로 화면을 늘리지 않는다).
 */
export function InvitationList({
  roomId,
  invitations,
}: {
  roomId: string
  invitations: ManagedInvitation[]
}) {
  /**
   * 방금 취소한 초대장. 서버가 화면을 다시 그려줄 때까지의 짧은 사이에도
   * 목록에서 바로 사라지게 한다.
   */
  const [cancelledIds, setCancelledIds] = useState<string[]>([])

  /** 화면 낭독기를 쓰는 분에게도 결과를 알리기 위한 안내 문구. */
  const [notice, setNotice] = useState<string | null>(null)

  const visible = invitations.filter((item) => !cancelledIds.includes(item.id))

  // 볼 것도 없고 알릴 것도 없으면 조용히 아무것도 안 보여준다.
  if (visible.length === 0 && !notice) return null

  function handleCancelled(item: ManagedInvitation) {
    setCancelledIds((prev) => [...prev, item.id])
    setNotice(
      item.expired
        ? `${item.relationshipLabel}님께 보낼 초대장을 목록에서 지웠어요.`
        : `${item.relationshipLabel}님께 보낼 초대장을 취소했어요. 그 링크는 이제 열어도 들어올 수 없어요.`,
    )
  }

  return (
    <section className="flex flex-col gap-4 border-t border-hairline pt-6">
      <header className="flex flex-col gap-2">
        <h3 className="text-lg font-bold text-ink">만들어 둔 초대장</h3>
        {/*
          초대 링크는 한 번만 쓸 수 있다 — accept_invitation이 입장에 성공하면
          used_at을 채우고, 그 뒤에 다른 분이 열면 "이미 사용된 초대입니다"로 막는다.
          이 사실을 안 적으면 사용자는 링크 하나를 여러 사람에게 돌리고,
          두 번째 분부터는 이유도 모른 채 막힌다.
        */}
        <p className="text-base leading-relaxed text-muted">
          초대 링크는 한 분만 쓸 수 있어요. 한 분이 들어오시면 그 링크는 바로
          닫혀요. 다른 분도 부르시려면 초대장을 새로 만들어 주세요. 아직 아무도
          쓰지 않은 초대장은 취소해서 미리 닫아둘 수 있어요.
        </p>
      </header>

      {/* 취소 결과는 화면이 바뀐 뒤에도 남아 있어야 한다. 목록 위에 둔다. */}
      <div aria-live="polite" className={notice ? 'text-base text-ink' : 'sr-only'}>
        {notice ?? ''}
      </div>

      {visible.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {visible.map((item) => (
            <InvitationRow
              key={item.id}
              roomId={roomId}
              invitation={item}
              onCancelled={() => handleCancelled(item)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function InvitationRow({
  roomId,
  invitation,
  onCancelled,
}: {
  roomId: string
  invitation: ManagedInvitation
  onCancelled: () => void
}) {
  const [state, formAction, pending] = useActionState<CancelInviteState, FormData>(
    async (prev, formData) => {
      const result = await cancelInvitation(prev, formData)
      if (result?.ok) onCancelled()
      return result
    },
    null,
  )

  /** 확인 단계를 열었는지. 되돌릴 수 없는 동작이라 한 번 더 묻는다. */
  const [confirming, setConfirming] = useState(false)

  /**
   * 확인 단계가 열리면 그 설명으로 초점을 옮긴다.
   *
   * "취소하기" 버튼은 확인 화면으로 바뀌면서 사라진다. 그러면 키보드·화면 낭독기
   * 초점이 문서 맨 위로 튕겨서, 방금 무엇을 눌렀는지도 무엇을 묻는지도 알 수 없다.
   * 되돌릴 수 없는 동작이라 설명을 반드시 듣고 넘어가야 한다.
   * (초점을 "네, 취소할게요"에 두지는 않는다 — 엔터 한 번에 실행되면 위험하다)
   */
  const confirmPanelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (confirming) confirmPanelRef.current?.focus()
  }, [confirming])

  const errorMessage = state && !state.ok ? state.error : null
  const status = statusOf(invitation)
  const expired = status === 'expired'
  const used = status === 'used'

  return (
    <Card as="li">
      {/*
        다 쓴 초대장·기간이 지난 초대장을 opacity로 흐리게 만들지 않는다.
        text-muted(#6a6a6a)를 60%로 낮추면 흰 바탕 대비가 2.4:1까지 떨어져
        WCAG AA(4.5:1)에 한참 못 미친다. 시니어 사용자가 주요 대상이라 더 위험하다.
        대신 세 가지로 물러나게 한다 — 목록에서 아래로 내려가고(서버가 아직 안 쓴
        초대장을 먼저 준다), 제목 글자가 text-ink에서 text-muted로 가라앉고,
        누를 버튼이 사라진다. 대비는 그대로 지키면서 눈에는 덜 걸린다.
      */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`text-lg font-medium ${
                status === 'open' ? 'text-ink' : 'text-muted'
              }`}
            >
              {invitation.relationshipLabel}님께 보낼 초대장
            </p>

            <StatusBadge status={status} />
          </div>

          <p className="text-base text-muted">
            {createdPhrase(invitation.createdAt)}
            {/*
              이미 쓰인 초대장에는 만료 시각을 적지 않는다. 기간이 남아 있어도
              그 링크는 이미 닫혔는데, "9월 6일까지 쓸 수 있어요"라고 적으면
              그때까지 다른 분을 더 부를 수 있다는 거짓말이 된다.
            */}
            {!used && invitation.expiresAt
              ? expired
                ? ` · ${expiryPhrase(invitation.expiresAt)}까지 쓸 수 있었어요`
                : ` · ${expiryPhrase(invitation.expiresAt)}까지 쓸 수 있어요`
              : ''}
          </p>

          {used && invitation.usedAt ? (
            <p className="text-base leading-relaxed text-ink">
              {usedPhrase(invitation.usedAt, invitation.usedByName)}
            </p>
          ) : null}

          {invitation.inviterName ? (
            <p className="text-base text-muted">
              {invitation.inviterName}님이 만들었어요
            </p>
          ) : null}
        </div>

        {/* 어떤 초대장인지 알아볼 수 있게 첫 마디를 한 줄만 보여준다. */}
        <p
          className={`truncate text-base ${
            status === 'open' ? 'text-ink' : 'text-muted'
          }`}
        >
          “{invitation.inviteMessage}”
        </p>

        {errorMessage ? (
          <p role="alert" className="text-base text-primary">
            {errorMessage}
          </p>
        ) : null}

        {used ? (
          /*
            이미 쓰인 초대장에는 취소 버튼을 두지 않는다(서버도 canCancel=false로 준다).
            누를 수 있게 두면 "취소했으니 그분이 못 들어오겠지"라는 거짓 안심을 준다 —
            그분은 이미 방에 들어와 있고, 나가는 건 취소로 되는 일이 아니다.
          */
          <p className="text-base leading-relaxed text-muted">
            이 링크는 이제 열어도 들어올 수 없어요. 다른 분을 부르시려면 초대장을
            새로 만들어 주세요.
          </p>
        ) : invitation.canCancel ? (
          confirming ? (
            <form action={formAction} className="flex flex-col gap-3">
              <input type="hidden" name="invitation_id" value={invitation.id} />
              <input type="hidden" name="room_id" value={roomId} />
              <input
                type="hidden"
                name="relationship_label"
                value={invitation.relationshipLabel}
              />

              <div
                ref={confirmPanelRef}
                tabIndex={-1}
                role="group"
                aria-label={
                  expired
                    ? `${invitation.relationshipLabel}님께 보낼 기간 지난 초대장 지우기 확인`
                    : `${invitation.relationshipLabel}님께 보낼 초대장 취소 확인`
                }
                className="flex flex-col gap-2 rounded-[8px] bg-surface-soft p-4"
              >
                <p className="text-base font-medium text-ink">
                  {expired
                    ? '이 초대장을 목록에서 지울까요?'
                    : '이 초대장을 취소할까요?'}
                </p>
                <p className="text-base leading-relaxed text-muted">
                  {expired
                    ? '이미 기간이 지나서 열어도 들어올 수 없는 초대장이에요. 목록에서 지워도 다른 변화는 없어요.'
                    : '이미 보내신 링크와 QR 코드가 바로 쓸 수 없게 돼요. 그분이 링크를 열어도 방에 들어오지 못해요. 다시 부르시려면 초대장을 새로 만들면 돼요.'}
                </p>
                {/*
                  취소 버튼은 아직 아무도 안 쓴 초대장에만 보인다(used면 위에서 걸러진다).
                  그러니 "이 링크로 들어온 분"은 아직 없다 — 그 사실을 그대로 적는다.
                */}
                <p className="text-base leading-relaxed text-muted">
                  아직 이 링크로 들어오신 분은 없어요. 방에 계신 분들과 주고받은
                  마음에는 아무 변화도 없어요.
                </p>
              </div>

              {/*
                되돌릴 수 없는 확정 버튼이라 lg로 둔다. 초대장 취소는 invitations 행을
                실제로 지우는 동작이고(이 서비스에서 물리 삭제를 하는 몇 안 되는 곳이다),
                한 번 누르면 되돌릴 방법이 없다.
                짝이 되는 '그대로 둘게요'도 같이 lg로 올려야 두 버튼 높이가 맞는다.
                방 구성원 차단 확인 버튼(member-list.tsx)도 같은 이유로 lg다.
              */}
              <div className="flex flex-col gap-2">
                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  pending={pending}
                  pendingText="취소하는 중…"
                >
                  {expired ? '네, 지울게요' : '네, 취소할게요'}
                </Button>

                <Button
                  variant="ghost"
                  size="lg"
                  fullWidth
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                >
                  그대로 둘게요
                </Button>
              </div>
            </form>
          ) : (
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => setConfirming(true)}
              aria-label={
                expired
                  ? `${invitation.relationshipLabel}님께 보낼 기간 지난 초대장 지우기`
                  : `${invitation.relationshipLabel}님께 보낼 초대장 취소하기`
              }
            >
              {expired ? '목록에서 지우기' : '취소하기'}
            </Button>
          )
        ) : (
          // 볼 수는 있어도 취소는 만든 분이나 방장만 할 수 있다(RLS와 같은 규칙).
          // invitations_delete = inviter_id = auth.uid() OR is_room_admin(room_id)
          // 이므로 "만드신 분"만 적으면 방장이 빠져 사실과 어긋난다.
          // 서버가 돌려주는 오류 문구와도 말을 맞춘다.
          <p className="text-base leading-relaxed text-muted">
            이 초대장은 만드신 분이나 방을 만든 분이 취소할 수 있어요.
          </p>
        )}
      </div>
    </Card>
  )
}
