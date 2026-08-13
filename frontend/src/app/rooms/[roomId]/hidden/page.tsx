import type { Metadata } from 'next'

import { UnhideButton } from './unhide-button'
import { MemoryCard } from '@/components/memory/MemoryCard'
import { RoomAppBar } from '@/components/room/RoomAppBar'
import { requireUser } from '@/lib/auth'
import { buildMemoryCards, MEMORY_CARD_SELECT } from '@/lib/room-feed'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: '숨긴 추억 · 오늘도 사랑해' }

/** 한 번에 불러올 게시물 수. 피드와 같은 값을 쓴다. */
const MEMORY_PAGE_SIZE = 30

/**
 * 숨김 — 내가 감춘 추억만 모아 보고, 여기서 다시 보이게 할 수 있다.
 *
 * 이 화면이 생기기 전에는 한 번 숨기면 되돌릴 길이 없었다(카드가 피드에서 사라지니
 * ⋯ 메뉴를 다시 열 수가 없다). 그 유일한 해제 경로가 여기다.
 *
 * 숨김은 **누른 사람에게만** 걸린 표시다(`memory_hides`는 select도 본인 것만 열린다).
 * 그래서 남이 무엇을 숨겼는지는 여기서도 알 수 없고, 알 이유도 없다.
 *
 * 지운 글(`deleted_at`)은 숨겨 뒀더라도 보여주지 않는다 —
 * 풀어봐야 어디에도 안 나오는 글이라, 보여주면 "되돌렸는데 왜 없지"가 된다.
 */
export default async function RoomHiddenPage({
  params,
}: PageProps<'/rooms/[roomId]/hidden'>) {
  const { roomId } = await params
  const viewer = await requireUser()
  const supabase = await createClient()

  const [roomResult, hidesResult] = await Promise.all([
    supabase.from('rooms').select('name').eq('id', roomId).maybeSingle(),
    supabase
      .from('memory_hides')
      // memory_hides에는 방 번호가 없다. 부모 게시물로 이 방 것만 좁힌다.
      .select('memory_id, memories!inner(room_id)')
      .eq('user_id', viewer.id)
      .eq('memories.room_id', roomId),
  ])

  const roomName = roomResult.data?.name ?? '앨범방'

  if (hidesResult.error) {
    console.error('[숨김 목록] 조회 실패:', hidesResult.error.message)
  }

  const hiddenIds = (hidesResult.data ?? []).map((row) => row.memory_id)

  const memoriesResult =
    hiddenIds.length > 0
      ? await supabase
          .from('memories')
          .select(MEMORY_CARD_SELECT)
          .eq('room_id', roomId)
          .is('deleted_at', null)
          .in('id', hiddenIds)
          .order('created_at', { ascending: false })
          .limit(MEMORY_PAGE_SIZE)
      : null

  if (memoriesResult?.error) {
    console.error('[숨김 목록] 게시물 조회 실패:', memoriesResult.error.message)
  }

  const cards = await buildMemoryCards({
    supabase,
    roomId,
    viewerId: viewer.id,
    rows: memoriesResult?.data ?? [],
  })

  const failed = Boolean(hidesResult.error || memoriesResult?.error)

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <RoomAppBar
        backHref={`/rooms/${roomId}`}
        backLabel={`${roomName}으로 돌아가기`}
        title="숨김"
      />

      <main className="flex-1 px-screen-x pb-screen-b">
        {failed ? (
          <p
            role="alert"
            className="mt-4 rounded-inner bg-surface-soft px-4 py-4 text-base leading-relaxed text-ink"
          >
            숨긴 추억을 불러오지 못했어요. 잠시 후 다시 열어봐 주세요.
          </p>
        ) : cards.length === 0 ? (
          <p className="mt-24 text-center text-lg leading-relaxed break-keep text-muted">
            숨긴 추억이 없어요.
            <br />
            추억의 <strong className="font-extrabold text-ink">⋯</strong>에서 숨기면
            <br />
            여기에 모여요.
          </p>
        ) : (
          <>
            <p className="pt-1 pb-3 text-base leading-relaxed break-keep text-muted">
              나에게만 안 보이는 추억이에요. 다른 분들에게는 그대로 보여요.
            </p>

            <ul aria-label="내가 숨긴 추억" className="flex list-none flex-col gap-card">
              {cards.map((card) => (
                /*
                  카드는 div로 그리고 줄(li)은 여기서 만든다 —
                  카드 아래에 [다시 보이게 하기]가 함께 한 줄을 이루기 때문이다.
                */
                <li key={card.memoryId} className="flex flex-col gap-2">
                  <MemoryCard {...card} as="div" />
                  <UnhideButton
                    memoryId={card.memoryId}
                    authorName={card.authorName}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  )
}
