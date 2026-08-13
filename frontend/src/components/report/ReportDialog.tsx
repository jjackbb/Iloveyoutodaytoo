'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'

import {
  REPORT_REASONS,
  reportReasonLabel,
  type ReportTargetType,
} from '@/components/report/reasons'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { REPORT_DETAIL_MAX_LENGTH } from '@/lib/limits'
import { submitReport, type ReportState } from '@/lib/actions/reports'

/**
 * 신고 양식. 신고 화면(/report/[targetType]/[targetId])의 알맹이다.
 *
 * 흐름은 세 걸음이다.
 *   1) 고르기  — 사유 하나 + (원하면) 자세한 내용
 *   2) 확인하기 — 무엇을 어떻게 접수하는지 사용자 언어로 다시 보여준다
 *   3) 접수됨   — 언제 확인되는지, 지금 당장 안 보고 싶으면 무엇을 할 수 있는지
 *
 * 왜 확인 단계를 두는가:
 * 접수한 신고는 사용자가 스스로 취소할 수 없다. 되돌릴 수 없는 동작은 무슨 일이
 * 벌어지는지 먼저 정확히 말해주고 한 번 더 물어본다(04_PROJECT_SPEC.md 작업 규칙).
 * 시니어 사용자가 목록을 훑다가 손이 미끄러져 신고가 접수되는 일을 막는 뜻도 있다.
 *
 * 여기 없는 것 = 일부러 뺀 것:
 * 좋아요·댓글 같은 반응 수단을 곁들이지 않는다. 이 화면은 신고만 한다.
 */

export interface ReportDialogProps {
  targetType: ReportTargetType
  targetId: string
  /** 무엇을 신고하는지 한 줄로. 예: "김영희님이 8월 5일에 남긴 마음 한마디" */
  targetSummary: string
  /** 신고할 내용 일부. 글이면 앞부분, 음성·사진이면 종류만. 없으면 null. */
  targetPreview?: string | null
  /** 그만두거나 다 마쳤을 때 돌아갈 경로. 이미 safeNextPath로 걸러진 값이 온다. */
  backHref: string
  /**
   * 이 상대를 차단할 수 있는 화면 경로. 차단은 "함께 있는 관계방의 설정 > 구성원"에서만 된다.
   * 어느 방인지 알 수 없으면(예: 이용자 신고) null. 그때는 링크 없이 말로만 안내한다.
   */
  blockHref?: string | null
}

export function ReportDialog({
  targetType,
  targetId,
  targetSummary,
  targetPreview,
  backHref,
  blockHref = null,
}: ReportDialogProps) {
  const [state, formAction, pending] = useActionState<ReportState, FormData>(
    submitReport,
    null,
  )

  const [step, setStep] = useState<'choose' | 'confirm'>('choose')
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  /** 사유를 안 고르고 넘어가려 할 때만 화면에서 먼저 잡아주는 문구. */
  const [reasonError, setReasonError] = useState<string | null>(null)

  /**
   * 걸음이 바뀌면 초점을 새 걸음의 첫머리로 옮긴다.
   *
   * 옮기지 않으면 방금 누른 버튼이 사라지면서 초점이 문서 맨 위로 튄다.
   * 화면 낭독기를 쓰는 분은 "무엇이 바뀌었는지" 아무 안내도 못 듣고,
   * 키보드로 쓰는 분은 처음부터 다시 탭을 눌러 내려와야 한다.
   */
  const chooseRef = useRef<HTMLFieldSetElement>(null)
  const confirmRef = useRef<HTMLHeadingElement>(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    // 화면에 처음 뜰 때는 건드리지 않는다. 사용자가 스스로 움직인 뒤에만 옮긴다.
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (step === 'confirm') confirmRef.current?.focus()
    else chooseRef.current?.focus()
  }, [step])

  // --- 3) 접수됨 ---------------------------------------------------------
  if (state?.status === 'done') {
    return (
      <ResultPanel
        title="신고가 접수됐어요"
        backHref={backHref}
        blockHref={blockHref}
      >
        <p>
          알려주셔서 고맙습니다. 접수된 내용은 운영자가 하나씩 확인한 뒤 필요한
          조치를 취해요.
        </p>
        <p>
          확인에는 시간이 걸릴 수 있어요. 처리 결과를 따로 알려드리지 못할 때도
          있으니 이 점은 너그러이 봐주세요.
        </p>
      </ResultPanel>
    )
  }

  // --- 이미 신고한 대상 ---------------------------------------------------
  if (state?.status === 'duplicate') {
    return (
      <ResultPanel
        title="이미 신고하셨어요"
        backHref={backHref}
        blockHref={blockHref}
      >
        <p>{state.message}</p>
        <p>먼저 보내주신 신고를 운영자가 확인하고 있어요.</p>
      </ResultPanel>
    )
  }

  const formError = state?.status === 'error' ? state.message : null
  const detailError =
    state?.status === 'error' && state.field === 'detail' ? state.message : null
  const serverReasonError =
    state?.status === 'error' && state.field === 'reason' ? state.message : null

  function handleNext() {
    if (!reason) {
      setReasonError('어떤 점이 문제였는지 하나만 골라주세요.')
      return
    }
    setReasonError(null)
    setStep('confirm')
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />

      {/* 무엇을 신고하는 중인지 늘 눈에 보이게 둔다. */}
      <section className="flex flex-col gap-2 rounded-[14px] bg-surface-soft px-5 py-4">
        <h2 className="text-base text-muted">신고할 내용</h2>
        <p className="text-lg font-medium leading-relaxed text-ink">
          {targetSummary}
        </p>
        {targetPreview ? (
          <p className="text-base leading-relaxed text-muted">
            “{targetPreview}”
          </p>
        ) : null}
      </section>

      {step === 'choose' ? (
        <>
          {/*
            여러 개 중 하나를 고르는 묶음이라 fieldset/legend로 짠다.
            FieldShell을 쓰면 <label for>가 "첫 번째 라디오"를 가리키게 되는데,
            그러면 "어떤 점이 문제였나요?"라는 물음을 손으로 짚기만 해도
            욕설·비방이 조용히 골라진다. 화면 낭독기에서도 첫 항목의 이름이
            물음과 뒤섞여 읽힌다. 둘 다 시니어 사용자에게 위험하다.
          */}
          <fieldset
            ref={chooseRef}
            tabIndex={-1}
            aria-describedby={
              [
                'reason-hint',
                (reasonError ?? serverReasonError) ? 'reason-error' : null,
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
            className="outline-none"
          >
            <legend className="mb-2 text-base font-medium text-ink">
              어떤 점이 문제였나요?
            </legend>
            <p
              id="reason-hint"
              className="mb-3 text-base leading-relaxed text-muted"
            >
              가장 가까운 것 하나만 골라주세요.
            </p>

            <div className="flex flex-col gap-2">
              {REPORT_REASONS.map((item) => {
                const selected = reason === item.value
                return (
                  <label
                    key={item.value}
                    htmlFor={`reason-${item.value}`}
                    className={[
                      'flex min-h-[52px] cursor-pointer items-start gap-3 rounded-[8px] border-2 px-4 py-3',
                      // 고른 것을 색으로만 알리지 않는다 — 라디오 점(모양)이 함께 바뀐다.
                      selected
                        ? 'border-primary bg-primary-soft'
                        : 'border-hairline-strong bg-card',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      id={`reason-${item.value}`}
                      name="reason"
                      value={item.value}
                      checked={selected}
                      onChange={() => {
                        setReason(item.value)
                        setReasonError(null)
                      }}
                      className="mt-1 h-6 w-6 shrink-0 accent-primary"
                    />
                    <span className="flex flex-col gap-1">
                      <span className="text-lg font-medium text-ink">
                        {item.label}
                      </span>
                      <span className="text-base leading-relaxed text-muted">
                        {item.hint}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>

            {(reasonError ?? serverReasonError) ? (
              <p
                id="reason-error"
                role="alert"
                className="mt-2 text-base leading-relaxed text-primary"
              >
                {reasonError ?? serverReasonError}
              </p>
            ) : null}
          </fieldset>

          <Field
            id="detail"
            name="detail"
            as="textarea"
            rows={4}
            label="자세한 내용 (안 적으셔도 괜찮아요)"
            hint="어떤 일이 있었는지 적어주시면 확인이 빨라져요."
            labelSuffix={`${detail.length} / ${REPORT_DETAIL_MAX_LENGTH}자`}
            maxLength={REPORT_DETAIL_MAX_LENGTH}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            error={detailError}
          />

          {formError && !detailError && !serverReasonError ? (
            <p role="alert" className="text-base leading-relaxed text-primary">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-col gap-3">
            <Button type="button" fullWidth onClick={handleNext}>
              다음
            </Button>
            <ButtonLink href={backHref} variant="ghost" fullWidth>
              그만두기
            </ButtonLink>
          </div>
        </>
      ) : (
        <>
          {/* 확인 단계에서는 입력칸이 사라지므로 값을 그대로 실어 보낸다. */}
          <input type="hidden" name="reason" value={reason} />
          <input type="hidden" name="detail" value={detail} />

          <section className="flex flex-col gap-4">
            <h2
              ref={confirmRef}
              tabIndex={-1}
              className="text-xl font-bold text-ink outline-none"
            >
              이대로 접수할까요?
            </h2>

            <dl className="flex flex-col gap-4 rounded-[14px] border border-hairline px-5 py-4">
              <div className="flex flex-col gap-1">
                <dt className="text-base text-muted">고르신 이유</dt>
                <dd className="text-lg font-medium text-ink">
                  {reportReasonLabel(reason)}
                </dd>
              </div>
              {detail ? (
                <div className="flex flex-col gap-1">
                  <dt className="text-base text-muted">자세한 내용</dt>
                  <dd className="whitespace-pre-wrap text-lg leading-relaxed text-ink">
                    {detail}
                  </dd>
                </div>
              ) : null}
            </dl>

            {/* 무슨 일이 일어나는지 사용자 언어로 정확히 적는다. */}
            <ul className="flex flex-col gap-2 text-base leading-relaxed text-muted">
              <li>· 운영자가 내용을 확인한 뒤 필요한 조치를 취해요.</li>
              <li>· 신고한 사실은 상대방에게 알려지지 않아요.</li>
              <li>
                · 접수한 뒤에는 취소할 수 없어요. 같은 대상은 한 번만 신고할 수
                있어요.
              </li>
              <li>
                · 신고해도 상대의 글이 바로 사라지지는 않아요. 지금 당장 보고
                싶지 않으시면 아래 안내를 봐주세요.
              </li>
            </ul>
          </section>

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
              pendingText="접수하는 중…"
            >
              신고 접수하기
            </Button>
            <Button
              type="button"
              variant="ghost"
              fullWidth
              disabled={pending}
              onClick={() => setStep('choose')}
            >
              다시 고르기
            </Button>
          </div>

          <BlockHint blockHref={blockHref} />
        </>
      )}
    </form>
  )
}

/**
 * 접수 완료·이미 신고함 화면의 공통 껍데기.
 * 신고는 시간이 걸리는 일이라, 지금 당장 할 수 있는 일(차단)을 반드시 함께 알려준다.
 */
function ResultPanel({
  title,
  children,
  backHref,
  blockHref,
}: {
  title: string
  children: React.ReactNode
  backHref: string
  blockHref: string | null
}) {
  return (
    <div role="status" className="flex flex-col gap-7">
      <div className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold leading-snug text-ink">{title}</h2>
        <div className="flex flex-col gap-3 text-base leading-relaxed text-muted">
          {children}
        </div>
      </div>

      <BlockHint blockHref={blockHref} />

      <ButtonLink href={backHref} fullWidth>
        돌아가기
      </ButtonLink>
    </div>
  )
}

/**
 * 급할 때 지금 바로 할 수 있는 일 안내.
 *
 * 문구는 실제 동작과 한 글자도 어긋나면 안 된다. 확인한 사실만 적는다.
 * - 차단을 거는 곳은 "관계방 > 설정 > 함께하는 분" 목록이다.
 *   마이 화면의 "차단한 분"은 이미 차단한 분을 **푸는** 곳이지 새로 거는 곳이 아니다.
 * - 차단하면 그분이 보낸 마음은 사서함에서도 **보이지 않는다**
 *   (heart_messages_select 정책에 not has_blocked(sender_id)가 들어 있다).
 *   지워지는 게 아니라 가려지는 것이고, 차단을 풀면 다시 보인다.
 */
function BlockHint({ blockHref }: { blockHref: string | null }) {
  return (
    <aside className="flex flex-col gap-2 rounded-[14px] bg-primary-soft px-5 py-4">
      <h3 className="text-lg font-medium text-ink">
        지금 바로 안 보이게 하고 싶다면
      </h3>
      <p className="text-base leading-relaxed text-ink">
        상대를 <strong className="font-medium">차단</strong>하면 그분이 남긴
        마음 한마디와 추억이 내 화면에 더는 보이지 않아요.{' '}
        {blockHref ? (
          <>
            차단은{' '}
            <Link href={blockHref} className="text-primary underline">
              이 방의 설정 화면
            </Link>
            에서 함께하는 분 목록을 열면 할 수 있어요.
          </>
        ) : (
          <>
            차단은 그분과 함께 있는 관계방을 열고 [설정] 화면의 함께하는 분
            목록에서 할 수 있어요.
          </>
        )}
      </p>
      <p className="text-base leading-relaxed text-muted">
        차단해도 지금까지 주고받은 기록은 지워지지 않아요. 차단하는 동안에는
        그분의 마음이 사서함에서도 보이지 않다가, 차단을 풀면 다시 보여요.
        차단은 마이 화면의 &apos;차단한 분&apos;에서 언제든 풀 수 있어요.
      </p>
    </aside>
  )
}
