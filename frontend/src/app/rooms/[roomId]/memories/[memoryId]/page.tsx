import type { Metadata } from 'next'
import Link from 'next/link'

import { CommentBar } from './comment-bar'
import { CommentList } from './comment-list'
import { PhotoPager } from './photo-pager'
import { VoicePlayer } from '@/components/media/VoicePlayer'
import { LikeButton } from '@/components/memory/LikeButton'
import { MemoryMenu } from '@/components/memory/MemoryMenu'
import { RoomAppBar } from '@/components/room/RoomAppBar'
import { requireUser } from '@/lib/auth'
import { formatRelativeTime } from '@/lib/format'
import { loadMemoryDetail } from '@/lib/room-feed'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: '추억 · 오늘도 사랑해' }

/**
 * 게시물 상세 (캡처 24~36).
 *
 * 위에서부터: 머리띠(← / 방 이름 / ⋯) / 본문(사진 페이저·문구·목소리·♡·댓글) / 댓글바(고정).
 *
 * 피드 카드와 다르게 그리는 것은 **사진**뿐이다. 피드는 4컷 격자로 한눈에 보여주고,
 * 여기서는 한 장씩 넘겨본다(캡처 24의 "1/3" 배지). 나머지 — ♡와 ⋯ — 는 피드와
 * 똑같은 부품(LikeButton·MemoryMenu)을 그대로 쓴다. 두 화면에서 같은 것이 다르게
 * 동작하면 안 되기 때문이다.
 *
 * 잔여데이터가 남지 않는 이유: 데이터는 요청마다 서버가 읽고, 화면에 상태를 들고 있는
 * 부품(페이저·댓글바)에는 `key={memoryId}`를 붙였다. 다른 게시물로 옮기면 그 부품들이
 * 통째로 새로 만들어져 앞 게시물의 입력이나 사진 자리가 한 순간도 남지 않는다.
 */
export default async function MemoryDetailPage({
  params,
}: PageProps<'/rooms/[roomId]/memories/[memoryId]'>) {
  const { roomId, memoryId } = await params

  // 이 방의 멤버인지는 layout.tsx가 이미 확인했다. 여기서 사람을 다시 읽는 것은
  // 좋아요·저장이 사람마다 다르고, 수정·삭제가 자기 것에만 보이기 때문이다.
  const viewer = await requireUser()
  const supabase = await createClient()

  const [roomResult, detail] = await Promise.all([
    supabase.from('rooms').select('name').eq('id', roomId).maybeSingle(),
    loadMemoryDetail({ supabase, roomId, memoryId, viewerId: viewer.id }),
  ])

  const roomName = roomResult.data?.name ?? '앨범방'

  /*
    없거나, 지워졌거나, 볼 수 없는 글. 셋을 구분해 알려줄 방법도 이유도 없다.
    기본 404 화면 대신 우리말로 이유를 말하고 돌아갈 길을 준다.
  */
  if (!detail) {
    return (
      <div className="flex h-[100dvh] flex-col">
        <RoomAppBar
          backHref={`/rooms/${roomId}`}
          backLabel={`${roomName}으로 돌아가기`}
          title={roomName}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-md px-screen-x pb-screen-b">
            <p className="mt-24 text-center text-lg leading-relaxed break-keep text-muted">
              이 추억은 볼 수 없어요.
              <br />
              지워졌거나 옮겨진 것 같아요.
            </p>
            <p className="mt-6 text-center">
              <Link
                href={`/rooms/${roomId}`}
                className="inline-flex min-h-[44px] items-center rounded-button px-4 text-base font-extrabold text-primary"
              >
                {roomName}으로 돌아가기
              </Link>
            </p>
          </div>
        </main>
      </div>
    )
  }

  const isMine = detail.authorId !== null && detail.authorId === viewer.id
  const commentCount = detail.comments.length

  return (
    // 100dvh: 주소창이 접혔다 펴져도 아래 댓글바가 흔들리지 않는다(피드와 같다).
    <div className="flex h-[100dvh] flex-col">
      <RoomAppBar
        backHref={`/rooms/${roomId}`}
        backLabel={`${roomName}으로 돌아가기`}
        title={roomName}
      >
        {/* 피드 카드의 ⋯ 와 같은 부품·같은 동작(고정·수정·숨기기·저장·삭제). */}
        <MemoryMenu
          memoryId={detail.memoryId}
          authorName={detail.authorName}
          caption={detail.caption}
          isMine={isMine}
          isPinned={detail.isPinned}
          isSaved={detail.isSaved}
        />
      </RoomAppBar>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-md px-screen-x pb-6">
          {/* 누가 언제 남겼는지 (캡처 24). */}
          <div className="flex items-center gap-3 pt-1 pb-3">
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-extrabold text-primary"
            >
              {initial(detail.authorName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-extrabold text-ink">
                {detail.authorName}
              </p>
              <p className="text-sm text-muted">
                {formatRelativeTime(detail.createdAt)}
              </p>
            </div>
          </div>

          {/*
            사진 페이저. key를 붙여 다른 게시물로 옮길 때 몇 번째 장을 보고 있었는지가
            따라오지 않게 한다.
          */}
          <PhotoPager
            key={detail.memoryId}
            photos={detail.photos}
            hasPhotos={detail.hasPhotos}
            authorName={detail.authorName}
          />

          {detail.caption ? (
            <p className="pt-4 text-base leading-relaxed break-keep whitespace-pre-wrap text-ink">
              {detail.caption}
            </p>
          ) : null}

          {detail.voiceUrl && detail.voiceDurationSec ? (
            <div className="pt-4">
              <VoicePlayer
                src={detail.voiceUrl}
                durationSec={detail.voiceDurationSec}
                levels={detail.voiceLevels}
                label={`${detail.authorName}님의 목소리`}
              />
            </div>
          ) : detail.voiceDurationSec ? (
            <p className="pt-4 text-sm text-muted">
              목소리를 불러오지 못했어요. 잠시 후 다시 열어주세요.
            </p>
          ) : null}

          {/* ♡ 와 댓글 수 (캡처 24). ♡는 피드와 같은 부품이라 여기서 눌러도 피드에 반영된다. */}
          <div className="flex items-center gap-4 pt-1 text-sm font-medium text-muted">
            <LikeButton
              memoryId={detail.memoryId}
              authorName={detail.authorName}
              likeCount={detail.likeCount}
              liked={detail.likedByMe}
            />
            {/* 이미 댓글 목록이 아래에 펼쳐져 있어 누를 곳이 아니다. 수만 말한다. */}
            <p className="flex items-center gap-1.5">
              <CommentIcon />
              <span className="tabular-nums">{commentCount}</span>
              <span className="sr-only">댓글</span>
            </p>
          </div>

          <h2 className="mt-5 mb-2 text-base font-extrabold text-ink">
            댓글 {commentCount}
          </h2>

          <CommentList comments={detail.comments} />
        </div>
      </main>

      {/*
        아래 고정 댓글바 (캡처 25). key로 게시물이 바뀔 때 쓰던 글·녹음이 따라오지 않게 한다.
      */}
      <CommentBar key={detail.memoryId} roomId={roomId} memoryId={detail.memoryId} />
    </div>
  )
}

/** 아바타에 넣을 한 글자. MemoryCard·MemberStack과 같은 규칙. */
function initial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '·'
  return [...trimmed][0] ?? '·'
}

function CommentIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4.5 5.5h15v11h-9l-4 3.5v-3.5h-2z" />
    </svg>
  )
}
