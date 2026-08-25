'use client'

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { Button } from '@/components/ui/Button'
import { controlClassName, FieldShell } from '@/components/ui/Field'
import {
  WheelColumn,
  WheelGroup,
  WheelSelect,
} from '@/components/ui/WheelPicker'
import {
  birthYearOptions,
  daysInMonth,
  formatBirthDateKorean,
  maskTypedBirthDate,
  parseIsoDate,
  parseTypedBirthDate,
  toIsoDate,
  validateBirthDate,
  type BirthDateParts,
} from '@/lib/birth-date'

/**
 * 생년월일 입력칸 (참고/1.png — 당근마켓 계정 만들기 화면).
 *
 * 칸은 하나다. 값은 "1985년 8월 9일"로 보이고, 누르면 아래에서 시트가 올라온다.
 * 시트 안에는 **숫자 칸과 년·월·일 휠이 함께** 있고 둘은 같은 값을 본다.
 *
 *   - 굴려서 고르면 위 숫자 칸이 따라 바뀐다.
 *   - 숫자를 치면 휠이 그 자리로 따라 움직인다.
 *
 * 어느 쪽으로 넣든 **칸에 보이는 글자는 언제나 "1985년 8월 9일"** 이다(참고/생년월일.png).
 * 하이픈은 저장 형태('YYYY-MM-DD')일 뿐 화면에는 나오지 않는다.
 *
 * 모드를 바꾸는 버튼이 없다. 열자마자 숫자 칸에 초점이 있어서, 굴리기 싫은 사람은
 * 그냥 치면 되고 치기 싫은 사람은 아래를 굴리면 된다.
 *
 * 브라우저 달력(input type="date")은 걷어냈다. 1985년까지 가려면 월을 수백 번 넘겨야 하고,
 * 연도 칸에 123456처럼 여섯 자리가 그대로 들어가 서버까지 갔다.
 * 지금은 숫자 칸이 `maskTypedBirthDate`를 지나므로 **치든 붙여넣든** 연도 덩이가
 * 네 글자를 넘길 수 없다. 서버(`validateBirthDate`)도 같은 것을 한 번 더 본다.
 *
 * 폼으로 나가는 값은 숨은 칸 하나에 'YYYY-MM-DD'로만 실린다.
 */

/** 값이 하나도 없을 때 휠이 처음 서 있을 자리. 40년 전쯤이면 굴리는 거리가 짧다. */
const DEFAULT_WHEEL_AGE = 40

export interface BirthDateFieldProps {
  /** 폼에 실릴 이름. 예: "birth_date" */
  name: string
  label?: ReactNode
  hint?: ReactNode
  /** 서버가 돌려준 오류. */
  error?: string | null
  /** 처음 채워둘 값 ('YYYY-MM-DD'). 비우면 빈 칸으로 시작한다. */
  defaultValue?: string
  /**
   * 성한 값이 되면 'YYYY-MM-DD'를, 아니면 빈 문자열을 알려준다.
   * 가입 폼은 이 값으로 만 14세 미만인지 판단한다.
   */
  onValueChange?: (isoDate: string) => void
}

export function BirthDateField({
  name,
  label = '생년월일',
  hint,
  error,
  defaultValue = '',
  onValueChange,
}: BirthDateFieldProps) {
  const fieldId = useId()
  const triggerId = `${fieldId}-trigger`

  const [isoDate, setIsoDate] = useState(() =>
    parseIsoDate(defaultValue) && !validateBirthDate(defaultValue)
      ? defaultValue
      : '',
  )
  const [sheetOpen, setSheetOpen] = useState(false)

  /** 시트를 열 때 휠이 서 있을 자리. 아직 고른 값이 없으면 40년 전 1월 1일. */
  const wheelInitial: BirthDateParts = useMemo(() => {
    const parsed = parseIsoDate(isoDate)
    if (parsed) return parsed

    const thisYear = new Date().getFullYear()
    return { year: thisYear - DEFAULT_WHEEL_AGE, month: 1, day: 1 }
  }, [isoDate])

  function commit(next: string) {
    setIsoDate(next)
    onValueChange?.(next)
    setSheetOpen(false)
  }

  return (
    <FieldShell id={triggerId} label={label} hint={hint} error={error}>
      {/* 폼으로 나가는 값은 이것 하나뿐이다. */}
      <input type="hidden" name={name} value={isoDate} />

      {/*
        칸 하나. 모양은 다른 입력칸과 똑같이(controlClassName) 두어 "여기에 넣는다"로 읽히게 하고,
        실제로는 버튼이라 눌리는 것이 분명하다. 값이 없을 때는 muted로 안내를 보여준다.
      */}
      <button
        type="button"
        id={triggerId}
        aria-describedby={hint ? `${triggerId}-hint` : undefined}
        aria-haspopup="dialog"
        onClick={() => setSheetOpen(true)}
        className={controlClassName({
          hasError: Boolean(error),
          className: 'flex min-h-[52px] items-center text-left',
        })}
      >
        {isoDate ? (
          <span className="text-ink">{formatBirthDateKorean(isoDate)}</span>
        ) : (
          <span className="text-muted">생년월일을 골라주세요</span>
        )}
      </button>

      {sheetOpen ? (
        <BirthWheelSheet
          initial={wheelInitial}
          initialText={formatBirthDateKorean(isoDate)}
          onClose={() => setSheetOpen(false)}
          onConfirm={commit}
        />
      ) : null}
    </FieldShell>
  )
}

/**
 * 아래에서 올라오는 생년월일 시트.
 *
 * 왜 <dialog>인가: 초점 가두기, Esc로 닫기, 뒤 화면 비활성이 브라우저에 이미 들어 있다.
 * 직접 만들면 그 셋을 다 놓치기 쉽다. (커버 자르기 모달과 같은 방식이다.)
 *
 * 값의 주인은 **숫자 칸의 글자(text)** 하나다. 휠을 굴리면 그 글자를 다시 쓰고,
 * 글자를 치면 휠을 그리로 옮긴다. 주인을 둘로 두면 어느 쪽이 맞는지 알 수 없어진다.
 */
function BirthWheelSheet({
  initial,
  initialText,
  onClose,
  onConfirm,
}: {
  initial: BirthDateParts
  /** 이미 고른 값이 있으면 보이는 그대로("1985년 8월 9일"), 없으면 빈 문자열. */
  initialText: string
  onClose: () => void
  onConfirm: (isoDate: string) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const baseId = useId()

  const [draft, setDraft] = useState<BirthDateParts>(initial)
  const [text, setText] = useState(initialText)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()

    /*
      숫자 칸에 초점을 둔다 — 시트가 뜨자마자 바로 칠 수 있어야 한다는 요구다.
      그냥 두면 브라우저가 첫 번째 초점 가능한 것(숨겨둔 년도 select)을 잡아
      선택 상자가 펼쳐지며 휠을 가린다.
    */
    inputRef.current?.focus()
  }, [])

  const years = useMemo(() => birthYearOptions(), [])
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, index) => index + 1),
    [],
  )

  const lastDay = daysInMonth(draft.year, draft.month)
  const days = useMemo(
    () => Array.from({ length: lastDay }, (_, index) => index + 1),
    [lastDay],
  )

  /**
   * 지금 친 글자를 무엇으로 읽었는지. 못 읽으면 빈 문자열.
   * 칸에 이미 그대로 보이는 값이면 굳이 아래에 한 번 더 적지 않는다.
   */
  const typedIso = parseTypedBirthDate(text)
  const read =
    typedIso && !validateBirthDate(typedIso)
      ? formatBirthDateKorean(typedIso)
      : ''
  const preview = read === text ? '' : read

  /**
   * 숫자 칸이 바뀌었다 → 읽히면 휠도 그 자리로 옮긴다.
   *
   * 칸에 보이는 글자는 언제나 한국어다(`maskTypedBirthDate`). 년·월·일이 다 차면
   * 캡처와 같은 완성형("1985년 8월 9일" — 0을 떼고 `일`까지)으로 한 번 더 다듬는다.
   *
   * **지우는 중일 때는 다듬지 않는다.** 다듬으면 방금 지운 `일`이 곧바로 되붙어
   * 뒤에서부터 고칠 수가 없다. 글자가 줄었으면 지우는 중이다.
   */
  function handleText(raw: string) {
    const deleting = raw.length < text.length
    const masked = maskTypedBirthDate(raw)
    const iso = parseTypedBirthDate(masked)
    const settled = iso ? formatBirthDateKorean(iso) : ''

    setText(!deleting && settled ? settled : masked)
    setErrorMessage(null)

    if (!iso || validateBirthDate(iso)) return

    const parsed = parseIsoDate(iso)
    if (parsed) setDraft(parsed)
  }

  /**
   * 휠이 바뀌었다 → 숫자 칸도 다시 쓴다.
   * 2월 30일 같은 날이 남지 않도록 년·월이 바뀌면 일을 그 달 안으로 끌어들인다.
   */
  function changeWheel(next: Partial<BirthDateParts>) {
    const merged = { ...draft, ...next }
    const settled = {
      ...merged,
      day: Math.min(merged.day, daysInMonth(merged.year, merged.month)),
    }
    setDraft(settled)
    // 칸에 보이는 글자도 캡처와 같은 한국어 완성형으로 쓴다.
    setText(formatBirthDateKorean(toIsoDate(settled)))
    setErrorMessage(null)
  }

  function handleConfirm() {
    // 아무것도 안 친 채 굴리기만 했으면 화면에 보이는 휠 값이 곧 고른 값이다.
    const source = text.trim() ? text : toIsoDate(draft)

    const iso = parseTypedBirthDate(source)
    if (!iso) {
      setErrorMessage(
        '태어난 해 네 자리와 달·날을 적어주세요. 예: 19850809 또는 1985.8.9',
      )
      inputRef.current?.focus()
      return
    }

    const message = validateBirthDate(iso)
    if (message) {
      setErrorMessage(message)
      inputRef.current?.focus()
      return
    }

    onConfirm(iso)
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${baseId}-title`}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-card bg-card p-0 text-ink backdrop:bg-black/45"
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-screen-x pt-5 pb-screen-b">
        <h2
          id={`${baseId}-title`}
          className="text-xl font-extrabold text-ink"
        >
          생년월일
        </h2>

        {/*
          숫자 칸. 휠과 같은 값을 보고, 같은 값을 바꾼다.
          치는 글자는 maskTypedBirthDate를 지나므로 연도 덩이가 네 글자를 넘지 못한다
          — 붙여넣기도 같은 길로 들어온다.
        */}
        <div className="flex flex-col gap-2">
          <label htmlFor={`${baseId}-typed`} className="sr-only">
            생년월일 숫자로 적기
          </label>
          <input
            ref={inputRef}
            id={`${baseId}-typed`}
            type="text"
            inputMode="numeric"
            autoComplete="bday"
            placeholder="예: 19850809"
            aria-describedby={
              [
                // 안내 문구를 없앴으므로(사용자 결정 2026-08-25), 아래 <p>는
                // 읽어준 날짜가 있을 때만 존재한다. 없는 id를 가리키지 않게 맞춘다.
                preview ? `${baseId}-typed-hint` : null,
                errorMessage ? `${baseId}-typed-error` : null,
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
            aria-invalid={errorMessage ? true : undefined}
            value={text}
            onChange={(event) => handleText(event.target.value)}
            className={controlClassName({
              hasError: Boolean(errorMessage),
              className: 'min-h-[52px] tabular-nums',
            })}
          />
          {/*
            안내 문구("숫자로 바로 적어도 되고…")는 뺐다(사용자 결정 2026-08-25).
            placeholder("예: 19850809")가 이미 같은 말을 하고 있어 두 번 말하는 셈이었다.

            **읽어준 날짜는 남긴다.** 8자리를 붙여 치는 칸이라 자릿수를 밀려 적기 쉬운데,
            "이렇게 읽었어요"가 사라지면 틀린 걸 확인할 방법이 없어진다.
          */}
          {preview ? (
            <p
              id={`${baseId}-typed-hint`}
              className="text-base leading-relaxed text-muted"
            >
              이렇게 읽었어요 — {preview}
            </p>
          ) : null}
          {errorMessage ? (
            <p
              id={`${baseId}-typed-error`}
              role="alert"
              className="text-base leading-relaxed text-primary"
            >
              {errorMessage}
            </p>
          ) : null}
        </div>

        {/*
          휠을 굴릴 수 없는 분(키보드·화면 낭독기)을 위한 진짜 통로.
          평소에는 자리를 차지하지 않다가 초점이 오면 펼쳐진다.
        */}
        <div className="flex gap-2">
          <WheelSelect
            id={`${baseId}-year`}
            label="태어난 해"
            options={years}
            value={draft.year}
            onChange={(year) => changeWheel({ year })}
            format={(year) => `${year}년`}
          />
          <WheelSelect
            id={`${baseId}-month`}
            label="태어난 달"
            options={months}
            value={draft.month}
            onChange={(month) => changeWheel({ month })}
            format={(month) => `${month}월`}
          />
          <WheelSelect
            id={`${baseId}-day`}
            label="태어난 날"
            options={days}
            value={draft.day}
            onChange={(day) => changeWheel({ day })}
            format={(day) => `${day}일`}
          />
        </div>

        <WheelGroup>
          <WheelColumn
            options={years}
            value={draft.year}
            onChange={(year) => changeWheel({ year })}
            format={(year) => `${year}년`}
          />
          <WheelColumn
            options={months}
            value={draft.month}
            onChange={(month) => changeWheel({ month })}
            format={(month) => `${month}월`}
          />
          <WheelColumn
            options={days}
            value={draft.day}
            onChange={(day) => changeWheel({ day })}
            format={(day) => `${day}일`}
          />
        </WheelGroup>

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>
            취소
          </Button>
          <Button fullWidth onClick={handleConfirm}>
            완료
          </Button>
        </div>
      </div>
    </dialog>
  )
}
