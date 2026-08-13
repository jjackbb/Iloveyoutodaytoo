import { ReportButton } from '@/components/report/ReportButton'
import { formatDuration, formatKstTime } from '@/lib/format'

/**
 * 마음 메시지 한 개.
 *
 * DB를 직접 보지 않는다. 필요한 값은 전부 props로 받는다.
 * (음성 파일은 비공개 버킷이라 방 화면이 서명된 URL을 만들어 넘겨준다)
 *
 * 여기 없는 것 = 일부러 뺀 것:
 * 좋아요·댓글·읽음 표시가 없다. 반응 수단은 "마음 메시지" 하나뿐이다(04_PROJECT_SPEC.md).
 */

/**
 * 탈퇴한 분의 이름 자리. 담담하게 이렇게 표시한다.
 *
 * 보낸 사람뿐 아니라 받는 사람에게도 쓴다 — sender_id·receiver_id 둘 다
 * ON DELETE SET NULL이라 어느 쪽이 탈퇴하든 id가 null이 되고 메시지는 남는다.
 * 방 화면(rooms/[roomId]/page.tsx)이 receiverName에도 이 값을 넘긴다.
 * 사서함(message-list.tsx)과 preview_invitation(SQL)도 같은 문구를 쓰므로,
 * 바꿀 때는 세 곳을 함께 봐야 한다.
 */
export const WITHDRAWN_SENDER_NAME = '탈퇴한 사용자'

export interface MessageBubbleProps {
  type: 'text' | 'voice' | 'video'
  /** 텍스트면 본문. 음성이면 쓰지 않는다(audioUrl을 쓴다). */
  content: string
  /** 보낸 사람 이름. 탈퇴했으면 null. */
  senderName: string | null
  /** 내가 보낸 메시지인지. 오른쪽에 붙고 색이 달라진다. */
  isMine: boolean
  /** 남긴 시각. heart_messages.created_at (UTC ISO 문자열) */
  createdAt: string
  /** 음성 길이(초). heart_messages.duration_sec */
  durationSec?: number | null
  /**
   * 음성 재생 주소. 비공개 버킷이라 서명된 URL이 들어온다.
   * 만들지 못했으면 null — 그때는 안내 문구를 대신 보여준다.
   */
  audioUrl?: string | null
  /** 3명 이상인 방에서 "누구에게 보냈는지" 보여줄 때만 준다. */
  receiverName?: string | null
  /**
   * 이 메시지의 id(heart_messages.id).
   * 주면 남이 보낸 마음 아래에 신고 버튼이 붙는다. 안 주면 아무것도 붙지 않는다.
   */
  reportTargetId?: string
  /** 신고를 마치거나 그만두었을 때 돌아올 경로. 예: `/rooms/${roomId}` */
  reportBackTo?: string
  /** 목록 안에서 쓰므로 기본은 'li'. */
  as?: 'li' | 'div'
}

export function MessageBubble({
  type,
  content,
  senderName,
  isMine,
  createdAt,
  durationSec,
  audioUrl,
  receiverName,
  reportTargetId,
  reportBackTo,
  as = 'li',
}: MessageBubbleProps) {
  const Element = as
  const displayName = senderName ?? WITHDRAWN_SENDER_NAME
  const withdrawn = senderName === null

  // 신고 버튼을 붙일지.
  // 내가 쓴 글은 신고 대상이 아니고(신고 화면도 거절한다),
  // 탈퇴한 분의 글은 조치할 상대가 남아 있지 않아 붙이지 않는다.
  const canReport = Boolean(reportTargetId) && !isMine && !withdrawn

  // 내 말풍선은 연한 강조 배경, 상대 말풍선은 보조면.
  // 흰 글자는 bg-primary 위에만 올린다는 규칙이 있어 여기서는 글자를 항상 ink로 둔다.
  // 내 것은 분홍, 상대 것은 흰색이다.
  // 예전에는 둘 다 옅은 회색·분홍이라 바탕색이 따뜻해진 뒤로 거의 구분되지 않았다.
  const bubbleTone = isMine ? 'bg-primary-soft' : 'bg-card shadow-pill'

  return (
    <Element
      className={[
        'flex flex-col gap-1',
        isMine ? 'items-end' : 'items-start',
      ].join(' ')}
    >
      {/*
        보낸 사람 · 받는 사람 · 시각. 본문과 같은 17px이고,
        위계는 크기가 아니라 굵기(font-medium)와 색(text-muted)으로만 준다.
        세 조각이 17px이면 좁은 화면에서 한 줄을 넘길 수 있어 말풍선 폭에 맞춰 접히게 둔다.
      */}
      <div
        className={[
          'flex max-w-[85%] flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1',
          isMine ? 'justify-end' : 'justify-start',
        ].join(' ')}
      >
        <span
          className={[
            'text-base font-medium',
            withdrawn ? 'text-muted' : 'text-ink',
          ].join(' ')}
        >
          {isMine ? '나' : displayName}
        </span>

        {receiverName ? (
          <span className="text-base text-muted">→ {receiverName}</span>
        ) : null}

        {/* 시각은 곁들이는 정보라 한 단계 작은 15px을 쓴다. 이름은 17px 그대로다. */}
        <time
          dateTime={createdAt}
          className="whitespace-nowrap text-sm text-muted"
        >
          {formatKstTime(createdAt)}
        </time>
      </div>

      <div
        className={['max-w-[85%] rounded-inner px-4 py-3', bubbleTone].join(
          ' ',
        )}
      >
        {type === 'voice' ? (
          <div className="flex flex-col gap-2">
            <audio
              controls
              preload="none"
              // 비공개 버킷이라 서명된 URL이 필요하다. 없으면 재생할 수 없다.
              src={audioUrl ?? undefined}
              className="h-11 w-full min-w-[220px]"
            >
              음성을 재생할 수 없는 브라우저예요.
            </audio>

            {/*
              길이(duration_sec)는 nullable이다. 녹음 길이를 못 읽은 채 저장되면
              formatDuration이 빈 문자열을 돌려주는데, 그대로 이으면 "음성 "만 남는다.
              길이를 모를 때는 길이를 말하지 않는다 — 없는 정보를 지어내지 않는다.
            */}
            <p className="text-base leading-relaxed text-muted">
              {!audioUrl
                ? '음성을 불러오지 못했어요. 잠시 후 다시 열어주세요.'
                : formatDuration(durationSec)
                  ? `음성 ${formatDuration(durationSec)}`
                  : '음성 메시지'}
            </p>
          </div>
        ) : type === 'video' ? (
          // 영상 메시지는 아직 이 화면에서 재생하지 않는다.
          // 파일 경로가 그대로 노출되지 않도록 안내만 보여준다.
          <p className="text-lg leading-relaxed text-muted">
            영상 메시지예요. 곧 여기서 볼 수 있게 준비하고 있어요.
          </p>
        ) : (
          // 줄바꿈을 그대로 살린다. 사용자가 엔터로 나눈 문장이 뭉치면 읽기 힘들다.
          <p className="whitespace-pre-wrap break-words text-lg leading-relaxed text-ink">
            {content}
          </p>
        )}
      </div>

      {/*
        신고는 말풍선 바깥 아래에 작게 둔다.
        이 화면의 주인공은 언제나 마음 한마디다 — 신고가 그보다 눈에 띄면 안 된다.
        목록에 버튼이 여럿 놓이므로 낭독기에는 누가 남긴 글인지까지 읽어준다.
      */}
      {canReport && reportTargetId ? (
        <ReportButton
          targetType="heart_message"
          targetId={reportTargetId}
          backTo={reportBackTo}
          accessibleLabel={`${displayName}님이 남긴 마음 한마디 신고하기`}
        />
      ) : null}
    </Element>
  )
}
