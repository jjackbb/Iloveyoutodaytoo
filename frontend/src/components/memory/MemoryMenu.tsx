'use client'

import Link from 'next/link'

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

import { Button } from '@/components/ui/Button'
import {
  deleteMemory,
  hideMemory,
  setMemoryPin,
  toggleMemorySave,
  updateMemoryCaption,
  type MemoryActionResult,
} from '@/lib/actions/memories'
import { CAPTION_MAX_LENGTH } from '@/lib/limits'

/**
 * 게시물 오른쪽 위 ⋯ 메뉴 (캡처 22·23).
 *
 * 항목: 고정 / 수정 / 숨기기 / 저장 / 삭제.
 * **수정·삭제는 내가 남긴 글에만 보인다.** 남의 글에서는 아예 그리지 않는다 —
 * 회색으로 눌리지 않게 두면 "왜 안 되지" 하고 계속 누르게 된다.
 * 고정·숨기기·저장은 모두에게 보인다(각각 공용 큐레이션·개인 표시라서).
 *
 * 상태를 여기서 들고 있지 않는다. 서버 액션이 DB를 바꾸고 revalidatePath로 피드를
 * 다시 그리면 고정 자리·저장 여부가 서버가 센 그대로 내려온다.
 *
 * 왜 팝오버는 <dialog>가 아닌가: 이 메뉴는 화면을 잠그는 것이 아니라 카드에 붙어 있는
 * 작은 목록이다. Esc·바깥 누르기·화살표 이동은 아래에서 직접 다룬다.
 * 대신 **수정·삭제 창은 <dialog>**다 — 그건 확실히 끝내고 나가야 하는 일이라
 * 초점 가두기와 뒤 화면 잠금이 필요하다.
 */
export function MemoryMenu({
  roomId,
  memoryId,
  authorName,
  caption,
  isMine,
  isPinned,
  isSaved,
}: {
  /** 고치기 화면 주소를 만들려고 받는다. */
  roomId: string
  memoryId: string
  /** 낭독기에서 어느 게시물의 메뉴인지 알리기 위해. 피드에 ⋯가 여럿이다. */
  authorName: string
  /** 수정 창의 첫 값. 서버가 준 지금 문구다. */
  caption: string | null
  /** 내가 남긴 글인가 (author_id === 지금 로그인한 사람). */
  isMine: boolean
  isPinned: boolean
  isSaved: boolean
}) {
  const [open, setOpen] = useState(false)
  /** 지금 떠 있는 창. 메뉴에서 고른 뒤에만 바뀐다. */
  const [dialog, setDialog] = useState<'none' | 'edit' | 'delete'>('none')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const menuId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  /*
    바깥을 누르거나 Esc를 누르면 닫는다.
    창(<dialog>)은 이 감싸개 **안에** 그려지므로 창 안을 누르는 것은 "바깥"이 아니다.
  */
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // 열리면 첫 항목으로 초점을 옮긴다. 키보드만 쓰는 사람이 메뉴에 들어올 길이 이것뿐이다.
  useEffect(() => {
    if (!open) return
    const first = listRef.current?.querySelector<HTMLButtonElement>(
      '[role="menuitem"]',
    )
    first?.focus()
  }, [open])

  /** ↑↓·Home·End로 항목 사이를 옮긴다(메뉴의 관례). */
  const onListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]',
      ) ?? [],
    )
    if (items.length === 0) return

    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    let next = -1

    if (event.key === 'ArrowDown') next = (index + 1) % items.length
    else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else return

    event.preventDefault()
    items[next]?.focus()
  }

  /**
   * 메뉴와 창을 함께 접는다.
   *
   * 초점을 ⋯ 버튼으로 되돌린다 — 안 그러면 목록이 사라지면서 초점이 문서 맨 위로 튀어
   * 키보드 사용자가 읽던 자리를 잃는다. 다음 그림 순서로 미루는 이유는 <dialog>가
   * 닫히면서 초점을 한 번 더 옮기기 때문이다. (지워진 카드에서는 버튼이 이미 없어 아무 일도 안 한다)
   */
  const closeAll = () => {
    setOpen(false)
    setDialog('none')
    setError(null)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  /** 메뉴에서 고른 동작 하나를 돌린다. 성공하면 메뉴를 닫고, 실패하면 이유를 남긴다. */
  const run = (action: () => Promise<MemoryActionResult>) => {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.ok) closeAll()
      else setError(result.error)
    })
  }

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors active:bg-surface-soft"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${authorName}님의 추억 더보기`}
        onClick={() => {
          setError(null)
          setOpen((was) => !was)
        }}
      >
        <MoreIcon />
      </button>

      {open ? (
        <div
          id={menuId}
          ref={listRef}
          role="menu"
          aria-label={`${authorName}님의 추억 더보기`}
          onKeyDown={onListKeyDown}
          /*
            카드 오른쪽 위에 매달린다. right-0으로 오른쪽 끝을 맞춰야 화면 밖으로 나가지 않는다.
            z-20: 아래 사진 그리드가 아니라 이 목록이 위에 있어야 한다.
          */
          className="absolute top-11 right-0 z-20 w-44 overflow-hidden rounded-inner border border-hairline bg-card py-1 shadow-card"
        >
          <MenuItem
            disabled={pending}
            onClick={() => run(() => setMemoryPin(memoryId, !isPinned))}
          >
            {isPinned ? '고정 해제' : '고정'}
          </MenuItem>

          {isMine ? (
            <MenuItem
              disabled={pending}
              onClick={() => {
                // 창을 띄우면서 목록은 접는다. 창 뒤에 목록이 남아 있을 이유가 없다.
                setError(null)
                setOpen(false)
                setDialog('edit')
              }}
            >
              문구 고치기
            </MenuItem>
          ) : null}

          {/*
            사진·목소리까지 고치기 (노션 IA 3.8) — 작성 화면을 그대로 다시 연다.
            문구만 고치는 길을 남겨둔 이유: 오탈자 하나 고치자고 화면을 옮겨 갔다
            돌아오게 하면 그게 더 번거롭다. 짧은 일은 그 자리에서 끝내야 한다.
          */}
          {isMine ? (
            <MenuLink href={`/rooms/${roomId}/memories/${memoryId}/edit`}>
              사진·목소리 고치기
            </MenuLink>
          ) : null}

          <MenuItem disabled={pending} onClick={() => run(() => hideMemory(memoryId))}>
            숨기기
          </MenuItem>

          <MenuItem
            disabled={pending}
            onClick={() => run(() => toggleMemorySave(memoryId))}
          >
            {isSaved ? '저장 취소' : '저장'}
          </MenuItem>

          {isMine ? (
            <MenuItem
              disabled={pending}
              tone="danger"
              onClick={() => {
                setError(null)
                setOpen(false)
                setDialog('delete')
              }}
            >
              삭제
            </MenuItem>
          ) : null}

          {/* 실패했을 때만 글이 들어간다. 메뉴는 닫지 않는다 — 다시 눌러볼 수 있어야 한다. */}
          {error && dialog === 'none' ? (
            <p role="alert" className="px-4 py-2 text-sm leading-relaxed text-primary">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {dialog === 'edit' ? (
        <EditCaptionDialog
          initialCaption={caption ?? ''}
          pending={pending}
          error={error}
          onCancel={closeAll}
          onSubmit={(next) => run(() => updateMemoryCaption(memoryId, next))}
        />
      ) : null}

      {dialog === 'delete' ? (
        <ConfirmDeleteDialog
          authorName={authorName}
          pending={pending}
          error={error}
          onCancel={closeAll}
          onConfirm={() => run(() => deleteMemory(memoryId))}
        />
      ) : null}
    </div>
  )
}

/** 메뉴 한 줄. 글자 17px·높이 44px는 이 앱의 최소값이다. */
/**
 * 다른 화면으로 가는 메뉴 항목. 버튼이 아니라 링크여야 하는 이유 —
 * 화면을 옮기는 일은 브라우저가 하는 일이다(새 탭으로 열기·뒤로가기가 그대로 된다).
 */
function MenuLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex w-full items-center px-4 py-2.5 text-left text-base font-medium text-ink transition-colors active:bg-surface-soft"
    >
      {children}
    </Link>
  )
}

function MenuItem({
  children,
  onClick,
  disabled,
  tone = 'normal',
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'normal' | 'danger'
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center px-4 py-2.5 text-left text-base font-medium transition-colors active:bg-surface-soft disabled:opacity-60 ${
        tone === 'danger' ? 'text-primary' : 'text-ink'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * 문구 고치기 창.
 *
 * **문구만** 고친다. 사진·음성은 여기서 손대지 않는다 — 그건 "고치기"가 아니라
 * 처음부터 다시 담는 일이라 작성 화면의 몫이다.
 */
function EditCaptionDialog({
  initialCaption,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  initialCaption: string
  pending: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (caption: string) => void
}) {
  const [value, setValue] = useState(initialCaption)
  const labelId = useId()

  return (
    <Dialog labelledBy={labelId} onCancel={onCancel}>
      <h2 id={labelId} className="text-lg font-extrabold text-ink">
        문구 고치기
      </h2>

      <label htmlFor={`${labelId}-input`} className="sr-only">
        추억에 남길 문구
      </label>
      <textarea
        id={`${labelId}-input`}
        value={value}
        maxLength={CAPTION_MAX_LENGTH}
        rows={4}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
        className="mt-3 w-full resize-none rounded-inner border border-hairline-strong bg-card px-3.5 py-3 text-base leading-relaxed text-ink placeholder:text-muted"
        placeholder="이 순간에 남기고 싶은 말"
      />
      <p className="mt-1.5 text-right text-sm tabular-nums text-muted">
        {value.length}/{CAPTION_MAX_LENGTH}
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-sm leading-relaxed text-primary">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          disabled={pending}
          onClick={onCancel}
        >
          그만두기
        </Button>
        <Button
          type="button"
          fullWidth
          pending={pending}
          pendingText="저장하는 중…"
          onClick={() => onSubmit(value)}
        >
          저장하기
        </Button>
      </div>
    </Dialog>
  )
}

/**
 * 삭제 확인 창.
 *
 * 실제로는 소프트 삭제(`deleted_at`)라 DB에는 남지만, 사용자에게 "사실은 안 지워져요"라고
 * 말하지 않는다 — **화면에서 영영 사라지고 되돌릴 길이 없는 것은 사실**이기 때문이다.
 */
function ConfirmDeleteDialog({
  authorName,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  authorName: string
  pending: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const labelId = useId()

  return (
    <Dialog labelledBy={labelId} onCancel={onCancel}>
      <h2 id={labelId} className="text-lg font-extrabold text-ink">
        이 추억을 삭제할까요?
      </h2>
      <p className="mt-2 text-base leading-relaxed break-keep text-muted">
        {authorName}님이 남긴 사진·목소리·문구가 앨범방에서 사라져요. 되돌릴 수
        없어요.
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-sm leading-relaxed text-primary">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          disabled={pending}
          onClick={onCancel}
        >
          그만두기
        </Button>
        {/* 되돌릴 수 없는 확정 동작이라 크기는 lg(기본값)를 그대로 쓴다. */}
        <Button
          type="button"
          fullWidth
          pending={pending}
          pendingText="삭제하는 중…"
          onClick={onConfirm}
        >
          삭제하기
        </Button>
      </div>
    </Dialog>
  )
}

/**
 * 작은 확인 창의 껍데기.
 *
 * <dialog>+showModal이라 초점 가두기·Esc로 닫기·뒤 화면 잠금이 브라우저에 이미 들어 있다.
 * 직접 만들면 그 셋을 다 놓치기 쉽다(cover-crop-dialog와 같은 판단).
 */
function Dialog({
  labelledBy,
  onCancel,
  children,
}: {
  labelledBy: string
  onCancel: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      // Esc는 브라우저가 닫아주지만, 부모의 상태도 함께 접어야 다시 열 수 있다.
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      className="m-auto w-[min(24rem,calc(100vw-40px))] rounded-card bg-card p-5 text-ink shadow-card backdrop:bg-black/45"
    >
      {children}
    </dialog>
  )
}

/** 더보기 ⋯ (캡처 22 카드 오른쪽 위). */
function MoreIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  )
}
