'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { MemberStack } from '@/components/room/MemberStack'
import { ROOM_APP_BAR_ACTION_CLASS } from '@/components/room/RoomAppBar'

/**
 * 앨범방 머리띠의 더보기(≡) + 오른쪽에서 밀려 들어오는 사이드 메뉴 (캡처 `참고/앨범방_더보기.png`).
 *
 * 안에 드는 것: **함께하는 분(+초대)** / 갤러리(+최근 사진 미리보기) / 좋아요 / 별명 설정 /
 * 숨김 / 앨범방 나가기.
 *
 * 맨 위의 참여자 줄은 카카오톡 채팅방 서랍과 같은 자리다(_workspace/12_ux_baseline.md).
 * 그전에는 "방에 누가 있나"를 보려면 방 설정까지 들어가야 했는데, 그건 서랍에서
 * 가장 자주 보게 되는 정보다.
 * 하나같이 **다른 화면으로 가는 링크**다. 여기서 무언가를 저장하지 않는다 —
 * 그래서 이 부품이 들고 있는 상태는 "열렸나" 하나뿐이고, 화면을 떠나면 같이 사라진다.
 *
 * 왜 <dialog>인가: 초점 가두기·Esc로 닫기·뒤 화면 잠금이 브라우저에 이미 들어 있다.
 * 직접 만들면 그 셋을 다 놓치기 쉽다(MemoryMenu의 확인 창, cover-crop-dialog와 같은 판단).
 * 창은 화면 전체를 덮고(왼쪽은 어두운 막), 그 안에서 흰 판이 오른쪽에 붙는다 —
 * 어두운 쪽을 누르면 닫힌다.
 */
export function MoreDrawer({
  roomId,
  roomName,
  previewPhotos,
  memberNames,
}: {
  roomId: string
  roomName: string
  /** 가장 최근 게시물 3개의 대표 사진(서명된 주소). 없으면 "사진이 아직 없어요"가 뜬다. */
  previewPhotos: string[]
  /** 이 방의 활성 구성원 이름들. 서랍 맨 위 아바타 줄에 쓴다. */
  memberNames: string[]
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  /**
   * 닫으면서 초점을 ≡ 버튼으로 되돌린다.
   * 안 그러면 창이 사라지면서 초점이 문서 맨 위로 튀어 키보드 사용자가 읽던 자리를 잃는다.
   */
  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${roomName} 더보기`}
        onClick={() => setOpen(true)}
        // 옆의 [멤버 추가]와 같은 자리·같은 크기다(RoomAppBar가 정한 값을 그대로 쓴다).
        className={ROOM_APP_BAR_ACTION_CLASS}
      >
        <MenuIcon />
      </button>

      {open ? (
        <DrawerDialog
          roomId={roomId}
          previewPhotos={previewPhotos}
          memberNames={memberNames}
          onClose={close}
        />
      ) : null}
    </>
  )
}

function DrawerDialog({
  roomId,
  previewPhotos,
  memberNames,
  onClose,
}: {
  roomId: string
  previewPhotos: string[]
  memberNames: string[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  /*
    들어올 때 오른쪽에서 민다. 처음 그림에서는 화면 밖(translate-x-full)에 두고,
    붙은 다음 프레임에 제자리로 보낸다 — 한 번에 그리면 전환이 일어날 틈이 없다.
    움직임을 줄여 달라고 한 분에게는 그냥 제자리에 나타난다(motion-reduce).
  */
  const [slidIn, setSlidIn] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    const frame = requestAnimationFrame(() => setSlidIn(true))
    return () => {
      cancelAnimationFrame(frame)
      dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Esc는 브라우저가 닫아주지만, 부모의 상태도 함께 접어야 다시 열 수 있다.
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      /*
        창 자체가 화면 전체다. 어두운 막(backdrop) 위에 흰 판이 오른쪽에 붙는다.
        창을 직접 누르는 것 = 판 바깥(어두운 쪽)을 누르는 것이라 그때 닫는다.
      */
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      /*
        `fixed inset-0`을 직접 적는다. 브라우저 기본값은 창을 세로로만 붙여두고
        가로는 **놓인 자리(static position)** 를 쓰는데, 이 부품은 머리띠 오른쪽 끝에 있어서
        그대로 두면 창이 화면 밖에서 시작한다. 여백(m-0)과 상한(max-*-none)도 함께 푼다.
      */
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/45"
    >
      <div
        className={`ml-auto flex h-full w-[78%] max-w-[340px] flex-col bg-card shadow-card transition-transform duration-200 ease-out motion-reduce:transition-none ${
          slidIn ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
          <h2 id={titleId} className="text-xl font-bold tracking-[-0.02em] text-ink">
            더보기
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="더보기 닫기"
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-surface-soft"
          >
            <CloseIcon />
          </button>
        </div>

        {/*
          함께하는 분 (카톡 서랍 맨 위와 같은 자리).
          줄 전체가 구성원 목록으로 가고, 오른쪽 [초대]만 따로 초대 화면으로 간다 —
          링크 안에 링크를 넣을 수 없어 나란히 둔다.
        */}
        <div className="flex items-center gap-2 border-b border-hairline px-5 pb-3">
          <Link
            href={`/rooms/${roomId}/settings`}
            onClick={onClose}
            className="flex min-h-11 flex-1 items-center gap-3 rounded-inner active:bg-surface-soft"
          >
            <MemberStack names={memberNames} />
            <span className="text-base font-medium text-ink">
              함께하는 분 {memberNames.length}명
            </span>
          </Link>

          <Link
            href={`/rooms/${roomId}/invite`}
            onClick={onClose}
            className="flex min-h-11 shrink-0 items-center rounded-chip border border-primary px-3 text-base font-bold text-primary active:bg-primary-soft"
          >
            초대
          </Link>
        </div>

        {/* 스크롤은 이 안에서만. 항목이 늘어도 머리줄은 늘 보인다. */}
        <nav aria-label="앨범방 더보기" className="min-h-0 flex-1 overflow-y-auto pb-6">
          <ul className="flex list-none flex-col">
            <li>
              <DrawerLink
                href={`/rooms/${roomId}/gallery`}
                onNavigate={onClose}
                trailing={<ChevronIcon />}
              >
                갤러리
              </DrawerLink>

              {/*
                갤러리 미리보기 — 가장 최근 게시물 3개의 대표 사진.
                이 자리는 누르는 곳이 아니다. 위의 "갤러리"가 전체 사진으로 가는 문이라
                같은 곳으로 가는 문을 두 개 두지 않는다(낭독기에도 같은 링크가 두 번 읽힌다).
              */}
              <div className="px-5 pb-4">
                {previewPhotos.length === 0 ? (
                  <p className="text-base text-muted">사진이 아직 없어요</p>
                ) : (
                  <div className="flex gap-2">
                    {previewPhotos.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={url}
                        alt=""
                        aria-hidden
                        className="h-16 w-16 rounded-inner-sm bg-surface-soft object-cover"
                      />
                    ))}
                  </div>
                )}
              </div>
            </li>

            <li className="border-t border-hairline">
              <DrawerLink href={`/rooms/${roomId}/liked`} onNavigate={onClose}>
                좋아요
              </DrawerLink>
            </li>

            <li className="border-t border-hairline">
              <DrawerLink href={`/rooms/${roomId}/nickname`} onNavigate={onClose}>
                별명 설정
              </DrawerLink>
            </li>

            <li className="border-t border-hairline">
              <DrawerLink href={`/rooms/${roomId}/hidden`} onNavigate={onClose}>
                숨김
              </DrawerLink>
            </li>

            {/*
              나가기는 새로 만들지 않는다. 방 설정 화면의 [이 방 나가기] 칸으로 그대로 간다 —
              나가면 무슨 일이 생기는지 설명하는 글이 거기 이미 있다(#leave로 그 자리에 바로 닿는다).
            */}
            <li className="border-t border-hairline">
              <DrawerLink
                href={`/rooms/${roomId}/settings#leave`}
                onNavigate={onClose}
                tone="danger"
                leading={<LeaveIcon />}
              >
                앨범방 나가기
              </DrawerLink>
            </li>
          </ul>
        </nav>
      </div>
    </dialog>
  )
}

/** 메뉴 한 줄. 글자 17px·높이 52px — 이 앱의 최소 터치 목표(44px)보다 넉넉하게 잡는다. */
function DrawerLink({
  href,
  onNavigate,
  children,
  leading,
  trailing,
  tone = 'normal',
}: {
  href: string
  /** 눌러서 화면을 옮길 때 창을 함께 접는다. */
  onNavigate: () => void
  children: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  tone?: 'normal' | 'danger'
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex min-h-[52px] items-center gap-2 px-5 py-3 text-base font-bold active:bg-surface-soft ${
        tone === 'danger' ? 'text-primary' : 'text-ink'
      }`}
    >
      {leading}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </Link>
  )
}

/** 머리띠의 더보기 ≡ (캡처 `참고/앨범방_피드.png` 오른쪽 위). */
function MenuIcon() {
  return (
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
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

function CloseIcon() {
  return (
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
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

/** 갤러리 줄 오른쪽의 꺾쇠 — "여기 들어가면 더 있다"는 표시(캡처 그대로). */
function ChevronIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-muted"
      aria-hidden
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

/** 나가기 — 문 밖으로 나가는 화살표(캡처 그대로). */
function LeaveIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d="M14 4H6v16h8" />
      <path d="M17 8.5 20.5 12 17 15.5M20.5 12H11" />
    </svg>
  )
}
