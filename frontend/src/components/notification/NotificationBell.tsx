'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  deleteNotifications,
  markNotificationsRead,
} from '@/lib/actions/notifications'
import {
  notificationText,
  type AppNotification,
} from '@/lib/notification-view'
import { formatRelativeTime } from '@/lib/format'

/**
 * 앱바 오른쪽 알림 종 + 알림 모달 (캡처 04·05).
 *
 * 목록을 서버에서 미리 받아 `items`로 넘겨받는다. 종을 누른 뒤에 불러오면
 * 빈 카드가 먼저 뜨고 글이 나중에 채워져 화면이 한 번 덜컹인다.
 *
 * 잔여데이터가 아닌 이유: 여기 useState로 두는 것은 **모달이 열려 있는 동안의
 * 고른 항목**뿐이다. 알림 자체는 매번 서버가 읽어 내려주고, 닫으면 고른 것도 비운다.
 */
export function NotificationBell({ items }: { items: AppNotification[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const closeRef = useRef<HTMLButtonElement>(null)

  const unread = items.filter((n) => !n.read).length
  const selecting = picked.size > 0

  // 모달을 연 순간을 "봤다"로 본다. 캡처에 알림별 읽음 표시가 없어서,
  // 하나씩 눌러 읽게 하면 배지가 영영 안 내려간다.
  useEffect(() => {
    if (open && unread > 0) void markNotificationsRead()
  }, [open, unread])

  // 열리면 닫기 버튼으로 초점을 옮긴다 — 키보드·낭독기 사용자가 모달 안에서 시작하도록.
  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  function close() {
    setOpen(false)
    setPicked(new Set())
  }

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function removePicked() {
    const ids = [...picked]
    setPicked(new Set())
    await deleteNotifications(ids)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `알림 ${unread}개 안 읽음` : '알림'}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-chip text-ink active:bg-surface-soft"
      >
        <BellIcon />

        {unread > 0 ? (
          // 숫자는 장식이 아니라 정보지만, 개수는 위 aria-label이 이미 말한다.
          <span
            aria-hidden
            className="absolute top-1.5 right-1.5 flex min-w-[18px] items-center justify-center rounded-chip bg-primary px-1 text-[11px] leading-[18px] font-bold text-white"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="알림"
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
        >
          {/* 뒤 화면을 덮는 어두운 막. 눌러서 닫는다. */}
          <button
            type="button"
            aria-label="알림 닫기"
            onClick={close}
            className="absolute inset-0 bg-black/45"
          />

          {/* 캡처 05는 바닥 시트가 아니라 화면 가운데 뜬 카드다. */}
          <div className="relative flex max-h-[70dvh] w-full max-w-md flex-col overflow-hidden rounded-card bg-card shadow-card">
            <div className="flex shrink-0 items-center gap-3 border-b border-hairline px-5 py-4">
              <h2 className="min-w-0 flex-1 truncate text-xl font-bold text-ink">
                알림
              </h2>

              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    selecting
                      ? void removePicked()
                      : setPicked(new Set(items.map((n) => n.id)))
                  }
                  className="shrink-0 text-base font-medium text-primary"
                >
                  {selecting ? `${picked.size}개 삭제` : '전체 선택'}
                </button>
              ) : null}

              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="닫기"
                className="flex h-11 w-11 shrink-0 items-center justify-center text-xl text-primary"
              >
                ✕
              </button>
            </div>

            {items.length === 0 ? (
              <p className="flex min-h-[220px] items-center justify-center px-5 text-base text-muted">
                받을 알림이 없습니다
              </p>
            ) : (
              <ul className="min-h-0 flex-1 divide-y divide-hairline overflow-y-auto">
                {items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    item={n}
                    selecting={selecting}
                    picked={picked.has(n.id)}
                    onPick={() => toggle(n.id)}
                    onGo={close}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}

/**
 * 알림 한 줄.
 *
 * 고르는 중일 때는 링크가 아니라 체크 버튼이 된다 — 지우려고 눌렀는데 화면이
 * 넘어가버리면 고른 것이 다 날아간다.
 */
function NotificationRow({
  item,
  selecting,
  picked,
  onPick,
  onGo,
}: {
  item: AppNotification
  selecting: boolean
  picked: boolean
  onPick: () => void
  onGo: () => void
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span className="text-base break-keep text-ink">
          {notificationText(item)}
        </span>
        <span className="text-sm text-muted">
          {formatRelativeTime(item.createdAt)}
        </span>
      </span>

      {selecting ? (
        <span
          aria-hidden
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-chip border text-sm ${
            picked
              ? 'border-primary bg-primary text-white'
              : 'border-hairline-strong text-transparent'
          }`}
        >
          ✓
        </span>
      ) : null}
    </>
  )

  return (
    <li className={item.read ? '' : 'bg-surface-soft'}>
      {selecting ? (
        <button
          type="button"
          onClick={onPick}
          aria-pressed={picked}
          className="flex min-h-[64px] w-full items-center gap-3 px-5 py-3 active:bg-surface-soft"
        >
          {body}
        </button>
      ) : item.href ? (
        <a
          href={item.href}
          onClick={onGo}
          className="flex min-h-[64px] w-full items-center gap-3 px-5 py-3 active:bg-surface-soft"
        >
          {body}
        </a>
      ) : (
        // 갈 곳이 없는 알림. 눌렀는데 404가 뜨는 것보다 안 눌리는 편이 낫다.
        <div className="flex min-h-[64px] w-full items-center gap-3 px-5 py-3">
          {body}
        </div>
      )}
    </li>
  )
}

/** 프로토타입 .iconbtn 안의 종. 24px 기준. */
function BellIcon() {
  return (
    <svg
      aria-hidden
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
