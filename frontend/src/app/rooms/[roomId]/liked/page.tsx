import type { Metadata } from 'next'

import { MemoryCard } from '@/components/memory/MemoryCard'
import { RoomAppBar } from '@/components/room/RoomAppBar'
import { requireUser } from '@/lib/auth'
import {
  buildMemoryCards,
  loadHiddenMemoryIds,
  MEMORY_CARD_SELECT,
} from '@/lib/room-feed'
import { createClient } from '@/lib/supabase/server'
import { loadRoomName } from '@/lib/room-look'

export const metadata: Metadata = { title: '좋아요 · 오늘도 사랑해' }

/** 한 번에 불러올 게시물 수. 피드와 같은 값을 쓴다. */
const MEMORY_PAGE_SIZE = 30

/**
 * 좋아요 — 내가 ♡를 누른 추억만 모아 본다 (더보기 서랍의 "좋아요").
 *
 * 피드와 **같은 카드**를 그린다. 여기서 ♡를 다시 누르면 좋아요가 풀리고,
 * 화면을 다시 읽을 때 그 글은 목록에서 빠진다 — 좋아요 목록이니 당연한 결과다.
 *
 * `memory_likes`는 방 멤버 모두에게 열려 있다(수를 세야 해서). 그래서 조회에
 * **`user_id = 나`를 반드시 건다.** 빼먹으면 남이 누른 것까지 내 목록에 들어온다.
 */
export default async function RoomLikedPage({
  params,
}: PageProps<'/rooms/[roomId]/liked'>) {
  const { roomId } = await params
  const viewer = await requireUser()
  const supabase = await createClient()

  const [roomNameResult, likesResult, hiddenIds] = await Promise.all([
    // 방 이름은 사람마다 다를 수 있다 — 내가 바꿔 부르는 이름이 있으면 그것이다(@/lib/room-look).
    loadRoomName(roomId),
    supabase
      .from('memory_likes')
      // memory_likes에는 방 번호가 없다. 부모 게시물로 이 방 것만 좁힌다(피드의 숨김 조회와 같은 방식).
      .select('memory_id, memories!inner(room_id)')
      .eq('user_id', viewer.id)
      .eq('memories.room_id', roomId),
    loadHiddenMemoryIds(supabase, roomId, viewer.id),
  ])

  const roomName = roomNameResult ?? '앨범방'

  if (likesResult.error) {
    console.error('[좋아요 목록] 조회 실패:', likesResult.error.message)
  }

  /*
    숨긴 글은 뺀다. 좋아요를 눌러둔 뒤에 숨겼다면 "안 보기로 한 것"이 나중 결정이다.
    (숨긴 글을 다시 보는 자리는 /hidden 하나로 모아 둔다)
  */
  const hidden = new Set(hiddenIds)
  const likedIds = (likesResult.data ?? [])
    .map((row) => row.memory_id)
    .filter((id) => !hidden.has(id))

  const memoriesResult =
    likedIds.length > 0
      ? await supabase
          .from('memories')
          .select(MEMORY_CARD_SELECT)
          .eq('room_id', roomId)
          // 지운 글은 어떤 목록에도 나오지 않는다(소프트 삭제).
          .is('deleted_at', null)
          .in('id', likedIds)
          // 좋아요를 누른 순서가 아니라 **글이 올라온 순서**로 본다. 피드와 같은 흐름이다.
          .order('created_at', { ascending: false })
          .limit(MEMORY_PAGE_SIZE)
      : null

  if (memoriesResult?.error) {
    console.error('[좋아요 목록] 게시물 조회 실패:', memoriesResult.error.message)
  }

  const cards = await buildMemoryCards({
    supabase,
    roomId,
    viewerId: viewer.id,
    rows: memoriesResult?.data ?? [],
  })

  const failed = Boolean(likesResult.error || memoriesResult?.error)

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <RoomAppBar
        backHref={`/rooms/${roomId}`}
        backLabel={`${roomName}으로 돌아가기`}
        title="좋아요"
      />

      <main className="flex-1 px-screen-x pb-screen-b">
        {failed ? (
          <p
            role="alert"
            className="mt-4 rounded-inner bg-surface-soft px-4 py-4 text-base leading-relaxed text-ink"
          >
            좋아요한 추억을 불러오지 못했어요. 잠시 후 다시 열어봐 주세요.
          </p>
        ) : cards.length === 0 ? (
          <p className="mt-24 text-center text-lg leading-relaxed break-keep text-muted">
            아직 좋아요한 추억이 없어요.
            <br />
            마음에 드는 추억의 <strong className="font-bold text-ink">♡</strong>를
            눌러보세요.
          </p>
        ) : (
          <ul
            aria-label="내가 좋아요한 추억"
            className="mt-card flex list-none flex-col gap-card"
          >
            {cards.map((card) => (
              <MemoryCard key={card.memoryId} {...card} />
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
