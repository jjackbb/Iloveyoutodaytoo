'use client'

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { formatKstFullDate } from '@/lib/format'
import { createInvitation, type InviteView } from '@/lib/actions/invitations'
import { RecipientPicker } from './recipient-picker'
import {
  MAX_RECIPIENTS,
  formatPhone,
  smsBody,
  smsHref,
  type Recipient,
} from './recipients'

/**
 * 초대장을 만들고, 만들어진 링크·QR·문자 보내기를 보여주는 화면 조각.
 *
 * 화면은 두 가지 모습뿐이다.
 *  - 만들기: 받는 사람(여러 명) + 첫 마디를 받는다
 *  - 보여주기: 받는 사람마다 한 줄씩, 문자 보내기·링크·QR
 * 시니어 사용자가 헤매지 않도록 한 번에 하나만 보여준다.
 *
 * ## 받는 사람은 왜 서버에 없나
 * 이름은 초대장의 호칭(relationship_label)으로 서버에 저장되지만,
 * **전화번호는 저장하지 않는다.** 번호는 문자 앱을 여는 sms: 주소를 만드는 데만
 * 이 화면에서 쓰고 버린다. 그래서 새로고침하면 번호가 사라지고, 그 줄은
 * "문자로 보내기" 대신 "링크 복사"만 남는다 — 의도한 동작이다.
 *
 * ## 결과 줄의 주인은 서버다
 * 화면은 서버가 준 aliveInvitations(내가 만든, 아직 아무도 안 쓴 초대장)만 그린다.
 * 방금 만든 것을 따로 들고 있지 않으므로, 아래 목록에서 취소하면 이 줄도 함께 사라진다.
 * (예전에는 취소한 뒤에도 죽은 링크가 위에 남아, 이미 닫힌 링크를 복사해 보내게 됐다.)
 */
export function InvitePanel({
  roomId,
  aliveInvitations,
}: {
  roomId: string
  /** 내가 만든 초대장 중 아직 살아 있는 것들. 최근 것이 먼저 온다. */
  aliveInvitations: InviteView[]
}) {
  /** 이번에 초대장을 보낼 사람들. 이 화면이 살아 있는 동안에만 있다. */
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  /** 일부만 실패했을 때 누가 실패했는지. 전부 성공하면 빈 배열. */
  const [failures, setFailures] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  /**
   * 토큰 → 전화번호. 문자 보내기 버튼을 그릴 수 있는 유일한 근거다.
   * 서버에는 보내지 않으므로 새로고침하면 사라진다.
   */
  const [phoneByToken, setPhoneByToken] = useState<Record<string, string>>({})

  /** 방금 만들었는지. 결과 화면으로 초점을 옮길지 판단하는 데만 쓴다. */
  const [justCreated, setJustCreated] = useState(false)

  /** 결과가 있는데도 만들기 화면을 다시 연 상태인지. */
  const [formOpen, setFormOpen] = useState(false)

  /*
    보여줄 초대장이 하나도 없으면 당연히 만들기 화면부터.
    다만 방금 만들었다면 결과 화면을 지킨다 — 서버가 새 목록을 내려주기까지의 짧은
    사이에 만들기 화면으로 되돌아가면, 사용자는 "안 만들어졌나?" 하고 한 번 더 누른다.
  */
  const showForm =
    formOpen || (aliveInvitations.length === 0 && !justCreated)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = message.trim()

    if (recipients.length === 0) {
      setErrorMessage('받는 분을 한 분 이상 추가해 주세요.')
      return
    }
    if (!trimmed) {
      setErrorMessage('초대장에 담을 첫 마디를 한 줄만 적어주세요.')
      return
    }

    setErrorMessage(null)
    setFailures([])
    setBusy(true)

    /*
      초대장은 사람마다 한 장씩이다 — 토큰이 하나뿐이면 먼저 연 한 분만 들어오고
      나머지는 막힌다. 그래서 createInvitation(호출 하나당 초대장 하나)을 사람 수만큼 부른다.
      순서대로 기다린다: 한꺼번에 던지면 어느 것이 실패했는지 짝을 맞추기 어렵고,
      느린 회선에서 요청이 몰려 더 잘 깨진다.
    */
    const phones: Record<string, string> = {}
    const failed: string[] = []

    for (const person of recipients) {
      const formData = new FormData()
      formData.set('room_id', roomId)
      formData.set('relationship_label', person.name)
      formData.set('invite_message', trimmed)

      const result = await createInvitation(null, formData)

      if (result?.ok) {
        if (person.phone) phones[result.invitation.token] = person.phone
      } else {
        failed.push(
          `${person.name}님: ${result?.error ?? '초대장을 만들지 못했어요.'}`,
        )
      }
    }

    setPhoneByToken((prev) => ({ ...prev, ...phones }))
    setFailures(failed)
    setBusy(false)

    // 전부 실패했으면 만들기 화면에 그대로 둔다. 적어둔 값을 날리면 처음부터 다시 쳐야 한다.
    if (failed.length === recipients.length) {
      setErrorMessage('초대장을 만들지 못했어요. 잠시 후 다시 눌러주세요.')
      return
    }

    setRecipients([])
    setMessage('')
    setFormOpen(false)
    setJustCreated(true)
  }

  if (showForm) {
    return (
      <>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <RecipientField
            recipients={recipients}
            onOpen={() => setPickerOpen(true)}
            onRemove={(id) =>
              setRecipients(recipients.filter((item) => item.id !== id))
            }
          />

          <Field
            id="invite_message"
            name="invite_message"
            as="textarea"
            rows={4}
            label="초대장에 담을 첫 마디"
            hint="초대장을 여는 순간 이 글이 먼저 보여요. 고른 분들께 똑같이 전해져요."
            maxLength={300}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value)
              setErrorMessage(null)
            }}
            placeholder="엄마, 우리 하루에 한마디씩 나눠봐요."
          />

          {errorMessage ? (
            <p role="alert" className="text-base leading-relaxed text-primary">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              fullWidth
              pending={busy}
              pendingText="초대장을 만드는 중…"
            >
              {recipients.length > 1
                ? `초대장 ${recipients.length}장 만들기`
                : '초대장 만들기'}
            </Button>

            {aliveInvitations.length > 0 ? (
              <Button
                variant="ghost"
                fullWidth
                onClick={() => setFormOpen(false)}
                disabled={busy}
              >
                그만두기
              </Button>
            ) : null}
          </div>
        </form>

        {pickerOpen ? (
          <RecipientPicker
            initial={recipients}
            onClose={() => setPickerOpen(false)}
            onConfirm={(chosen) => {
              setRecipients(chosen)
              setErrorMessage(null)
              setPickerOpen(false)
            }}
          />
        ) : null}
      </>
    )
  }

  return (
    <InviteResults
      invitations={aliveInvitations}
      phoneByToken={phoneByToken}
      failures={failures}
      justCreated={justCreated}
      onCreateAnother={() => {
        setJustCreated(false)
        setFailures([])
        setFormOpen(true)
      }}
    />
  )
}

/* ------------------------------------------------------------------ *
 * 받는 사람 칸 (캡처 초대하기1·3)
 * ------------------------------------------------------------------ */

/**
 * "받는 사람" + 점선 동그라미 [+] + 고른 사람 칩들.
 *
 * 아무도 없을 때만 동그라미 옆에 "추가하기" 글자가 붙는다(캡처 그대로).
 * 글자가 사라져도 낭독기에는 이름이 남도록 aria-label은 늘 붙인다.
 */
function RecipientField({
  recipients,
  onOpen,
  onRemove,
}: {
  recipients: Recipient[]
  onOpen: () => void
  onRemove: (id: string) => void
}) {
  const empty = recipients.length === 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-base font-medium text-ink">받는 사람</span>
        {!empty ? (
          <span className="shrink-0 tabular-nums text-base text-muted">
            {recipients.length}/{MAX_RECIPIENTS}
          </span>
        ) : null}
      </div>

      <ul className="flex flex-wrap items-start gap-3">
        <li>
          <button
            type="button"
            onClick={onOpen}
            aria-label="받는 사람 추가하기"
            className="flex items-center gap-3 rounded-inner pr-2 text-left active:bg-surface-soft"
          >
            <span
              aria-hidden
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-hairline-strong text-2xl text-muted"
            >
              +
            </span>
            {empty ? (
              <span className="text-lg text-ink">추가하기</span>
            ) : null}
          </button>
        </li>

        {recipients.map((person) => (
          <li key={person.id}>
            <div className="flex w-16 flex-col items-center gap-1">
              <div className="relative">
                <span
                  aria-hidden
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-xl font-extrabold text-primary"
                >
                  {[...person.name][0] ?? '?'}
                </span>
                {/* 보이는 X는 24px이지만 누르는 칸은 44px을 지킨다. */}
                <button
                  type="button"
                  onClick={() => onRemove(person.id)}
                  aria-label={`받는 사람에서 ${person.name} 빼기`}
                  className="absolute -top-3 -right-3 flex h-11 w-11 items-center justify-center rounded-full"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      strokeLinecap="round"
                      aria-hidden
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </span>
                </button>
              </div>
              <span className="w-full truncate text-center text-base text-ink">
                {person.name}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 결과
 * ------------------------------------------------------------------ */

/**
 * 이 기기에서 "메신저로 보내기"(Web Share)를 쓸 수 있는지.
 *
 * 서버에는 navigator가 없어서 화면이 처음 그려질 땐 무조건 false로 두고,
 * 브라우저에서 다시 그려질 때 실제 값으로 맞춘다.
 */
function useCanShare(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    () => false,
  )
}

function InviteResults({
  invitations,
  phoneByToken,
  failures,
  justCreated,
  onCreateAnother,
}: {
  invitations: InviteView[]
  phoneByToken: Record<string, string>
  failures: string[]
  justCreated: boolean
  onCreateAnother: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  /**
   * 초대장을 만들면 폼이 사라지고 이 화면으로 바뀐다.
   * 화면 낭독기를 쓰는 분은 그 사실을 알 방법이 없으므로 제목으로 초점을 옮겨준다.
   */
  useEffect(() => {
    if (!justCreated) return
    headingRef.current?.focus()
  }, [justCreated])

  // 만료 안내는 줄마다 되풀이하지 않고, 가장 이른 것 하나만 아래에 적는다.
  const soonest = invitations
    .map((item) => item.expiresAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-bold text-ink"
        >
          {invitations.length === 0
            ? '보여드릴 초대장이 없어요'
            : invitations.length > 1
              ? `초대장 ${invitations.length}장이 준비됐어요`
              : '초대장이 준비됐어요'}
        </h3>
        <p className="text-base leading-relaxed text-muted">
          {invitations.length === 0
            ? '방금 만든 초대장이 취소됐거나 이미 쓰였어요. 다시 만들어 주세요.'
            : '받는 분마다 링크가 따로 있어요. 아래에서 한 분씩 보내주세요.'}
        </p>
      </div>

      {failures.length > 0 ? (
        <div role="alert" className="flex flex-col gap-1 rounded-inner bg-surface-soft p-4">
          <p className="text-base font-medium text-primary">
            일부는 만들지 못했어요.
          </p>
          {failures.map((line) => (
            <p key={line} className="text-base leading-relaxed text-ink">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      <ul className="flex flex-col gap-3">
        {invitations.map((invitation) => (
          <InviteResultRow
            key={invitation.token}
            invitation={invitation}
            phone={phoneByToken[invitation.token] ?? null}
          />
        ))}
      </ul>

      <div
        className={`flex flex-col gap-2 rounded-inner bg-surface-soft p-5 ${
          invitations.length === 0 ? 'hidden' : ''
        }`}
      >
        {soonest ? (
          <p className="text-base text-muted">
            {formatKstFullDate(soonest)}까지 쓸 수 있어요.
          </p>
        ) : null}
        {/* 초대 링크는 1회용이다. accept_invitation이 입장에 성공하면 used_at을 채우고,
            그 뒤에 다른 사람이 열면 "이미 사용된 초대입니다" 예외로 막힌다.
            그래서 "누구나 들어올 수 있다"가 아니라 "먼저 연 한 분만"이라고 알려야 한다.
            단체방에 붙여넣으면 엉뚱한 사람이 자리를 차지해 버리기 때문이다. */}
        <p className="text-base leading-relaxed text-muted">
          링크 하나는 한 분만 쓸 수 있어요. 먼저 여신 분이 방에 들어오게 되니, 그
          분에게만 보내주세요.
        </p>
      </div>

      <Button
        variant={invitations.length === 0 ? 'primary' : 'ghost'}
        fullWidth
        onClick={onCreateAnother}
      >
        {invitations.length === 0
          ? '초대장 만들기'
          : '다른 분에게 보낼 초대장 만들기'}
      </Button>
    </div>
  )
}

function InviteResultRow({
  invitation,
  phone,
}: {
  invitation: InviteView
  /** 이 화면에서 방금 고른 번호. 새로고침하면 없다(저장하지 않는다). */
  phone: string | null
}) {
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>('idle')
  const [detailOpen, setDetailOpen] = useState(false)
  const canShare = useCanShare()
  const linkRef = useRef<HTMLInputElement>(null)

  // 복사했다는 안내는 잠깐만 띄운다.
  useEffect(() => {
    if (copyState !== 'done') return
    const timer = setTimeout(() => setCopyState('idle'), 3000)
    return () => clearTimeout(timer)
  }, [copyState])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(invitation.url)
      setCopyState('done')
    } catch {
      // 복사를 막는 브라우저도 있다. 그럴 땐 링크를 펼쳐 선택해 두고 직접 복사하게 안내한다.
      setDetailOpen(true)
      setCopyState('failed')
      // 링크 칸은 펼친 뒤에 생긴다. 그려진 다음에 선택한다.
      requestAnimationFrame(() => linkRef.current?.select())
    }
  }

  async function handleShare() {
    try {
      await navigator.share({
        title: '오늘도 사랑해 초대장',
        text: invitation.inviteMessage,
        url: invitation.url,
      })
    } catch {
      // 사용자가 공유창을 닫은 것뿐이다. 따로 알릴 일이 아니다.
    }
  }

  /**
   * 문자 앱을 연다.
   *
   * 서버가 문자를 대신 보내지 않는다(문자 발송 연동이 아직 없다). 문자 앱이 열리고
   * 본문까지 채워지지만, **보내기를 누르는 것은 사용자**다.
   * 주소를 그릴 때가 아니라 누를 때 만든다 — 기기에 따라 구분자가 달라서, 서버가 그린
   * 화면과 브라우저가 그린 화면이 어긋나면 안 된다.
   */
  function handleSms() {
    if (!phone) return
    window.location.href = smsHref(
      phone,
      smsBody(invitation.inviteMessage, invitation.url),
    )
  }

  return (
    <Card as="li">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-extrabold text-primary"
          >
            {[...invitation.relationshipLabel][0] ?? '?'}
          </span>

          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-lg font-medium text-ink">
              {invitation.relationshipLabel}님께
            </p>
            <p className="truncate text-base text-muted">
              {phone ? formatPhone(phone) : '링크를 복사해 보내주세요'}
            </p>
          </div>
        </div>

        <div
          aria-live="polite"
          className={copyState === 'idle' ? 'sr-only' : 'text-base text-primary'}
        >
          {copyState === 'done'
            ? '링크를 복사했어요. 문자나 메신저에 붙여넣어 주세요.'
            : copyState === 'failed'
              ? '링크를 선택해 두었어요. 길게 눌러 복사해 주세요.'
              : ''}
        </div>

        {/*
          번호를 아는 분에게는 문자 앱을 열어준다.
          번호가 없으면(연락처가 이름만 줬거나, 새로고침해서 번호가 사라졌으면)
          그 자리에 링크 복사를 둔다 — 누를 것이 없는 줄을 만들지 않는다.
        */}
        {phone ? (
          <Button size="md" fullWidth onClick={handleSms}>
            문자로 보내기
          </Button>
        ) : (
          <Button size="md" fullWidth onClick={handleCopy}>
            링크 복사하기
          </Button>
        )}

        <button
          type="button"
          onClick={() => setDetailOpen(!detailOpen)}
          aria-expanded={detailOpen}
          className="self-start text-base text-primary underline"
        >
          {detailOpen ? '링크·QR 접기' : '링크·QR 보기'}
        </button>

        {detailOpen ? (
          <div className="flex flex-col gap-3">
            <label
              htmlFor={`invite-link-${invitation.token}`}
              className="text-base font-medium text-ink"
            >
              초대 링크
            </label>
            <input
              id={`invite-link-${invitation.token}`}
              ref={linkRef}
              readOnly
              value={invitation.url}
              onFocus={(event) => event.currentTarget.select()}
              className="w-full rounded-[8px] border border-hairline bg-surface-soft px-4 py-3 text-base text-ink"
            />

            {/* QR은 서버에서 만든 data URL이라 next/image로 최적화할 대상이 아니다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={invitation.qrDataUrl}
              alt={`${invitation.relationshipLabel}님을 초대하는 QR 코드`}
              width={200}
              height={200}
              className="h-50 w-50 self-center rounded-inner border border-hairline"
            />
            <p className="text-center text-base leading-relaxed text-muted">
              옆에 계시면 이 QR 코드를 휴대폰 카메라로 비춰 달라고 해보세요.
            </p>

            {phone ? (
              <Button variant="secondary" size="md" fullWidth onClick={handleCopy}>
                링크 복사하기
              </Button>
            ) : null}

            {canShare ? (
              <Button variant="secondary" size="md" fullWidth onClick={handleShare}>
                메신저로 보내기
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  )
}
