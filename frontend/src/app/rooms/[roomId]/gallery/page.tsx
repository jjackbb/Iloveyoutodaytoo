import type { Metadata } from 'next'

import { RoomAppBar } from '@/components/room/RoomAppBar'
import { requireUser } from '@/lib/auth'
import { formatKstDate } from '@/lib/format'
import { roomMemberName } from '@/lib/member-name'
import {
  isRoomPath,
  loadHiddenMemoryIds,
  loadRoomNicknames,
  signPaths,
} from '@/lib/room-feed'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: '갤러리 · 오늘도 사랑해' }

/**
 * 한 번에 훑을 게시물 수. 사진은 게시물당 최대 10장이라 아래 사진 상한이 실제 한계다.
 * 둘 다 두는 이유: 사진이 1장뿐인 게시물만 있는 방에서도 조회가 무한히 커지지 않게.
 */
const MEMORY_SCAN_LIMIT = 120

/**
 * 한 화면에 놓을 사진 수 상한.
 *
 * 서명은 한 번에 몰아서 하므로 수가 커지면 첫 그림이 그만큼 늦어진다.
 * 넘치면 "여기까지 보여드렸다"고 화면에 적는다 — 조용히 자르면 사진이 사라진 줄 안다.
 */
const PHOTO_LIMIT = 240

/**
 * 갤러리 — 이 방의 사진을 격자로 모아 본다 (더보기 서랍의 "갤러리").
 *
 * 순서는 **왼쪽 위가 가장 최근 게시물의 대표 사진**이다:
 * 게시물은 최신순, 한 게시물 안에서는 sort_order 순.
 * 고정(pinned_at)은 보지 않는다 — 고정은 피드에서 "맨 위 한 자리"를 정하는 표시이고,
 * 여기서까지 순서를 흔들면 "언제 찍은 사진인지"로 훑는 흐름이 끊긴다.
 *
 * 빼는 것 두 가지:
 * - 지운 글(`deleted_at`)의 사진. 화면 어디에서도 다시 나오면 안 된다.
 * - **내가 숨긴 글**의 사진. 피드에서 안 보이기로 한 것이 갤러리에 그대로 있으면
 *   숨김이 반쪽짜리가 된다. 숨긴 것을 다시 보는 자리는 따로 있다(`/hidden`).
 */
export default async function RoomGalleryPage({
  params,
}: PageProps<'/rooms/[roomId]/gallery'>) {
  const { roomId } = await params
  const viewer = await requireUser()
  const supabase = await createClient()

  const [roomResult, hiddenIds, nicknameByUser] = await Promise.all([
    supabase.from('rooms').select('name').eq('id', roomId).maybeSingle(),
    loadHiddenMemoryIds(supabase, roomId, viewer.id),
    loadRoomNicknames(supabase, roomId),
  ])

  const roomName = roomResult.data?.name ?? '앨범방'

  const memoriesQuery = supabase
    .from('memories')
    // 한 줄로 둔다 — 문자열을 이어 붙이면 타입 추론이 풀려서 결과가 unknown이 된다.
    .select(
      'id, created_at, author_id, author:users!memories_author_id_fkey(id, name), photos:memory_photos(storage_path, sort_order)',
    )
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(MEMORY_SCAN_LIMIT)

  const memoriesResult = await (hiddenIds.length > 0
    ? memoriesQuery.not('id', 'in', `(${hiddenIds.join(',')})`)
    : memoriesQuery)

  if (memoriesResult.error) {
    console.error('[갤러리] 조회 실패:', memoriesResult.error.message)
  }

  /*
    게시물 순서(최신순) 안에서 사진을 sort_order로 세워 한 줄로 편다.
    이 배열의 앞이 곧 격자의 왼쪽 위다.
  */
  const tiles = (memoriesResult.data ?? []).flatMap((memory) => {
    const authorName = roomMemberName({
      userId: memory.author_id,
      nickname: memory.author_id ? nicknameByUser.get(memory.author_id) : null,
      name: memory.author?.name,
    })

    return [...(memory.photos ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .filter((photo) => isRoomPath(photo.storage_path, roomId))
      .map((photo) => ({
        path: photo.storage_path,
        // 무엇이 찍혔는지는 알 수 없다. 누가 언제 남긴 것인지만 말한다.
        alt: `${authorName}님이 ${formatKstDate(memory.created_at)}에 남긴 사진`,
      }))
  })

  /*
    같은 파일이 두 게시물에 걸려 있을 일은 없지만, 격자의 열쇠(key)를 경로로 쓰므로
    혹시 겹치면 화면이 어긋난다. 먼저 나온 것(더 최근 게시물)만 남긴다.
  */
  const seen = new Set<string>()
  const unique = tiles.filter((tile) => {
    if (seen.has(tile.path)) return false
    seen.add(tile.path)
    return true
  })

  const capped = unique.length > PHOTO_LIMIT
  const shown = unique.slice(0, PHOTO_LIMIT)

  // 서명은 한 번에 몰아서 한다. 사진 수만큼 요청이 늘어나는 구조를 만들지 않는다.
  const urlByPath = await signPaths(
    supabase,
    'media',
    shown.map((tile) => tile.path),
  )

  // 주소를 만든 것만 놓는다. 못 만든 자리를 회색 칸으로 남기면 격자에 구멍이 생긴다.
  const photos = shown
    .map((tile) => ({ ...tile, url: urlByPath.get(tile.path) }))
    .filter((tile): tile is typeof tile & { url: string } => Boolean(tile.url))

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
      <RoomAppBar
        backHref={`/rooms/${roomId}`}
        backLabel={`${roomName}으로 돌아가기`}
        title="갤러리"
      />

      <main className="flex-1 px-screen-x pb-screen-b">
        {memoriesResult.error ? (
          <p
            role="alert"
            className="mt-4 rounded-inner bg-surface-soft px-4 py-4 text-base leading-relaxed text-ink"
          >
            사진을 불러오지 못했어요. 잠시 후 다시 열어봐 주세요.
          </p>
        ) : photos.length === 0 ? (
          <p className="mt-24 text-center text-lg leading-relaxed break-keep text-muted">
            아직 사진이 없어요.
            <br />
            앨범방에서 <strong className="font-extrabold text-ink">마음 표현하기</strong>
            로<br />첫 사진을 남겨보세요 🌷
          </p>
        ) : (
          <>
            <p className="pt-1 pb-3 text-base text-muted">
              사진 {photos.length}장 · 최근에 남긴 것부터예요
            </p>

            {/* 격자는 사진끼리 맞닿는다(피드 카드의 그리드와 같은 2px 틈). */}
            <ul className="grid list-none grid-cols-3 gap-0.5">
              {photos.map((photo) => (
                <li
                  key={photo.path}
                  className="aspect-square overflow-hidden bg-surface-soft"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.alt}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </li>
              ))}
            </ul>

            {capped ? (
              <p className="pt-4 text-center text-base leading-relaxed break-keep text-muted">
                최근 사진 {PHOTO_LIMIT}장까지 보여드렸어요.
              </p>
            ) : null}
          </>
        )}
      </main>
    </div>
  )
}
