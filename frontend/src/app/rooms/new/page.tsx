import type { Metadata } from 'next'
import Link from 'next/link'

import { requireUser } from '@/lib/auth'
import { RoomForm } from '@/app/rooms/new/room-form'

export const metadata: Metadata = { title: '앨범방 만들기 · 오늘도 사랑해' }

/**
 * 앨범방 만들기 화면 (캡처 06~09).
 *
 * 묻는 것은 두 가지뿐이다 — 이름과 커버 사진.
 * 관계유형("어떤 사이인가요?")은 캡처 기준 개정으로 없앴다(_workspace/03_capture_flow.md).
 *
 * 방을 만들면 DB 트리거가 나를 방장(admin) 멤버로 자동 등록하고
 * 스트릭 레코드까지 만들어준다. 만든 뒤에는 방 화면으로 이동한다.
 */
export default async function NewRoomPage() {
  // 로그인한 사람만 방을 만들 수 있다. proxy.ts에서도 막지만 서버에서 한 번 더 확인한다.
  await requireUser()

  return (
    // 홈과 같은 3단 셸: 앱바(고정) / 본문(스크롤) / 만들기 버튼(고정).
    // 스크롤되는 칸과 아래 고정 줄은 RoomForm이 들고 있다 — 버튼이 폼 안에 있어야 제출된다.
    <div className="flex h-[100dvh] flex-col">
      <header className="shrink-0 bg-canvas">
        <div className="mx-auto flex w-full max-w-md items-center gap-1 px-screen-x pt-1.5 pb-3">
          <Link
            href="/"
            aria-label="홈으로 돌아가기"
            className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-surface-soft"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 5 8 12l7 7" />
            </svg>
          </Link>

          <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-ink">
            앨범방 만들기
          </h1>

          {/* 왼쪽 뒤로 버튼과 같은 너비를 비워 제목이 한쪽으로 쏠려 보이지 않게 한다. */}
          <div aria-hidden className="w-11 shrink-0" />
        </div>
      </header>

      <RoomForm>
        {/* 캡처 06의 제목 두 줄. 글자뿐이라 서버에서 그려 넘긴다. */}
        <div>
          <h2 className="text-2xl leading-snug font-bold tracking-[-0.02em] break-keep text-ink">
            새 앨범방을 만들어요
          </h2>
          <p className="mt-1.5 text-base leading-relaxed break-keep text-muted">
            우리만의 추억 공간에 이름을 붙여주세요.
          </p>
        </div>
      </RoomForm>
    </div>
  )
}
