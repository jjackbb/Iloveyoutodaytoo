import Link from 'next/link'

import { VoicePlayer } from '@/components/media/VoicePlayer'
import { LikeButton } from '@/components/memory/LikeButton'
import { MemoryMenu } from '@/components/memory/MemoryMenu'
import { formatRelativeTime } from '@/lib/format'
import { PHOTO_MAX_COUNT } from '@/lib/limits'

/**
 * 앨범방 피드의 추억 게시물 카드 (캡처 22).
 *
 * 위에서부터: 아바타 + 닉네임 + 상대시간 + ⋯ / 사진 그리드 / 문구 / 음성 재생바 / ♡·💬 수.
 *
 * 이 부품은 DB를 보지 않는다. 서명된 사진 주소도, 내가 좋아요를 눌렀는지도 전부 props로 받는다.
 * 서버 컴포넌트로 남고, 누르는 잎(음성 재생·♡·⋯)만 안에서 클라이언트 부품을 쓴다.
 *
 * 상세 화면으로 가는 길은 두 곳이다: **사진 그리드**와 **💬 수**(캡처 22 → 24).
 * 사진이 한 장뿐이어도 눌러서 들어갈 수 있어야 한다 — 그때만 못 들어가면
 * "누를 수 있는 카드"라는 규칙이 게시물마다 달라진다.
 */

export interface MemoryPhotoView {
  /** 서명된 media 버킷 주소. */
  url: string
}

export interface MemoryCardProps {
  /** 좋아요·⋯ 메뉴가 어느 게시물을 가리키는지. */
  memoryId: string
  /** 상세 화면 주소(`/rooms/{roomId}/memories/{memoryId}`)를 만들려고 받는다. */
  roomId: string
  authorName: string
  /**
   * 작성자. 탈퇴하면 null이 된다(ON DELETE SET NULL).
   * `viewerId`와 견줘 **수정·삭제를 보여줄지**를 정한다 — 이름으로 견주면 동명이인이 섞인다.
   */
  authorId: string | null
  /** 지금 이 화면을 보고 있는 사람. */
  viewerId: string
  createdAt: string
  /** 주소를 만든 사진들. 그리드에 놓을 만큼만 온다. */
  photos: MemoryPhotoView[]
  /**
   * 이 게시물이 사진을 가지고 있는지(DB 기준).
   * `photos`가 비었는데 이 값이 참이면 "주소를 못 만든 것"이라 대체 문구를 띄운다 —
   * 음성이 `voiceDurationSec`은 있는데 `voiceUrl`이 없을 때와 같은 갈래다.
   */
  hasPhotos: boolean
  /** 그리드에 다 담기지 않은 사진 수. 마지막 칸에 +N으로 접힌다. */
  hiddenPhotoCount: number
  caption: string | null
  /** 서명된 voice 버킷 주소. 못 만들었으면 null. */
  voiceUrl: string | null
  voiceDurationSec: number | null
  /** 녹음할 때 재어 둔 파형 막대 높이. 없으면 재생바가 재생할 때 파일을 해석한다. */
  voiceLevels?: number[] | null
  likeCount: number
  /** 이 화면을 보는 사람이 좋아요를 눌렀는지. 사람마다 다르다. */
  likedByMe: boolean
  commentCount: number
  /** 방 피드 맨 위에 고정된 글인지. 한 방에 하나뿐이다. */
  isPinned: boolean
  /** 이 화면을 보는 사람이 저장(북마크)했는지. */
  isSaved: boolean
  as?: 'li' | 'div'
}

export function MemoryCard({
  memoryId,
  roomId,
  authorName,
  authorId,
  viewerId,
  createdAt,
  photos,
  hasPhotos,
  hiddenPhotoCount,
  caption,
  voiceUrl,
  voiceDurationSec,
  voiceLevels = null,
  likeCount,
  likedByMe,
  commentCount,
  isPinned,
  isSaved,
  as: Element = 'li',
}: MemoryCardProps) {
  /*
    수정·삭제를 보여줄지. 작성자가 탈퇴해 author_id가 null이 된 글은
    아무의 것도 아니므로 누구에게도 보이지 않는다(null === null 로 뚫리지 않게 먼저 막는다).
  */
  const isMine = authorId !== null && authorId === viewerId

  /** 이 게시물의 상세 화면. 사진과 💬 가 같은 곳으로 간다. */
  const detailHref = `/rooms/${roomId}/memories/${memoryId}`

  return (
    /*
      overflow-hidden을 두지 않는다. 두면 ⋯ 메뉴가 카드 밖으로 나가는 순간 잘린다
      (사진이 없는 짧은 카드에서 실제로 그렇게 된다).
      사진 그리드는 카드의 둥근 모서리에 닿지 않는다 — 위에는 늘 머리줄이, 아래에는 늘
      발자국 줄이 있다. 그래서 카드에서 잘라낼 것이 애초에 없다.
    */
    <Element className="list-none rounded-card bg-card shadow-card">
      {/* 머리 — 누가 언제 남겼는지 + 오른쪽 끝 ⋯ (캡처 22). */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary"
        >
          {initial(authorName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-ink">
            {authorName}
          </p>
          <p className="text-sm text-muted">
            {formatRelativeTime(createdAt)}
            {/*
              고정된 글은 왜 맨 위에 있는지 말해준다. 이유 없이 순서가 다르면
              "왜 이 글이 여기 있지" 하고 헤매게 된다. 압정 모양과 글자를 함께 둔다.
            */}
            {isPinned ? (
              <span className="ml-2 inline-flex items-center gap-1 font-bold text-primary">
                <PinIcon />
                고정됨
              </span>
            ) : null}
          </p>
        </div>

        <MemoryMenu
          roomId={roomId}
          memoryId={memoryId}
          authorName={authorName}
          caption={caption}
          isMine={isMine}
          isPinned={isPinned}
          isSaved={isSaved}
        />
      </div>

      {/*
        사진을 누르면 상세로 간다 (캡처 22 → 24).
        사진이 한 장이든 열 장이든 같은 자리를 누르면 같은 곳으로 간다.
        낭독기에는 링크 이름을 따로 준다 — 사진 설명만으로는 "눌러서 어디로 가는지"가 없다.
      */}
      {hasPhotos ? (
        <Link
          href={detailHref}
          aria-label={`${authorName}님의 추억 자세히 보기`}
          className="block"
        >
          <PhotoGrid
            photos={photos}
            hasPhotos={hasPhotos}
            hiddenPhotoCount={hiddenPhotoCount}
            authorName={authorName}
          />
        </Link>
      ) : null}

      {caption ? (
        <p className="px-4 pt-3.5 text-base leading-relaxed break-keep whitespace-pre-wrap text-ink">
          {caption}
        </p>
      ) : null}

      {voiceUrl && voiceDurationSec ? (
        <div className="px-4 pt-3.5">
          <VoicePlayer
            src={voiceUrl}
            durationSec={voiceDurationSec}
            levels={voiceLevels}
            label={`${authorName}님의 목소리`}
          />
        </div>
      ) : voiceDurationSec ? (
        // 경로는 있는데 주소를 만들지 못한 경우. 조용히 빈 자리로 두지 않는다.
        <p className="px-4 pt-3.5 text-sm text-muted">
          목소리를 불러오지 못했어요. 잠시 후 다시 열어주세요.
        </p>
      ) : null}

      {/*
        발자국 줄 (캡처 22의 "♡ 0  💬 0").
        ♡는 이 자리에서 바로 켜고 끄는 버튼, 💬는 댓글이 있는 상세 화면으로 가는 링크다.
        둘 다 눌리는 자리이고 하는 일이 달라 태그도 다르다 —
        누르면 화면이 바뀌는 것은 링크여야 새 탭으로 열거나 뒤로 갈 수 있다.
      */}
      <div className="flex items-center gap-4 px-4 pt-1 pb-2 text-sm font-medium text-muted">
        <LikeButton
          memoryId={memoryId}
          authorName={authorName}
          likeCount={likeCount}
          liked={likedByMe}
        />
        <Link
          href={detailHref}
          // 수까지 이름에 넣는다. 아이콘과 숫자만 있으면 무엇을 여는 링크인지 알 수 없다.
          aria-label={`${authorName}님의 추억 댓글 ${commentCount}개 보기`}
          className="-mx-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-inner px-2 transition-colors active:bg-surface-soft"
        >
          <CommentIcon />
          <span className="tabular-nums">{commentCount}</span>
        </Link>
      </div>
    </Element>
  )
}

/**
 * 사진 그리드 (캡처 22).
 *
 * 장수에 따라 칸을 나누는 방식이 다르다:
 * - 1장: 크게 한 칸
 * - 2장: **좌우로 반씩**. 오른쪽 열을 위아래로 또 나누면 아래 칸이 채울 사진이 없어
 *   빈 회색 칸으로 남는다(실제로 그랬다).
 * - 3장 이상: 왼쪽 큰 사진 + 오른쪽 작은 사진 두 장
 *
 * 왼쪽(첫) 자리는 언제나 대표 사진이다 — 작성 화면에서 [대표 사진] 배지를 붙여
 * 약속한 자리이므로, 여기서 순서가 흔들리면 그 약속이 깨진다.
 *
 * 사진이 있는데 주소를 못 만들었으면 자리를 없애지 않고 대체 문구를 남긴다.
 * 통째로 사라지면 사용자는 **원래 사진이 없는 글**로 읽는다 — 사실이 아닌 것을 보여주는 셈이다.
 */
function PhotoGrid({
  photos,
  hasPhotos,
  hiddenPhotoCount,
  authorName,
}: {
  photos: MemoryPhotoView[]
  hasPhotos: boolean
  hiddenPhotoCount: number
  authorName: string
}) {
  if (photos.length === 0) {
    if (!hasPhotos) return null
    return (
      <p className="px-4 pt-1 text-sm text-muted">
        사진을 불러오지 못했어요. 잠시 후 다시 열어주세요.
      </p>
    )
  }

  // 사진에 붙일 설명. 무엇이 찍혔는지는 우리가 알 수 없으므로 누가 남긴 것인지만 말한다.
  // 빈 alt로 두면 사진이 아예 없는 것처럼 읽힌다.
  const alt = `${authorName}님이 남긴 사진`

  if (photos.length === 1) {
    return (
      <div className="aspect-[4/3] w-full overflow-hidden bg-surface-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[0].url} alt={alt} className="h-full w-full object-cover" />
      </div>
    )
  }

  const [cover, ...rest] = photos

  return (
    /*
      2px 틈으로 나뉜 두 칸. 캡처의 격자가 사진끼리 맞닿아 있다.

      min-h-0 이 빠지면 안 된다. 격자 칸의 기본값은 min-height:auto라
      안에 든 사진의 원래 높이만큼 칸이 늘어난다 — 세로로 긴 사진 한 장이
      aspect-[4/3]을 뚫고 카드를 화면 밖까지 밀어낸다(실제로 그랬다).
    */
    <div className="grid aspect-[4/3] w-full grid-cols-2 grid-rows-1 gap-0.5 overflow-hidden bg-surface-soft">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cover.url} alt={alt} className="h-full min-h-0 w-full object-cover" />

      {/*
        오른쪽 열. 남은 사진이 한 장뿐이면 나누지 않는다 —
        grid-rows-2 로 두면 두 번째 행이 채울 사진 없이 빈 회색 칸으로 남는다.
        (사진 정확히 2장인 게시물에서 카드 오른쪽 아래 1/4이 그렇게 비어 있었다)
      */}
      <div
        className={`grid min-h-0 gap-0.5 ${rest.length === 1 ? 'grid-rows-1' : 'grid-rows-2'}`}
      >
        {rest.map((photo, index) => {
          // 마지막 칸에만 "+N"을 얹는다. 나머지가 몇 장인지 알려줘야
          // 게시물에 사진이 더 있다는 걸 알 수 있다.
          const isLastCell = index === rest.length - 1
          const showMore = isLastCell && hiddenPhotoCount > 0

          return (
            <div key={index} className="relative min-h-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={showMore ? '' : alt}
                className="h-full w-full object-cover"
              />
              {showMore ? (
                <span
                  className="absolute inset-0 flex items-center justify-center bg-black/45 text-xl font-bold text-white"
                  aria-label={`사진 ${hiddenPhotoCount}장 더 있음`}
                >
                  +{Math.min(hiddenPhotoCount, PHOTO_MAX_COUNT)}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 아바타에 넣을 한 글자. MemberStack과 같은 규칙을 쓴다 —
 * 같은 사람이 홈 카드와 피드에서 다른 글자로 보이면 안 된다.
 */
function initial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '·'
  return [...trimmed][0] ?? '·'
}

/** 고정 표시의 압정. ♡는 누를 수 있는 자리로 옮겨가 LikeButton이 그린다. */
function PinIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5Z" />
      <path d="M12 14v6" />
    </svg>
  )
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
