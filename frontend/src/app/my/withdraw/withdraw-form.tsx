'use client'

import { useActionState, useState, type ReactNode } from 'react'

import { Button, ButtonLink } from '@/components/ui/Button'
import { Field, FieldShell } from '@/components/ui/Field'
import { withdrawAccount, type WithdrawState } from '@/lib/actions/withdraw'

/**
 * 회원 탈퇴 화면의 본문 — 무슨 일이 일어나는지 안내 + 사유 + 마지막 확인.
 *
 * 안내 문구를 서버 컴포넌트가 아니라 여기에 둔 이유:
 * 탈퇴가 끝나면 이 자리를 통째로 작별 인사로 바꿔야 하는데,
 * 안내가 바깥(page.tsx)에 있으면 작별 인사 위에 "탈퇴하면 이렇게 됩니다"가 남는다.
 *
 * 화면에 적는 내용은 실제 DB가 하는 일과 반드시 같아야 한다.
 * 여기 적힌 것은 전부 스키마(외래키 규칙)와 withdraw_account 함수를 확인하고 쓴 것이다.
 *
 * 확인한 사실 (예전 문구가 여기서 어긋나 있었다):
 *  - rooms.owner_id 는 ON DELETE SET NULL 이고, withdraw_account 가 탈퇴 전에
 *    방장을 남은 활성 구성원에게 넘긴다. → 함께 쓰던 방은 사라지지 않는다.
 *  - withdraw_account 는 `owner_id = 나` 이면서 `나 외의 room_members 행이 하나도 없는`
 *    방만 지운다(status 무관). → 사라지는 건 나 혼자만 있던 방뿐이다.
 *  - heart_messages 의 sender_id·receiver_id 는 둘 다 ON DELETE SET NULL 이다.
 *    → 내가 보낸 마음은 상대 사서함에, 내가 받은 마음은 상대의 '보낸 마음'에 남고
 *      내 자리만 비워진다. 화면에는 '탈퇴한 사용자'로 보인다
 *      (src/components/message/MessageBubble.tsx 의 WITHDRAWN_SENDER_NAME).
 */

/**
 * 마지막 확인 문구. src/lib/actions/withdraw.ts 에도 같은 값이 있다.
 * ('use server' 파일은 async 함수 외에 export 할 수 없어 한곳에 모을 수가 없다)
 * 서버는 공백을 지우고 비교하므로 띄어쓰기 차이로는 어긋나지 않는다.
 */
const CONFIRM_PHRASE = '탈퇴합니다'

/** 자유 입력 상한. DB 함수가 1000자에서 자른다. */
const DETAIL_MAX_LENGTH = 1000

/**
 * 탈퇴 사유 보기.
 *
 * 고르지 않아도 탈퇴할 수 있다. 사유를 물어보되 답을 조건으로 걸지 않는다.
 * 저장될 때는 사용자와 이어지는 참조 없이 통계로만 남는다(withdrawal_reasons).
 */
const REASON_OPTIONS = [
  '함께 마음을 나눌 사람이 없어요',
  '쓸 일이 많지 않았어요',
  '쓰는 방법이 어려웠어요',
  '알림이 부담스러웠어요',
  '개인정보가 걱정돼요',
  '잠시 쉬었다 올게요',
  '말하고 싶지 않아요',
  '기타',
] as const

const REASON_GROUP_ID = 'withdraw-reason'
const REASON_GROUP_LABEL = '떠나시는 이유를 들려주실 수 있을까요? (선택)'

/** 탈퇴하면 내 방들이 어떻게 되는지. page.tsx가 실제 DB를 읽어 채워 넣는다. */
export type WithdrawRoomSummary = {
  /** 내가 만든 방 중 다른 분의 기록이 함께 들어 있어 그대로 남는 방의 이름 (그분이 나간 방도 포함) */
  keptRoomNames: string[]
  /** 그중 지금도 함께 계신 분이 있어 방장 자리가 그분께 넘어갈 방의 이름 */
  handoverRoomNames: string[]
  /** 내가 만든 방 중 나 말고 아무도 들어온 적 없어 함께 정리되는 방의 이름 */
  soloRoomNames: string[]
  /** 내가 만들지 않은 방 중 내가 속했던 방의 개수 (지금 나온 방도 포함) */
  guestRoomCount: number
  /**
   * 내가 이미 나온 내 방의 개수. RLS 때문에 구성원을 확인할 수 없는 방이다.
   * 0보다 크면 "해당하는 방이 없어요" 같은 단정을 하지 않는다 — 확인 못 했을 뿐이다.
   */
  unverifiedRoomCount: number
  /** 방 목록을 불러오지 못했으면 true. 숫자 대신 일반 안내만 보여준다. */
  unavailable: boolean
}

/** 이름 여러 개를 ‘가’, ‘나’ 처럼 따옴표를 붙여 잇는다. */
function joinRoomNames(names: string[]) {
  return names.map((name) => `‘${name}’`).join(', ')
}

/** 목록 한 줄. 색만으로 뜻을 전하지 않도록 앞에 기호와 제목을 함께 둔다. */
function InfoItem({
  mark,
  title,
  children,
}: {
  mark: string
  title: string
  children: ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-[2px] shrink-0 text-lg font-bold text-ink"
      >
        {mark}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-base font-bold text-ink">{title}</p>
        <p className="text-base leading-relaxed text-muted">{children}</p>
      </div>
    </li>
  )
}

export function WithdrawPanel({ summary }: { summary: WithdrawRoomSummary }) {
  const [state, formAction, pending] = useActionState<WithdrawState, FormData>(
    withdrawAccount,
    null,
  )

  const [reason, setReason] = useState<string | null>(null)
  const [detail, setDetail] = useState('')

  if (state?.status === 'done') {
    // 쿠키가 지워지면 서버가 이 화면을 다시 그리며 같은 작별 인사를 보여준다.
    // 다시 그리기가 일어나지 않는 경우를 대비해 여기서도 보여준다.
    //
    // 이 경우에는 page.tsx의 머리말 <h1>회원 탈퇴</h1>가 아직 화면에 남아 있다.
    // 여기서도 h1을 쓰면 한 화면에 h1이 둘이 되어 제목 차례가 어긋난다.
    return <WithdrawFarewell headingLevel="h2" />
  }

  const confirmError =
    state?.status === 'error' && state.field === 'confirm' ? state.message : null
  const formError =
    state?.status === 'error' && !state.field ? state.message : null

  const {
    keptRoomNames,
    handoverRoomNames,
    soloRoomNames,
    guestRoomCount,
    unverifiedRoomCount,
    unavailable,
  } = summary

  /*
   * 탈퇴한 뒤에도 내 마음이 남아 있을 방이 하나라도 있는지.
   * 함께 쓴 내 방 + 내가 만들지 않은 방 + 확인하지 못한 방을 모두 센다.
   * 셋 다 0일 때만 "남는 마음이 없다"고 말할 수 있다. 확인 못 한 방이 있으면 말하지 않는다.
   */
  const somethingRemains =
    keptRoomNames.length + guestRoomCount + unverifiedRoomCount > 0

  return (
    <div className="flex flex-col gap-8">
      <p className="text-base leading-relaxed text-ink">
        탈퇴하면 아래와 같이 됩니다. 되돌릴 수 없으니 한 번만 읽어봐 주세요.
      </p>

      <section
        aria-labelledby="withdraw-effect-heading"
        className="flex flex-col gap-4 rounded-[14px] bg-surface-soft px-5 py-5"
      >
        <h2
          id="withdraw-effect-heading"
          className="text-lg font-bold text-ink"
        >
          지워지는 것
        </h2>

        <ul className="flex flex-col gap-4">
          <InfoItem mark="1." title="계정과 개인정보">
            이름·아이디·생년월일 같은 회원 정보는 <b>바로</b> 지워집니다. 따로
            보관하는 기간은 없어요. 되돌릴 수 없고, 같은 계정으로 다시 들어올 수
            없습니다.
          </InfoItem>

          <InfoItem mark="2." title="나 혼자만 있던 방">
            나 말고 아무도 들어온 적 없는 방은 나와 함께 정리됩니다. 그 방에 적어둔
            마음도 같이 지워져요.
            {/*
              "해당하는 방이 없다"는 확인했을 때만 말한다.
              내가 이미 나온 방(unverifiedRoomCount)은 구성원을 볼 수 없어서
              없다고 단정할 수 없다. 그럴 때는 위의 원칙만 알리고 입을 다문다.
            */}
            {unavailable ? null : soloRoomNames.length > 0 ? (
              <>
                {' '}
                지금은 <b>{joinRoomNames(soloRoomNames)}</b> 방이 여기에 해당해요.
              </>
            ) : unverifiedRoomCount === 0 ? (
              <> 지금은 여기에 해당하는 방이 없어요.</>
            ) : null}
          </InfoItem>
        </ul>
      </section>

      <section
        aria-labelledby="withdraw-keep-heading"
        className="flex flex-col gap-4 rounded-[14px] border border-hairline px-5 py-5"
      >
        <h2 id="withdraw-keep-heading" className="text-lg font-bold text-ink">
          그대로 남는 것
        </h2>

        <ul className="flex flex-col gap-4">
          <InfoItem mark="3." title="함께 쓰던 방">
            {!unavailable && !somethingRemains ? (
              <>지금은 다른 분과 함께 쓰는 방이 없어요.</>
            ) : (
              <>
                다른 분과 함께 쓴 방은 <b>그대로 남습니다.</b> 방이 없어지거나
                그분 화면에서 사라지지 않아요.
                {handoverRoomNames.length > 0 ? (
                  <>
                    {' '}
                    내가 만든 <b>{joinRoomNames(handoverRoomNames)}</b> 방은
                    방장 자리가 함께 계신 분께 넘어가요.
                  </>
                ) : null}
              </>
            )}
          </InfoItem>

          <InfoItem mark="4." title="내가 보낸 마음">
            {!unavailable && !somethingRemains ? (
              <>지금은 다른 분에게 남는 마음이 없습니다.</>
            ) : (
              <>
                내가 보낸 마음은 받으신 분의 사서함에 <b>그대로 남습니다.</b>{' '}
                그것은 그분의 기록이기도 하기 때문입니다. 다만 누가 보냈는지는
                지워져서, 보낸 사람 자리에 &lsquo;탈퇴한 사용자&rsquo;라고
                보입니다. <b>이미 나온 방에 남긴 마음도 마찬가지입니다.</b>
              </>
            )}
          </InfoItem>

          <InfoItem mark="5." title="내가 받은 마음">
            {!unavailable && !somethingRemains ? (
              <>
                마찬가지로, 다른 분의 &lsquo;보낸 마음&rsquo;에 남는 기록도
                없습니다.
              </>
            ) : (
              <>
                내가 받았던 마음도 보내신 분의 &lsquo;보낸 마음&rsquo;에 그대로
                남습니다. 마찬가지로 받는 사람 자리에서 내 이름은 지워집니다.
              </>
            )}
          </InfoItem>
        </ul>
      </section>

      <form action={formAction} className="flex flex-col gap-8">
        <FieldShell
          id={REASON_GROUP_ID}
          label={REASON_GROUP_LABEL}
          hint="고르지 않아도 탈퇴할 수 있어요. 누가 썼는지 알 수 없게 모아 서비스를 고치는 데만 씁니다."
        >
          <div
            id={REASON_GROUP_ID}
            role="radiogroup"
            aria-label={REASON_GROUP_LABEL}
            aria-describedby={`${REASON_GROUP_ID}-hint`}
            className="flex flex-col gap-2"
          >
            {REASON_OPTIONS.map((option) => {
              const checked = reason === option

              return (
                <label
                  key={option}
                  className={[
                    'flex min-h-[52px] cursor-pointer items-center gap-3',
                    'rounded-[8px] border-2 px-4 py-3 text-base transition-colors',
                    'focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-primary',
                    checked
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-hairline-strong bg-card text-ink active:bg-surface-soft',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={option}
                    checked={checked}
                    onChange={() => setReason(option)}
                    className="sr-only"
                  />

                  {/* 고른 항목을 색으로만 알리지 않는다. 동그라미 안 체크 표시로도 보여준다. */}
                  <span
                    aria-hidden
                    className={[
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                      checked
                        ? 'border-primary bg-primary text-white'
                        : 'border-hairline-strong bg-card',
                    ].join(' ')}
                  >
                    {checked ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m5 12 5 5L19 7" />
                      </svg>
                    ) : null}
                  </span>

                  {option}
                </label>
              )
            })}
          </div>

          {/* 라디오는 한 번 고르면 되돌릴 수 없다. 마음이 바뀌면 지울 수 있게 둔다. */}
          {reason ? (
            <button
              type="button"
              onClick={() => setReason(null)}
              className="min-h-[44px] self-start rounded-[8px] px-2 text-base text-muted underline active:bg-surface-soft"
            >
              선택 지우기
            </button>
          ) : null}
        </FieldShell>

        <Field
          id="withdraw-detail"
          name="detail"
          as="textarea"
          rows={4}
          label="더 하고 싶은 말씀이 있다면 적어주세요 (선택)"
          hint="답장하지 않아도 되는 칸입니다. 비워두셔도 괜찮아요."
          maxLength={DETAIL_MAX_LENGTH}
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          labelSuffix={`${detail.length}/${DETAIL_MAX_LENGTH}`}
        />

        <div className="flex flex-col gap-4 rounded-[14px] border-2 border-primary px-5 py-5">
          <p className="text-base leading-relaxed text-ink">
            실수로 눌리지 않도록, 마지막으로 아래 문구를 그대로 적어주세요.
          </p>
          <p className="text-2xl font-bold text-ink">{CONFIRM_PHRASE}</p>

          <Field
            id="withdraw-confirm"
            name="confirm"
            label={`"${CONFIRM_PHRASE}" 입력`}
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
            error={confirmError}
          />
        </div>

        {formError ? (
          <p role="alert" className="text-base leading-relaxed text-primary">
            {formError}
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            fullWidth
            pending={pending}
            pendingText="처리하는 중…"
          >
            탈퇴하기
          </Button>

          <ButtonLink href="/my" variant="secondary" fullWidth>
            돌아가기
          </ButtonLink>
        </div>
      </form>
    </div>
  )
}

/**
 * 탈퇴가 끝난 뒤 보여주는 작별 화면.
 *
 * 붙잡거나 죄책감을 주는 말은 쓰지 않는다. 담담하게 인사하고 문을 열어둔다.
 * page.tsx(서버)와 WithdrawPanel(클라이언트) 양쪽에서 쓰기 때문에 여기에 둔다.
 *
 * headingLevel: 화면에 이미 h1이 있으면 'h2'를 넘긴다.
 * page.tsx가 혼자 띄울 때는 이게 그 화면의 유일한 제목이라 기본값 h1이 맞다.
 */
export function WithdrawFarewell({
  headingLevel = 'h1',
}: {
  headingLevel?: 'h1' | 'h2'
} = {}) {
  const Heading = headingLevel

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      <Heading className="text-2xl font-bold text-ink">탈퇴가 끝났습니다</Heading>

      <div className="flex flex-col gap-3">
        <p className="text-base leading-relaxed text-ink">
          계정과 개인정보는 모두 지워졌습니다.
        </p>
        <p className="text-base leading-relaxed text-muted">
          그동안 이곳에 남겨주신 마음, 고맙습니다.
          <br />
          언제든 다시 오셔도 좋습니다.
        </p>
      </div>

      <ButtonLink href="/login" variant="secondary">
        처음 화면으로
      </ButtonLink>
    </div>
  )
}
