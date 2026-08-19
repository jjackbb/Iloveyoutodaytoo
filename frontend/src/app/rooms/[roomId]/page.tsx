import type { Metadata } from 'next'

import { MoreDrawer } from './more-drawer'
import { MemoryCard } from '@/components/memory/MemoryCard'
import { BottomNav } from '@/components/nav/BottomNav'
import { RoomAppBar, RoomAppBarLink } from '@/components/room/RoomAppBar'
import { ButtonLink } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { requireUser } from '@/lib/auth'
import {
  buildMemoryCards,
  loadHiddenMemoryIds,
  MEMORY_CARD_SELECT,
} from '@/lib/room-feed'
import { createClient } from '@/lib/supabase/server'
import { loadRoomName } from '@/lib/room-look'

export const metadata: Metadata = { title: '앨범방 · 오늘도 사랑해' }

/** 한 번에 불러올 게시물 수. 최근 것부터 가져온다. */
const MEMORY_PAGE_SIZE = 30

/** 더보기 서랍의 갤러리 미리보기에 놓을 사진 수 (캡처 `참고/앨범방_더보기.png`). */
const GALLERY_PREVIEW_COUNT = 3

/**
 * 앨범방 상세 — 추억 피드 (캡처 10 빈 화면 / 캡처 22 게시물).
 *
 * 화면은 홈과 같은 4단이다: 머리띠(고정) / 피드(스크롤) / [마음 표현하기](고정) / 탭.
 *
 * 데이터는 요청마다 서버가 DB에서 읽는다. 클라이언트가 목록을 들고 있지 않으므로
 * 글을 남기고 돌아오면(revalidatePath) 늘 서버가 센 그대로가 보인다.
 *
 * 보이는 범위는 RLS(`is_room_member(room_id)`)가 정한다 — 방 안의 모두가 같은 피드를 본다.
 * 예전 이 화면이 보여주던 heart_messages(1:1 마음)는 지우지 않았다. 그건 사서함의 것이고,
 * 이 화면에서 안 보일 뿐이다.
 */
export default async function RoomPage({
  params,
  searchParams,
}: PageProps<'/rooms/[roomId]'>) {
  const { roomId } = await params
  // 방을 막 만들고 넘어왔는지(캡처 10의 "앨범방이 만들어졌어요 🎉").
  // 만든 쪽에서 상태를 들고 오지 않고 주소로만 알린다 — 새로고침하면 자연히 사라진다.
  const justCreated = (await searchParams).created === '1'

  // 멤버인지는 layout.tsx가 이미 확인했다. 여기서 사람을 다시 읽는 것은
  // **누구의 화면인지**를 알아야 하기 때문이다 — 좋아요·저장·숨김은 사람마다 다르고,
  // 수정·삭제는 자기 글에만 보인다.
  const viewer = await requireUser()
  const supabase = await createClient()

  /*
    내가 숨긴 글은 목록에 **들어오기 전에** 걸러야 한다.
    30개를 가져온 뒤에 빼면 숨긴 만큼 화면이 짧아진다.
  */
  const [roomNameResult, hiddenIds] = await Promise.all([
    // 방 이름은 사람마다 다를 수 있다 — 내가 바꿔 부르는 이름이 있으면 그것이다(@/lib/room-look).
    loadRoomName(roomId),
    loadHiddenMemoryIds(supabase, roomId, viewer.id),
  ])

  const roomName = roomNameResult ?? '앨범방'

  const memoriesQuery = supabase
    .from('memories')
    .select(MEMORY_CARD_SELECT)
    .eq('room_id', roomId)
    // 지운 글은 행이 남아 있을 뿐 없는 것이다(소프트 삭제). 모든 조회가 이 조건을 건다.
    .is('deleted_at', null)
    /*
      고정된 글이 맨 위, 그 아래는 최신순.
      nullsFirst를 끄지 않으면 내림차순의 기본값이 NULLS FIRST라 **고정 안 된 글이 위로 온다**
      (고정 안 한 글의 pinned_at이 null이므로). 한 방에 고정은 하나라 결과는 "고정 1개 + 최신순"이다.
    */
    .order('pinned_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(MEMORY_PAGE_SIZE)

  const memoriesResult = await (hiddenIds.length > 0
    ? memoriesQuery.not('id', 'in', `(${hiddenIds.join(',')})`)
    : memoriesQuery)

  // 사진 서명·좋아요·저장·이름 정하기는 전부 여기서 끝난다(N+1 없음, @/lib/room-feed).
  const cards = await buildMemoryCards({
    supabase,
    roomId,
    viewerId: viewer.id,
    rows: memoriesResult.data ?? [],
  })

  /*
    더보기 서랍의 갤러리 미리보기 — **가장 최근 게시물 3개**의 대표 사진.
    피드가 이미 서명해 둔 주소를 다시 쓴다. 서랍을 위해 조회를 한 번 더 하지 않는다.
    카드 순서는 고정 글이 맨 위라 시간순과 다르므로 여기서 다시 세운다.
  */
  const previewPhotos = [...cards]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, GALLERY_PREVIEW_COUNT)
    .map((card) => card.photos[0]?.url)
    .filter((url): url is string => Boolean(url))

  return (
    // 100dvh: 모바일 브라우저 주소창이 접혔다 펴져도 높이가 흔들리지 않는다(홈과 같다).
    <div className="flex h-[100dvh] flex-col">
      <RoomAppBar backHref="/" backLabel="홈으로 돌아가기" title={roomName}>
        {/* 멤버 추가 (캡처 10의 person+). 기존 초대 화면으로 그대로 이어진다. */}
        <RoomAppBarLink
          href={`/rooms/${roomId}/invite`}
          label={`${roomName}에 멤버 추가하기`}
        >
          <PersonAddIcon />
        </RoomAppBarLink>

        {/*
          더보기 서랍 (캡처 `참고/앨범방_더보기.png`).
          예전에 이 자리에 있던 [방 설정] 링크가 서랍 안의 '앨범방 나가기'로 들어갔다 —
          그 링크는 방 설정 화면의 나가기 칸(#leave)으로 그대로 이어지므로
          멤버 목록·차단으로 가는 길도 끊기지 않는다.
        */}
        <MoreDrawer
          roomId={roomId}
          roomName={roomName}
          previewPhotos={previewPhotos}
        />
      </RoomAppBar>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-md px-screen-x pt-0.5 pb-screen-b">
          {memoriesResult.error ? (
            <p
              role="alert"
              className="mt-4 rounded-inner bg-surface-soft px-4 py-4 text-base leading-relaxed text-ink"
            >
              추억을 불러오지 못했어요. 잠시 후 다시 열어봐 주세요.
            </p>
          ) : cards.length === 0 ? (
            <EmptyFeed />
          ) : (
            <ul
              aria-label={`${roomName}의 추억`}
              className="mt-card flex flex-col gap-card"
            >
              {cards.map((card) => (
                <MemoryCard key={card.memoryId} {...card} />
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* 아래 고정 줄 (캡처 10·22). 추억이 있든 없든 늘 같은 자리에 있다. */}
      <div className="shrink-0 border-t border-hairline bg-card px-screen-x py-3">
        <div className="mx-auto w-full max-w-md">
          <ButtonLink href={`/rooms/${roomId}/compose`} fullWidth>
            마음 표현하기
          </ButtonLink>
        </div>
      </div>

      <BottomNav />

      {/* 방을 막 만들고 들어왔을 때만 뜬다 (캡처 10). */}
      {justCreated ? (
        <Toast message="앨범방이 만들어졌어요 🎉" offsetClassName="bottom-32" />
      ) : null}
    </div>
  )
}

/**
 * 아직 아무것도 없을 때 (캡처 10).
 *
 * 버튼을 여기 달지 않는다 — 아래 고정 줄에 이미 [마음 표현하기]가 있다.
 * 대신 그 버튼의 이름을 문장 안에서 굵게 짚어준다. 캡처도 같은 방식이다.
 */
function EmptyFeed() {
  return (
    <p className="mt-24 text-center text-lg leading-relaxed break-keep text-muted">
      아직 추억이 없어요.
      <br />
      아래 <strong className="font-extrabold text-ink">마음 표현하기</strong>로
      <br />첫 번째 추억을 남겨보세요 🌷
    </p>
  )
}

/** 멤버 추가(캡처 10의 person+). */
function PersonAddIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9.5" cy="8" r="3.6" />
      <path d="M3 19.5c0-3.4 2.9-5.2 6.5-5.2 1.3 0 2.5.2 3.5.7" />
      <path d="M18 14v6M15 17h6" />
    </svg>
  )
}
