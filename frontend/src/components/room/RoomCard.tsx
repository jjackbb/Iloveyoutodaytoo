import Link from 'next/link'

import { FavoriteButton } from '@/components/room/FavoriteButton'
import { MemberStack } from '@/components/room/MemberStack'
import { coverStyle } from '@/lib/covers'
import { formatRelativeTime } from '@/lib/format'
import type { Enums } from '@/types/database'

/**
 * 홈에 늘어놓는 앨범방 카드 (캡처 37).
 *
 * 커버 위에 정보가 얹히고, 이름과 정보 줄이 그 아래에 놓인다.
 *   좌상 [초대] 칩 / 우상 ♡ 즐겨찾기 / 좌하 멤버 아바타
 *   아래: 방 이름 + "멤버 N명 · 게시물 N개 · 방금 전"
 *
 * 관계유형 라벨과 생성일은 더 이상 보여주지 않는다 — 캡처에 없다.
 * 연속일수 배지도 뺐다. 그 자리는 캡처대로 ♡ 즐겨찾기가 쓴다.
 *
 * 이 컴포넌트는 DB를 직접 보지 않는다. 필요한 값은 전부 props로 받는다.
 */

/**
 * relationship_type을 화면에 보여줄 한글 이름으로.
 *
 * ⚠️ 새 앨범방은 이 값을 갖지 않는다(캡처 기준 개정으로 입력받지 않는다).
 * 예전에 만든 방의 값을 사서함·방 화면에서 보여줄 때만 남아 있다.
 */
export const RELATIONSHIP_TYPE_LABEL: Record<
  Enums<'relationship_type'>,
  string
> = {
  family: '가족',
  lover: '연인',
  friend: '친구',
  self: '나 자신',
}

export function relationshipTypeLabel(
  type: Enums<'relationship_type'> | string | null | undefined,
): string {
  if (!type) return ''
  return (
    RELATIONSHIP_TYPE_LABEL[type as Enums<'relationship_type'>] ?? String(type)
  )
}

export interface RoomCardProps {
  roomId: string
  /** 앨범방 이름. 예: "우리 가족 행복방" */
  name: string
  /** 커버 프리셋 키(rooms.cover_preset). */
  coverPreset: string
  /** 직접 올린 커버의 서명된 주소. 없으면 프리셋 그라데이션이 쓰인다. */
  coverUrl?: string | null
  /** 이 방의 활성 멤버 이름들. 아바타 더미를 그리는 데 쓴다. */
  memberNames: string[]
  /** 이 방에 쌓인 게시물 수. */
  postCount: number
  /** 마지막 활동 시각. 없으면(아직 아무것도 없으면) 방을 만든 시각. */
  lastActivityAt?: string | null
  /** 내가 이 방을 즐겨찾기했는지(room_members.favorited). */
  favorited: boolean
  /** 목록 안에서 쓰므로 기본은 'li'. */
  as?: 'li' | 'div'
}

export function RoomCard({
  roomId,
  name,
  coverPreset,
  coverUrl,
  memberNames,
  postCount,
  lastActivityAt,
  favorited,
  as: Element = 'li',
}: RoomCardProps) {
  const lastActivity = formatRelativeTime(lastActivityAt)

  return (
    <Element className="relative list-none overflow-hidden rounded-card bg-card shadow-card">
      {/*
        비율 2:1(aspect-[2/1])은 프로토타입 실측(402px 폭에서 158px 높이)이 아니라
        cover-crop-dialog.tsx의 COVER_ASPECT와 반드시 같아야 하는 값이다.
        전에는 h-[158px] 고정이라 폭이 넓어지면 실제 비율이 2.76:1까지 벌어져
        "밝은 틀 안이 커버가 돼요"라는 크롭창 안내가 거짓이 됐다(위·아래 최대 14%가
        화면마다 다르게 잘려나감). 비율을 고정하면 어느 화면 폭에서도 크롭 결과와
        정확히 일치한다.

        아래쪽 어두운 겹은 프로토타입 .album-photo를 그대로 가져왔다.
        겹을 before로 두는 이유: 아바타 더미(아래 absolute)가 DOM 순서상 뒤에 와서
        z-index를 손대지 않아도 겹 위에 그려진다. z-index를 쓰면 카드 전체 링크(제목의 after)와
        누가 위인지 다투게 된다.
      */}
      <div
        className="relative aspect-[2/1] bg-surface-soft before:absolute before:inset-0 before:bg-linear-to-b before:from-transparent before:from-55% before:to-black/30 before:content-['']"
        style={coverStyle(coverPreset, coverUrl)}
      >
        {/*
          커버 맨 윗줄: 왼쪽 [초대] 칩, 오른쪽 ♡ 즐겨찾기.
          각각 absolute로 붙이면 서로의 폭을 몰라서 좁은 기기(320px)에서 겹친다 —
          한 줄(flex)로 묶어 양끝으로 밀면 보이는 결과는 같으면서 절대 겹치지 않는다.

          감싸개에는 z-index를 주지 않는다. 안에 있는 두 버튼이 각자 z-10으로 올라간다.
        */}
        <div className="absolute inset-x-3 top-3 flex items-start gap-2">
          {/*
            커버 위 칩은 어떤 색 위에 놓일지 알 수 없다. 그래서 흰 알약을 깔고
            그 위에 글자를 올린다 — 커버가 밝든 어둡든 대비가 유지된다.

            초대는 모든 방에서 열어 둔다. 예전에는 '나 자신' 방만 막았는데,
            그 관계 구분 자체가 없어졌다(_workspace/03_capture_flow.md).
          */}
          <Link
            href={`/rooms/${roomId}/invite`}
            // 방이 여러 개면 낭독기에 '초대' 링크가 같은 이름으로 반복된다.
            // 어느 방으로 부르는 초대인지 링크 이름만 듣고 알 수 있어야 한다(WCAG 2.4.4).
            aria-label={`${name} 앨범방에 초대하기`}
            // z-10: 아래 카드 전체 링크(after:inset-0)보다 위에 있어야 눌린다.
            className="z-10 inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-chip bg-card/95 px-3.5 text-base font-extrabold text-primary shadow-chip active:bg-primary-soft"
          >
            <PeopleIcon />
            초대
          </Link>

          {/*
            ml-auto: 오른쪽 끝에 붙는다.
            relative z-10: **이 감싸개에 걸어야 한다.** z-index는 자리를 잡은(positioned)
            요소에만 듣는데, 감싸개 안의 버튼은 static이라 버튼에 z-10을 줘도 아무 일도 안 난다.
            그러면 카드 전체를 방으로 들여보내는 덮개가 하트 위를 덮어, 하트를 눌러도
            방으로 들어가 버린다(실제로 그랬다).
          */}
          <span className="relative z-10 ml-auto">
            <FavoriteButton
              roomId={roomId}
              roomName={name}
              favorited={favorited}
            />
          </span>
        </div>

        <div className="absolute bottom-3 left-3">
          <MemberStack names={memberNames} />
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        {/*
          카드 전체를 <a>로 감싸지 않는다. 안에 '초대' 링크와 ♡ 버튼이 또 있어서
          링크 안에 링크가 되면 안 되기 때문이다.
          대신 제목 링크를 카드 전체로 늘려(after:inset-0) 어디를 눌러도 방으로 들어가게 한다.
        */}
        <h3 className="truncate text-xl font-extrabold text-ink">
          <Link
            href={`/rooms/${roomId}`}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {name}
          </Link>
        </h3>

        {/*
          정보 줄 (캡처 37: "멤버 1명 · 게시물 1개 · 방금 전").
          15px(text-sm)는 커밋 34ae7e6에서 "장식성 정보(시각·카드 부제)에만 15px 한 단계 허용"으로
          승인된 예외다. 제목·버튼은 17px을 지킨다.

          flex-wrap: 세 조각이 한 줄에 안 들어가면 글자를 줄이지 않고 아래로 접는다.
        */}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted">
          <span>멤버 {memberNames.length}명</span>
          <Dot />
          <span>게시물 {postCount}개</span>
          {lastActivity ? (
            <>
              <Dot />
              <span>{lastActivity}</span>
            </>
          ) : null}
        </p>
      </div>
    </Element>
  )
}

/** 항목 사이를 잇는 작은 점. 장식이라 낭독기에서는 읽지 않는다. */
function Dot() {
  return (
    <span
      aria-hidden
      className="inline-block h-[3px] w-[3px] shrink-0 rounded-full bg-muted"
    />
  )
}

function PeopleIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c0-3 2.5-4.6 5.5-4.6s5.5 1.6 5.5 4.6" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 6.2" />
      <path d="M18 14.6c2.2.5 3.5 2 3.5 4.4" />
    </svg>
  )
}
