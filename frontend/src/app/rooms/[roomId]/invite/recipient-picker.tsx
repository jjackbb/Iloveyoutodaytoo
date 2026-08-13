'use client'

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import { Button } from '@/components/ui/Button'
import { controlClassName } from '@/components/ui/Field'
import {
  MAX_NAME_LENGTH,
  MAX_RECIPIENTS,
  formatPhone,
  isSameRecipient,
  makeRecipientId,
  matchesQuery,
  normalizePhone,
  pickFromContacts,
  supportsContactPicker,
  type Recipient,
} from './recipients'

/**
 * "추가하기" 전체 화면 (캡처 초대하기2).
 *
 * 모양: [X] 추가하기 [N 확인] / 고른 사람 줄 / 검색칸 / 후보 목록
 *
 * 캡처와 **내용이 다르다.** 캡처는 마음 보내기용이라 이미 방에 있는 구성원을 줄 세우지만,
 * 초대는 아직 방에 없는 사람을 부르는 일이다. 그래서 후보는 방 구성원이 아니라
 * **내 연락처(또는 내가 손으로 적은 사람)** 다.
 *
 * 후보를 얻는 길이 둘이다:
 *  1. 휴대폰 연락처 — Contact Picker API. 지금은 안드로이드 크롬 계열에서만 된다.
 *  2. 손으로 적기 — 그 밖의 모든 브라우저(iOS 사파리, 데스크톱)의 **유일한** 길이다.
 *     그래서 미지원 기기에서는 이 폼이 목록보다 위에 온다.
 *
 * 여기서 다루는 이름·전화번호는 **화면이 살아 있는 동안에만** 있다.
 * 저장하지 않고, 서버로 보내지도 않는다.
 */
export function RecipientPicker({
  initial,
  onClose,
  onConfirm,
}: {
  /** 이미 고른 사람들. 다시 열었을 때 체크된 채로 보이게 한다. */
  initial: Recipient[]
  onClose: () => void
  onConfirm: (recipients: Recipient[]) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const manualNameRef = useRef<HTMLInputElement>(null)
  const baseId = useId()

  /**
   * 연락처를 쓸 수 있는 기기인지.
   *
   * 서버에는 navigator가 없다. 처음 그릴 때 판단하면 서버와 브라우저의 화면이 어긋난다.
   * 그래서 서버 몫은 무조건 false로 두고, 브라우저에서 다시 그릴 때 실제 값으로 맞춘다.
   * (InvitePanel의 useCanShare와 같은 방식이다.)
   */
  const canUseContacts = useSyncExternalStore(
    () => () => {},
    () => supportsContactPicker(),
    () => false,
  )

  /** 목록에 쌓인 후보들. 연락처에서 가져온 사람 + 손으로 적은 사람. */
  const [candidates, setCandidates] = useState<Recipient[]>(initial)
  const [checkedIds, setCheckedIds] = useState<string[]>(() =>
    initial.map((item) => item.id),
  )

  const [query, setQuery] = useState('')

  const [manualName, setManualName] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)

  /** 연락처 창에서 생긴 문제(권한 거부 등)를 사람 말로 적어둔다. */
  const [contactsError, setContactsError] = useState<string | null>(null)

  /** 방금 무슨 일이 있었는지 낭독기에 알린다. */
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()
  }, [])

  const checked = useMemo(
    () => candidates.filter((item) => checkedIds.includes(item.id)),
    [candidates, checkedIds],
  )

  const visible = useMemo(
    () => candidates.filter((item) => matchesQuery(item, query)),
    [candidates, query],
  )

  const full = checked.length >= MAX_RECIPIENTS

  /*
    아래 두 함수는 상태 갱신 함수(prev => next) 안에서 값을 세거나 다른 상태를 건드리지
    않는다. 갱신 함수는 개발 모드에서 일부러 두 번 불릴 수 있어서, 그 안에 계산을 넣으면
    "2명 더했어요"가 4명으로 세지고 후보가 두 번 들어간다.
    지금 상태를 읽어 다음 상태를 통째로 만들어 넘긴다.
  */

  function toggle(recipient: Recipient) {
    if (checkedIds.includes(recipient.id)) {
      setCheckedIds(checkedIds.filter((id) => id !== recipient.id))
      return
    }
    if (checkedIds.length >= MAX_RECIPIENTS) {
      setNotice(`한 번에 ${MAX_RECIPIENTS}분까지 고를 수 있어요.`)
      return
    }
    setCheckedIds([...checkedIds, recipient.id])
  }

  /**
   * 후보를 목록에 넣는다. 이미 있는 사람이면 넣지 않고 그 사람을 체크만 한다.
   * 같은 번호를 두 번 넣으면 같은 분에게 초대장이 두 장 간다.
   */
  function addCandidates(incoming: Recipient[]): { added: number; skipped: number } {
    const nextCandidates = [...candidates]
    const nextChecked = [...checkedIds]
    let added = 0
    let skipped = 0

    for (const person of incoming) {
      const existing = nextCandidates.find((item) => isSameRecipient(item, person))

      if (existing) {
        skipped += 1
      } else {
        added += 1
        nextCandidates.push(person)
      }

      const id = existing?.id ?? person.id
      if (!nextChecked.includes(id) && nextChecked.length < MAX_RECIPIENTS) {
        nextChecked.push(id)
      }
    }

    setCandidates(nextCandidates)
    setCheckedIds(nextChecked)

    return { added, skipped }
  }

  async function handlePickContacts() {
    setContactsError(null)
    try {
      const picked = await pickFromContacts()
      if (picked.length === 0) {
        setNotice('고른 연락처가 없어요.')
        return
      }
      const { added, skipped } = addCandidates(picked)
      setNotice(
        skipped > 0
          ? `연락처에서 ${added}명을 더했어요. ${skipped}명은 이미 목록에 있어요.`
          : `연락처에서 ${added}명을 더했어요.`,
      )
    } catch {
      // 권한을 막았거나 브라우저가 창을 열지 못한 경우. 손으로 적는 길이 남아 있다.
      setContactsError(
        '연락처를 열지 못했어요. 아래에 이름과 전화번호를 직접 적어주세요.',
      )
    }
  }

  function handleManualAdd() {
    const name = manualName.trim()
    const phone = normalizePhone(manualPhone)

    if (!name) {
      setManualError('이름을 적어주세요. 초대장에 이 이름으로 적혀요.')
      manualNameRef.current?.focus()
      return
    }
    if (name.length > MAX_NAME_LENGTH) {
      setManualError(`이름은 ${MAX_NAME_LENGTH}자까지 쓸 수 있어요.`)
      return
    }
    // 번호는 비워도 된다(카카오톡으로 직접 보내는 경우). 다만 **적었는데 못 읽는** 것은
    // 그냥 넘기지 않는다 — 반쪽짜리 번호로 문자 앱을 열면 엉뚱한 곳으로 갈 수 있다.
    if (manualPhone.trim() && !phone) {
      setManualError('전화번호를 다시 확인해 주세요. 예) 010-1234-5678')
      return
    }
    if (full) {
      setManualError(`한 번에 ${MAX_RECIPIENTS}분까지 고를 수 있어요.`)
      return
    }

    const { skipped } = addCandidates([{ id: makeRecipientId(), name, phone }])

    setManualName('')
    setManualPhone('')
    setManualError(null)
    setNotice(
      skipped > 0 ? `${name}님은 이미 목록에 있어요.` : `${name}님을 더했어요.`,
    )
    manualNameRef.current?.focus()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${baseId}-title`}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="fixed inset-0 m-0 h-full max-h-full w-full max-w-full bg-canvas p-0 text-ink backdrop:bg-black/45"
    >
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        {/* 머리띠 — 캡처 그대로 [X] 추가하기 [N 확인] */}
        <header className="flex shrink-0 items-center gap-1 border-b border-hairline bg-card px-2 py-1.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="추가하기 닫기"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-surface-soft"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          <h2
            id={`${baseId}-title`}
            className="min-w-0 flex-1 truncate text-center text-lg font-extrabold text-ink"
          >
            추가하기
          </h2>

          {/*
            고른 사람을 초대 화면으로 넘긴다. 0명이어도 누를 수 있게 둔다 —
            다 지우고 닫는 것도 사용자가 하려는 일이다.
          */}
          <button
            type="button"
            onClick={() => onConfirm(checked)}
            className="flex h-11 shrink-0 items-center justify-center rounded-full px-3 text-base font-extrabold text-primary active:bg-primary-soft"
          >
            {checked.length > 0 ? `${checked.length} 확인` : '확인'}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* 고른 사람 줄 (캡처 위쪽 아바타 줄). 아무도 없으면 자리를 차지하지 않는다. */}
          {checked.length > 0 ? (
            <ul className="flex gap-4 overflow-x-auto border-b border-hairline bg-card px-screen-x py-3">
              {checked.map((person) => (
                <li key={person.id} className="shrink-0">
                  <SelectedAvatar person={person} onRemove={() => toggle(person)} />
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-col gap-5 px-screen-x py-5">
            <div aria-live="polite" className={notice ? 'text-base text-ink' : 'sr-only'}>
              {notice}
            </div>

            {/*
              연락처를 쓸 수 있는 기기에서만 이 버튼이 보인다.
              미지원 기기에는 아예 그리지 않는다 — 눌러도 아무 일이 없으면 고장으로 읽힌다.
            */}
            {canUseContacts ? (
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={handlePickContacts}
                >
                  휴대폰 연락처에서 고르기
                </Button>
                <p className="text-base leading-relaxed text-muted">
                  고른 연락처는 이 화면에서만 쓰고 저장하지 않아요.
                </p>
                {contactsError ? (
                  <p role="alert" className="text-base leading-relaxed text-primary">
                    {contactsError}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/*
              손으로 적는 길. 연락처를 못 쓰는 기기(iOS 사파리·데스크톱)에서는 이것이
              **유일한** 길이라 목록보다 위에 둔다.
            */}
            <div className="flex flex-col gap-3 rounded-inner border border-hairline bg-card p-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-medium text-ink">
                  {canUseContacts ? '직접 적어서 더하기' : '받는 분을 적어주세요'}
                </h3>
                <p className="text-base leading-relaxed text-muted">
                  전화번호는 비워두셔도 돼요. 카카오톡으로 직접 보내실 거면 이름만
                  적으시면 됩니다.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor={`${baseId}-name`} className="text-base font-medium text-ink">
                  이름
                </label>
                <input
                  ref={manualNameRef}
                  id={`${baseId}-name`}
                  type="text"
                  value={manualName}
                  onChange={(event) => {
                    setManualName(event.target.value)
                    setManualError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleManualAdd()
                    }
                  }}
                  maxLength={MAX_NAME_LENGTH}
                  autoComplete="off"
                  placeholder="예) 엄마, 지훈이"
                  className={controlClassName({ hasError: Boolean(manualError) })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor={`${baseId}-phone`} className="text-base font-medium text-ink">
                  전화번호 <span className="text-muted">(선택)</span>
                </label>
                <input
                  id={`${baseId}-phone`}
                  type="tel"
                  inputMode="tel"
                  value={manualPhone}
                  onChange={(event) => {
                    setManualPhone(event.target.value)
                    setManualError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleManualAdd()
                    }
                  }}
                  autoComplete="off"
                  placeholder="010-1234-5678"
                  className={controlClassName()}
                />
              </div>

              {manualError ? (
                <p role="alert" className="text-base leading-relaxed text-primary">
                  {manualError}
                </p>
              ) : null}

              <Button size="md" fullWidth onClick={handleManualAdd} disabled={full}>
                {full ? `${MAX_RECIPIENTS}분까지 고를 수 있어요` : '추가'}
              </Button>
            </div>

            {/* 후보가 쌓이기 전에는 검색칸도 목록도 그리지 않는다(빈 칸으로 화면을 늘리지 않는다). */}
            {candidates.length > 0 ? (
              <div className="flex flex-col gap-3">
                <label htmlFor={`${baseId}-search`} className="sr-only">
                  받는 사람 검색
                </label>
                <input
                  id={`${baseId}-search`}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="이름(초성), 전화번호 검색"
                  className={controlClassName()}
                />

                {visible.length > 0 ? (
                  <ul className="flex flex-col overflow-hidden rounded-inner border border-hairline bg-card">
                    {visible.map((person) => (
                      <CandidateRow
                        key={person.id}
                        person={person}
                        checked={checkedIds.includes(person.id)}
                        onToggle={() => toggle(person)}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="text-base leading-relaxed text-muted">
                    ‘{query}’와 맞는 분이 없어요.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </dialog>
  )
}

/** 이름 첫 글자를 담은 동그란 아바타. 사진이 없는 사람을 알아보게 하는 최소한의 표식. */
function Avatar({ name, size }: { name: string; size: 'sm' | 'md' }) {
  const box = size === 'md' ? 'h-14 w-14 text-xl' : 'h-11 w-11 text-lg'
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-extrabold text-primary ${box}`}
    >
      {[...name][0] ?? '?'}
    </span>
  )
}

function SelectedAvatar({
  person,
  onRemove,
}: {
  person: Recipient
  onRemove: () => void
}) {
  return (
    <div className="flex w-16 flex-col items-center gap-1">
      <div className="relative">
        <Avatar name={person.name} size="md" />
        {/*
          X는 아바타 위에 겹치지만 누르는 칸은 44px을 지킨다 —
          보이는 동그라미(22px)보다 훨씬 넓게 잡아 손이 떨려도 눌린다.
        */}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${person.name} 빼기`}
          className="absolute -top-3 -right-3 flex h-11 w-11 items-center justify-center rounded-full text-ink"
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
  )
}

function CandidateRow({
  person,
  checked,
  onToggle,
}: {
  person: Recipient
  checked: boolean
  onToggle: () => void
}) {
  return (
    <li className="border-b border-hairline last:border-b-0">
      {/*
        줄 전체가 누르는 칸이다. 체크 동그라미만 누르게 하면 손이 불편한 분이 자꾸 빗나간다.
        상태는 색이 아니라 aria-pressed와 체크 표시로 전한다.
      */}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={checked}
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-soft"
      >
        <Avatar name={person.name} size="sm" />

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-lg font-medium text-ink">{person.name}</span>
          <span className="truncate text-base text-muted">
            {person.phone ? formatPhone(person.phone) : '전화번호 없음 · 링크로 보내요'}
          </span>
        </span>

        <span
          aria-hidden
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
            checked
              ? 'border-primary bg-primary text-white'
              : 'border-hairline-strong bg-card text-transparent'
          }`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
      </button>
    </li>
  )
}
