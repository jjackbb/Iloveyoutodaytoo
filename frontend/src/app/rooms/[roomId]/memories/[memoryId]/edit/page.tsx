import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { ComposeForm } from '@/app/rooms/[roomId]/compose/compose-form'
import { RoomAppBar } from '@/components/room/RoomAppBar'
import { requireUser } from '@/lib/auth'
import { signPaths } from '@/lib/room-feed'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: '추억 고치기 · 오늘도 사랑해' }

/**
 * 추억 고치기 — 사진·목소리·문구 (노션 IA 3.8).
 *
 * **작성 화면(ComposeForm)을 그대로 쓴다.** 고치는 화면을 따로 만들면 사진 담기,
 * 순서 바꾸기, 녹음, 실패 재시도 같은 것들이 두 벌이 되고 한쪽만 고쳐진다.
 * 다른 점은 시작할 때 지금 값이 얹혀 있다는 것과, 저장이 updateMemory로 간다는 것뿐이다.
 *
 * 왜 지우고 다시 올리게 하지 않나: 지우면 **거기 달린 댓글과 좋아요가 함께 사라진다.**
 * 사진 한 장 바꾸자고 가족이 남긴 말을 버리게 할 수는 없다.
 *
 * 남의 글은 열리지 않는다. RLS도 막지만, 여기서 먼저 돌려보내야
 * 빈 화면 대신 원래 보던 게시물로 돌아간다.
 */
export default async function EditMemoryPage({
  params,
}: PageProps<'/rooms/[roomId]/memories/[memoryId]/edit'>) {
  const { roomId, memoryId } = await params
  const user = await requireUser()
  const supabase = await createClient()

  const { data: memory } = await supabase
    .from('memories')
    .select(
      'id, author_id, description, voice_path, voice_duration_sec, voice_levels, photos:memory_photos(storage_path, sort_order)',
    )
    .eq('id', memoryId)
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .maybeSingle()

  const backHref = `/rooms/${roomId}/memories/${memoryId}`

  // 없거나 남의 글이면 보던 자리로 돌려보낸다.
  if (!memory || memory.author_id !== user.id) redirect(backHref)

  // 사진 순서는 DB가 준 순서를 믿지 않고 sort_order로 다시 세운다(첫 장이 대표 사진).
  const photoRows = [...(memory.photos ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  )
  const photoPaths = photoRows
    .map((row) => row.storage_path)
    .filter((path): path is string => Boolean(path))

  const [photoUrlByPath, voiceUrlByPath] = await Promise.all([
    signPaths(supabase, 'media', photoPaths),
    signPaths(supabase, 'voice', memory.voice_path ? [memory.voice_path] : []),
  ])

  const voiceUrl = memory.voice_path
    ? (voiceUrlByPath.get(memory.voice_path) ?? null)
    : null

  /*
    사진 주소나 목소리 주소를 못 만들면 고칠 수가 없다 —
    화면에 올릴 수 없는 것을 "그대로 두기"로 저장하면 빈 게시물이 된다.
    그때는 보던 자리로 돌려보낸다(문구만 고치는 길은 ⋯ 메뉴에 그대로 있다).
  */
  const photos = photoPaths
    .map((path) => ({ path, url: photoUrlByPath.get(path) }))
    .filter((photo): photo is { path: string; url: string } => Boolean(photo.url))

  if (photos.length === 0 || !memory.voice_path || !voiceUrl) redirect(backHref)

  return (
    <div className="flex h-[100dvh] flex-col">
      <RoomAppBar
        backHref={backHref}
        backLabel="게시물로 돌아가기"
        title="추억 고치기"
      />

      <ComposeForm
        roomId={roomId}
        initial={{
          memoryId,
          photos,
          voice: {
            path: memory.voice_path,
            url: voiceUrl,
            durationSec: memory.voice_duration_sec ?? 0,
            levels: memory.voice_levels,
          },
          caption: memory.description ?? '',
        }}
      />
    </div>
  )
}
