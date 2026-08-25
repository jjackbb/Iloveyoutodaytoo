'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { controlClassName } from '@/components/ui/Field'
import {
  candidateMatchesQuery,
  type SendCandidate,
  type SendCandidateGroup,
} from '@/lib/heart-send'

/**
 * "추가하기" 전체 화면 시트 (캡처 42·43).
 *
 * 모양: [X] 추가하기 [N 확인] / 고른 사람 줄 / 검색칸 / 구역별 후보 목록
 *
 * 초대 화면의 같은 이름 시트(rooms/[roomId]/invite/recipient-picker.tsx)와
 * **뼈대는 같고 후보가 다르다.** 저쪽은 아직 방에 없는 분을 부르는 일이라
 * 후보가 내 휴대폰 연락처지만, 여기 후보는 이미 내 앨범방에 들어와 있는 분들이다.
 * 그래서 손으로 적어 넣는 칸이 없고, 서버가 준 목록에서 고르기만 한다.
 * (두 화면을 한 부품으로 합치지 않은 이유: 합치면 "연락처를 쓸 수 있나",
 *  "손으로 적을 수 있나" 같은 조건 스위치가 부품 안에 쌓인다. 지금은 각자가 단순하다.)
 *
 * 여기서 고른 것은 **화면이 살아 있는 동안에만** 있다. 닫으면 사라지고,
 * 서버로 넘어가는 것은 확인을 눌렀을 때의 id 목록뿐이다.
 */
export function TargetPicker({
  groups,
  initialSelectedIds,
  onClose,
  onConfirm,
}: {
  groups: SendCandidateGroup[]
  /** 이미 고른 것들. 다시 열었을 때 체크된 채로 보이게 한다. */
  initialSelectedIds: string[]
  onClose: () => void
  onConfirm: (selected: SendCandidate[]) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const baseId = useId()

  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()
  }, [])

  /** id로 후보를 바로 찾기 위한 표. 고른 사람 줄과 확인 버튼이 쓴다. */
  const byId = useMemo(() => {
    const map = new Map<string, SendCandidate>()
    for (const group of groups) {
      for (const item of group.items) map.set(item.id, item)
    }
    return map
  }, [groups])

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => byId.get(id))
        .filter((item): item is SendCandidate => item !== undefined),
    [byId, selectedIds],
  )

  /** 검색어에 걸린 것만 남긴 구역들. 다 걸러진 구역은 머리줄째 뺀다. */
  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          title: group.title,
          items: group.items.filter((item) =>
            candidateMatchesQuery(item, query),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [groups, query],
  )

  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    )
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
        {/* 머리띠 — 캡처 42 그대로 [X] 추가하기 [N 확인] */}
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
            className="min-w-0 flex-1 truncate text-center text-lg font-bold text-ink"
          >
            추가하기
          </h2>

          {/*
            고른 것을 보내기 화면으로 넘긴다. 0명이어도 누를 수 있게 둔다 —
            다 지우고 닫는 것도 사용자가 하려는 일이다.
          */}
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="flex h-11 shrink-0 items-center justify-center rounded-full px-3 text-base font-bold text-primary active:bg-primary-soft"
          >
            {selected.length > 0 ? `${selected.length} 확인` : '확인'}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* 고른 사람 줄 (캡처 43 위쪽). 아직 아무도 없으면 캡처 42처럼 안내 한 줄만 둔다. */}
          {selected.length > 0 ? (
            <ul className="flex gap-4 overflow-x-auto border-b border-hairline bg-card px-screen-x py-3">
              {selected.map((item) => (
                <li key={item.id} className="shrink-0">
                  <SelectedAvatar item={item} onRemove={() => toggle(item.id)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-b border-hairline bg-card px-screen-x py-5 text-base text-muted">
              선택된 대화상대가 없습니다
            </p>
          )}

          <div className="flex flex-col gap-4 px-screen-x py-5">
            <label htmlFor={`${baseId}-search`} className="sr-only">
              받는 사람 검색
            </label>
            <input
              id={`${baseId}-search`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              // 캡처는 "이름(초성), 전화번호 검색"이지만 우리는 번호를 가지고 있지 않다.
              // 없는 수단을 안내하면 아무리 쳐도 안 걸려서 고장으로 읽힌다.
              placeholder="이름(초성) 검색"
              className={controlClassName()}
            />

            {visibleGroups.length > 0 ? (
              visibleGroups.map((group) => (
                <section key={group.title} className="flex flex-col">
                  {/* 구역 머리줄 (캡처 42의 "기본" / 방 이름). */}
                  <h3 className="rounded-t-inner bg-surface-soft px-4 py-2 text-base font-bold text-muted">
                    {group.title}
                  </h3>
                  <ul className="flex flex-col overflow-hidden rounded-b-inner border border-hairline bg-card">
                    {group.items.map((item) => (
                      <CandidateRow
                        key={item.id}
                        item={item}
                        checked={selectedIds.includes(item.id)}
                        onToggle={() => toggle(item.id)}
                      />
                    ))}
                  </ul>
                </section>
              ))
            ) : (
              <p className="text-base leading-relaxed text-muted">
                ‘{query}’와 맞는 분이 없어요.
              </p>
            )}
          </div>
        </div>
      </div>
    </dialog>
  )
}

/** 고른 사람 줄의 동그라미 하나 (캡처 43). */
function SelectedAvatar({
  item,
  onRemove,
}: {
  item: SendCandidate
  onRemove: () => void
}) {
  return (
    <div className="flex w-16 flex-col items-center gap-1">
      <div className="relative">
        <CandidateAvatar item={item} size="sm" />
        {/*
          X는 동그라미 위에 겹치지만 누르는 칸은 44px을 지킨다 —
          보이는 동그라미(24px)보다 훨씬 넓게 잡아 손이 떨려도 눌린다.
        */}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${item.name} 빼기`}
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
        {item.name}
      </span>
    </div>
  )
}

/**
 * 후보 한 줄 (캡처 42).
 *
 * 줄 전체가 누르는 칸이다. 체크 동그라미만 누르게 하면 손이 불편한 분이 자꾸 빗나간다.
 * 상태는 색이 아니라 aria-pressed와 체크 표시로 전한다.
 */
function CandidateRow({
  item,
  checked,
  onToggle,
}: {
  item: SendCandidate
  checked: boolean
  onToggle: () => void
}) {
  return (
    <li className="border-b border-hairline last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={checked}
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-soft"
      >
        <CandidateAvatar item={item} size="xs" />

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-lg font-bold text-ink">{item.name}</span>
          <span className="truncate text-base text-muted">{item.description}</span>
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

/**
 * 후보 동그라미.
 *
 * "랜덤"은 사람도 방도 아니라 사진이 있을 수 없다 — 캡처 42처럼 물음표를 그린다.
 * 나머지는 공용 AvatarCircle이 사진(없으면 하트나 방 커버)을 맡는다.
 */
export function CandidateAvatar({
  item,
  size,
}: {
  item: SendCandidate
  size: 'xs' | 'sm'
}) {
  if (item.kind === 'random') {
    return (
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white ${
          size === 'sm' ? 'h-14 w-14 text-2xl' : 'h-11 w-11 text-xl'
        }`}
      >
        ?
      </span>
    )
  }

  return (
    <AvatarCircle
      url={item.avatarUrl}
      name={item.name}
      size={size}
      fallbackGradient={item.coverGradient}
      alt={item.kind === 'room' ? `${item.name} 커버 사진` : undefined}
    />
  )
}
