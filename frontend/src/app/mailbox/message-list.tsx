'use client'

import { VoicePlayer } from '@/components/media/VoicePlayer'
import { FavoriteHeartButton } from '@/components/message/FavoriteHeartButton'
import { ReportButton } from '@/components/report/ReportButton'
import { AvatarCircle } from '@/components/ui/AvatarCircle'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatRelativeTime } from '@/lib/format'
import type { MailboxBox, MailboxItem } from '@/lib/actions/mailbox'
import { markHeartRead } from '@/lib/actions/mission'

/**
 * 사서함 목록 (캡처 46·47).
 *
 * 카드 한 장의 모양: [사진] [이름 / 상대시간 / 음성 재생바 또는 글] [♡]
 *
 * 데이터는 전부 위(mailbox-tabs)에서 받아 온다. 이 파일은 보여주기만 한다.
 *
 * 여기에 좋아요·댓글·답장 버튼을 붙이지 않는다.
 * 반응 수단은 "마음 메시지" 하나뿐이고, 답장을 재촉하지 않는 게 이 서비스의 규칙이다
 * (04_PROJECT_SPEC.md "절대 하지 마"). ♡는 남에게 보이지 않는 내 표시라 여기 해당하지 않는다.
 */

/** 탈퇴한 분이 보낸 마음도 사서함에 그대로 남는다. 이름 자리만 이렇게 채운다. */
const WITHDRAWN_NAME = '탈퇴한 사용자'

/** 방을 떠난 분 등, 이름을 읽어올 수 없는 경우. */
const UNKNOWN_NAME = '알 수 없는 사람'

/** 카드에 쓸 상대 이름 하나. 제목과 회색 줄이 서로 다른 이름을 쓰면 안 된다. */
function partnerLabel(item: MailboxItem): string {
  if (item.partnerWithdrawn) return WITHDRAWN_NAME
  return item.partnerName ?? UNKNOWN_NAME
}

export interface MessageListProps {
  box: MailboxBox
  items: MailboxItem[]
  hasMore: boolean
  /** 불러오는 중인지 */
  loading: boolean
  /** 문제가 생겼을 때 보여줄 문구 */
  error: string | null
  onLoadMore: () => void
  onRetry: () => void
  /** ♡를 눌러 서버 값이 바뀐 뒤 목록을 다시 읽기 위해. */
  onRefresh: () => void
}

/**
 * 카드 맨 위에 굵게 나오는 이름 (캡처 46의 "ㅇㅇ (전체)").
 *
 * 방 전체에 보낸 마음은 **받는 사람 이름 대신 방 이름**을 세운다 — 한 번 보낸 것이
 * 사람 수만큼 카드로 쌓이는데, 이름만 다르고 내용이 같으면 뭘 보낸 건지 알 수 없다.
 * 대신 누구에게 갔는지는 아래 회색 줄이 말해준다.
 *
 * 받은 마음 쪽은 늘 **보낸 분 이름**이다. 캡처 47은 목업이라 보낸 마음과 같은
 * "(전체)"가 찍혀 있지만, 받는 입장에서 먼저 궁금한 것은 누가 보냈는가다.
 */
function cardTitle(box: MailboxBox, item: MailboxItem): string {
  // 나에게 보낸 마음은 받은함에도 함께 뜬다(보낸 사람도 받는 사람도 나다).
  // 그 자리에 내 이름이 나오면 "누가 보냈지?" 하고 한 번 멈추게 된다.
  if (item.toMyself) return '나에게'

  if (box === 'sent' && item.sendMode === 'broadcast' && item.roomName) {
    return `${item.roomName} (전체)`
  }
  return partnerLabel(item)
}

/** 이름 아래 회색 한 줄. 방 이름·받는 분·상대시간을 담는다. */
function cardMeta(box: MailboxBox, item: MailboxItem): string {
  const parts: string[] = []

  if (box === 'sent' && item.sendMode === 'broadcast') {
    parts.push(`${partnerLabel(item)}님에게`)
  } else if (item.roomName && !item.toMyself) {
    parts.push(item.roomName)
  }

  if (item.sendMode === 'random') parts.push('랜덤')
  parts.push(formatRelativeTime(item.createdAt))

  return parts.filter(Boolean).join(' · ')
}

export function MessageList({
  box,
  items,
  hasMore,
  loading,
  error,
  onLoadMore,
  onRetry,
  onRefresh,
}: MessageListProps) {
  const firstLoad = loading && items.length === 0

  if (firstLoad) {
    return (
      <p aria-live="polite" className="py-10 text-center text-base text-muted">
        마음을 불러오고 있어요…
      </p>
    )
  }

  if (error && items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[14px] bg-surface-soft px-6 py-10 text-center">
        <p role="alert" className="text-base text-ink">
          {error}
        </p>
        <div className="w-full max-w-xs">
          <Button variant="secondary" fullWidth onClick={onRetry}>
            다시 시도
          </Button>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    /*
      빈 문구는 캡처 38·39 그대로다. 여기에 버튼을 달지 않는다 —
      화면 아래 고정 줄에 [🎙 마음 보내기]가 늘 있다(캡처 38). 같은 버튼을 두 번 두면
      어느 쪽을 눌러야 하는지 고민하게 만든다.
    */
    return (
      <EmptyState
        title={
          box === 'received' ? '아직 받은 마음이 없어요' : '아직 보낸 마음이 없어요'
        }
        description={
          box === 'received'
            ? '소중한 분과 나눈 마음이 여기에 차곡차곡 쌓여요.'
            : '아래 [마음 보내기]로 오늘 떠오른 마음을 남겨보세요.'
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <MessageCard
            key={item.id}
            box={box}
            item={item}
            onRefresh={onRefresh}
          />
        ))}
      </ul>

      {/* 목록 아래에서 생긴 오류는 이미 보고 있는 내용을 지우지 않고 아래에만 알린다. */}
      {error ? (
        <p
          role="alert"
          className="rounded-[14px] bg-primary-soft px-4 py-3 text-base text-primary"
        >
          {error}
        </p>
      ) : null}

      {hasMore ? (
        <Button
          variant="secondary"
          fullWidth
          onClick={onLoadMore}
          pending={loading}
          pendingText="불러오는 중이에요…"
        >
          더 보기
        </Button>
      ) : null}
    </div>
  )
}

function MessageCard({
  box,
  item,
  onRefresh,
}: {
  box: MailboxBox
  item: MailboxItem
  onRefresh: () => void
}) {
  const title = cardTitle(box, item)
  const meta = cardMeta(box, item)

  return (
    <Card as="li">
      <article className="flex items-center gap-3">
        {/*
          동그란 사진은 세로 가운데에 온다(캡처 46) — 이름·시각·재생바가 쌓인 칸 전체와
          짝을 이루는 표식이라 맨 윗줄에 붙이면 카드가 왼쪽으로 기울어 보인다.
        */}
        <AvatarCircle
          url={item.avatarUrl}
          name={title}
          size="xs"
          fallbackGradient={item.coverGradient}
          // 방 전체에 보낸 마음의 동그라미는 사람 사진이 아니라 방 커버다.
          alt={item.sendMode === 'broadcast' ? `${title} 커버 사진` : undefined}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="truncate text-lg font-extrabold text-ink">{title}</h2>
          <p className="truncate text-base text-muted">{meta}</p>

          {item.promptUsed ? (
            <p className="rounded-[8px] bg-surface-soft px-3 py-2 text-base leading-relaxed text-muted">
              {item.promptUsed}
            </p>
          ) : null}

          <MessageBody item={item} title={title} />

          {/*
            받은 마음에만 신고 버튼을 둔다.
            내가 보낸 것은 신고 대상이 아니고(신고 화면도 거절한다),
            보낸 분이 탈퇴했으면 조치할 상대가 없다.
            **나에게 보낸 마음도 받은함에 뜨지만** 신고할 상대가 나 자신이라 뺀다.
            돌아올 곳은 사서함이다 — 신고하고 나서 방으로 튕기면 보던 자리를 잃는다.
          */}
          {box === 'received' && !item.partnerWithdrawn && !item.toMyself ? (
            <div className="flex justify-end">
              <ReportButton
                targetType="heart_message"
                targetId={item.id}
                backTo="/mailbox"
                accessibleLabel={`${title}님이 보낸 마음 한마디 신고하기`}
              />
            </div>
          ) : null}
        </div>

        <FavoriteHeartButton
          messageId={item.id}
          label={`${title}의 마음`}
          favorited={item.favorited}
          onToggled={onRefresh}
        />
      </article>
    </Card>
  )
}

function MessageBody({ item, title }: { item: MailboxItem; title: string }) {
  /*
    답장 미션으로 잠긴 마음 (PRD [MISSION-01]).

    서버가 내용을 아예 안 실어 보내므로 여기서 가릴 것도 없다 — 대신 **왜 잠겼고
    어떻게 풀리는지**를 적는다. 잠긴 이유를 안 적으면 시니어 사용자에게는
    고장 난 카드로 보인다.
  */
  if (item.locked) return <LockedHeart item={item} />

  if (item.type === 'text') {
    return (
      <p className="mt-1 whitespace-pre-wrap break-words text-lg leading-relaxed text-ink">
        {item.text}
      </p>
    )
  }

  if (item.type === 'video') {
    if (!item.mediaUrl) return <MediaUnavailable kind="영상" />
    return (
      <video
        src={item.mediaUrl}
        controls
        preload="metadata"
        playsInline
        className="mt-1 w-full rounded-[14px] bg-surface-soft"
      />
    )
  }

  if (!item.mediaUrl) return <MediaUnavailable kind="음성" />

  /*
    재생바는 피드·게시물 상세와 **같은 부품**을 쓴다(캡처 46의 파형 알약 그대로).
    예전에는 이 파일이 자기 재생기를 따로 들고 있었는데, 그러면 같은 음성이
    화면마다 다르게 보이고 파형도 실제 소리와 무관한 그림이 된다.
  */
  return (
    <div className="mt-1">
      <VoicePlayer
        src={item.mediaUrl}
        durationSec={item.durationSec ?? 0}
        levels={item.voiceLevels}
        label={`${title}의 음성`}
        /*
          답장 미션의 "들었다"를 여기서 찍는다 (PRD [MISSION-01]).
          목록에 뜬 것만으로는 안 찍고 **실제로 재생했을 때**만 찍는다
          (사용자 결정 2026-08-19).

          기다리지 않는 이유: 표시가 늦어도 소리는 이미 나고 있다.
          실패해도 다음에 다시 틀면 또 시도하므로 화면을 막을 이유가 없다.
        */
        onFirstPlay={() => void markHeartRead(item.id)}
      />
    </div>
  )
}

/**
 * 잠긴 마음 자리.
 *
 * PRD는 "상대방에게 마음을 표현해보세요! 답장 후 확인이 가능합니다"를 띄우라고 한다.
 * 그 문장을 쓰되, 시니어 사용자가 무엇을 해야 하는지 알 수 있게 버튼까지 붙였다.
 */
function LockedHeart({ item }: { item: MailboxItem }) {
  const who = item.partnerName ?? '이분'

  return (
    <div className="mt-1 flex flex-col gap-3 rounded-[14px] bg-surface-soft px-4 py-4">
      <p className="text-base leading-relaxed break-keep text-ink">
        <span aria-hidden>🔒 </span>
        {who}님께 마음을 표현해보세요. 답장하면 이 마음을 확인할 수 있어요.
      </p>

      <p className="text-sm break-keep text-muted">
        {who}님이 보낸 마음 {item.unrepliedCount}개를 아직 답장하지 않았어요.
      </p>

      <ButtonLink href="/mailbox/send" variant="secondary">
        마음 보내기
      </ButtonLink>
    </div>
  )
}

function MediaUnavailable({ kind }: { kind: string }) {
  return (
    <p className="mt-1 rounded-[8px] bg-surface-soft px-4 py-3 text-base text-muted">
      {kind}을 불러오지 못했어요. 화면을 새로고침한 뒤 다시 열어봐 주세요.
    </p>
  )
}
