'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'

import { Button } from '@/components/ui/Button'
import { deleteComment } from '@/lib/actions/comments'

/**
 * 내 댓글의 ⋯ 메뉴 — 지금은 [삭제] 하나뿐이다 (캡처 33).
 *
 * **왜 길게 누르기가 아니라 ⋯ 버튼인가**
 * 원본 프로토타입은 댓글을 길게 눌러 메뉴를 띄웠다. 우리는 버튼으로 바꿨다:
 * - 길게 누르기는 화면 어디에도 흔적이 없어 **있는 줄 모르면 영영 못 쓴다.**
 *   이 앱의 주 사용자는 시니어다.
 * - 키보드·낭독기 사용자에게는 길게 누르기라는 동작 자체가 없다.
 * - 글자를 끌어 복사하려는 손짓과 겹친다.
 * 게시물의 ⋯(MemoryMenu)와 같은 기호를 쓰므로 새로 배울 것도 없다.
 *
 * 남의 댓글에는 이 부품이 아예 그려지지 않는다(부모가 `isMine`으로 가른다).
 * 실제로 막는 것은 RLS(`memory_comments_update`)와 서버 액션이다.
 */
export function CommentMenu({
  commentId,
  /** 낭독기에서 어느 댓글의 메뉴인지 구분되도록. 한 화면에 ⋯가 여럿이다. */
  isVoice,
}: {
  commentId: string
  isVoice: boolean
}) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const menuId = useId()
  const labelId = useId()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const kind = isVoice ? '음성 댓글' : '댓글'

  // 바깥을 누르거나 Esc를 누르면 접는다 (MemoryMenu와 같은 방식).
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

  // 열리면 항목으로 초점을 옮긴다. 키보드만 쓰는 사람이 메뉴에 들어올 길이 이것뿐이다.
  useEffect(() => {
    if (!open) return
    wrapperRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus()
  }, [open])

  // 확인 창은 <dialog>+showModal이라 초점 가두기·뒤 화면 잠금이 브라우저에 이미 들어 있다.
  useEffect(() => {
    if (!confirming) return
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [confirming])

  const closeAll = () => {
    setOpen(false)
    setConfirming(false)
    setError(null)
    // <dialog>가 닫히면서 초점을 한 번 더 옮기므로 다음 그림 순서로 미룬다.
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`내가 남긴 ${kind} 더보기`}
        onClick={() => {
          setError(null)
          setOpen((was) => !was)
        }}
        className="-my-2 -mr-1 inline-flex h-11 w-9 items-center justify-center rounded-full text-muted transition-colors active:bg-surface-soft"
      >
        <MoreIcon />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={`내가 남긴 ${kind} 더보기`}
          // right-0: 오른쪽 끝을 맞춰야 좁은 화면 밖으로 나가지 않는다.
          className="absolute top-10 right-0 z-20 w-32 overflow-hidden rounded-inner border border-hairline bg-card py-1 shadow-card"
        >
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={() => {
              setOpen(false)
              setConfirming(true)
            }}
            className="flex w-full items-center px-4 py-2.5 text-left text-base font-medium text-primary transition-colors active:bg-surface-soft disabled:opacity-60"
          >
            삭제
          </button>
        </div>
      ) : null}

      {confirming ? (
        <dialog
          ref={dialogRef}
          aria-labelledby={labelId}
          onCancel={(event) => {
            event.preventDefault()
            closeAll()
          }}
          className="m-auto w-[min(24rem,calc(100vw-40px))] rounded-card bg-card p-5 text-ink shadow-card backdrop:bg-black/45"
        >
          <h2 id={labelId} className="text-lg font-extrabold text-ink">
            이 {kind}을 삭제할까요?
          </h2>
          {/*
            실제로는 소프트 삭제(deleted_at)라 DB에는 남지만, "사실은 안 지워져요"라고
            말하지 않는다 — 화면에서 영영 사라지고 되돌릴 길이 없는 것은 사실이다.
          */}
          <p className="mt-2 text-base leading-relaxed break-keep text-muted">
            지우면 되돌릴 수 없어요.
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
              onClick={closeAll}
            >
              그만두기
            </Button>
            <Button
              type="button"
              fullWidth
              pending={pending}
              pendingText="삭제하는 중…"
              onClick={() => {
                setError(null)
                startTransition(async () => {
                  const result = await deleteComment(commentId)
                  // 성공하면 서버가 목록을 다시 그려 이 부품 자체가 사라진다.
                  if (result.ok) closeAll()
                  else setError(result.error)
                })
              }}
            >
              삭제하기
            </Button>
          </div>
        </dialog>
      ) : null}
    </div>
  )
}

/** 더보기 ⋯ (게시물의 MemoryMenu와 같은 기호, 크기만 작다). */
function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  )
}
