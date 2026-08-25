import type { Metadata } from 'next'

import { requireUser } from '@/lib/auth'
import { BrandMark } from '@/components/brand/BrandMark'
import { createClient } from '@/lib/supabase/server'
import { RoomCard } from '@/components/room/RoomCard'
import { ButtonLink } from '@/components/ui/Button'
import { BottomNav } from '@/components/nav/BottomNav'
import { NotificationBell } from '@/components/notification/NotificationBell'
import { loadNotifications } from '@/lib/notifications'
import { resolveRoomCover, roomDisplayName } from '@/lib/room-name'

export const metadata: Metadata = { title: '오늘도 사랑해' }

/** 커버 사진 주소의 유효 시간(초). 홈을 오래 열어둬도 안 끊길 만큼만. */
const COVER_URL_TTL_SEC = 60 * 60

/**
 * 홈 — 내가 속한 앨범방 목록 (캡처 04 빈 화면 / 캡처 37 카드).
 *
 * 이 목록이 곧 "친구 목록" 역할을 한다. 별도의 친구 화면은 만들지 않는다.
 *
 * 화면 구조는 appbar(고정) / body(스크롤) / action-bar(고정) / 탭(고정) 3단이다.
 * 공용 TabScreen을 쓰지 않고 여기서 직접 짠 이유는 아래 셸 주석에 적었다.
 *
 * 정렬은 **즐겨찾기한 방이 먼저**다(캡처 37의 ♡). 그 안에서는 들어온 순서를 지킨다.
 * 정렬을 서버에서 하는 이유: ♡를 누르면 revalidatePath('/')로 이 함수가 다시 돌고
 * 순서까지 새로 계산되어 내려간다. 클라이언트가 목록을 직접 재정렬하지 않는다.
 */
export default async function HomePage() {
  const user = await requireUser()
  const supabase = await createClient()

  // 알림은 방 목록과 무관하니 같이 출발시킨다 — 순서대로 기다리면 그만큼 늦어진다.
  const notificationsPromise = loadNotifications()

  // RLS가 걸려 있어 내가 속한 방만 돌아온다. 방을 나간(left) 기록은 제외한다.
  const { data: memberships, error } = await supabase
    .from('room_members')
    .select(
      // custom_* 는 내가 이 방을 어떻게 부르고 어떻게 보이길 바라는지다(나만 본다).
      'id, joined_at, favorited, custom_name, custom_cover_preset, custom_cover_path, rooms(id, name, created_at, cover_preset, cover_path)',
    )
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })

  if (error) {
    console.error('[홈] 앨범방 목록 조회 실패:', error.message)
  }

  // 즐겨찾기가 먼저. 그 안에서는 DB가 준 순서(들어온 순)를 그대로 둔다.
  // sort는 원본을 바꾸므로 복사본에 건다.
  const rows = [...(memberships ?? [])].sort((a, b) => {
    if (a.favorited === b.favorited) return 0
    return a.favorited ? -1 : 1
  })

  const notifications = await notificationsPromise

  const roomIds = rows.map((row) => row.rooms?.id).filter((id) => id != null)

  // 멤버 이름과 게시물은 방마다 따로 묻지 않고 한 번에 가져와 방별로 묶는다.
  // (방이 늘어날수록 질의가 같이 늘어나는 구조를 만들지 않는다)
  const [membersResult, memoriesResult] = await Promise.all([
    roomIds.length > 0
      ? supabase
          .from('room_members')
          // nickname: 방마다 정해둔 별명이 있으면 그 이름으로 보여야 한다(@/lib/member-name).
          .select('room_id, user_id, nickname, users(name)')
          .in('room_id', roomIds)
          .eq('status', 'active')
      : Promise.resolve({ data: [], error: null }),
    /*
      게시물 수와 마지막 활동 시각.

      heart_messages가 아니라 memories를 센다. heart_messages의 RLS는
      "내가 보냈거나 내가 받은 것"만 보여주는 1:1 사서함용이라, 그것으로 세면
      멤버가 여럿인 방에서 남이 올린 글이 빠진 수가 나온다.
      memories의 RLS는 is_room_member(room_id)라 방 안에서 모두가 같은 수를 본다 —
      "게시물 N개"가 사람마다 다르면 안 된다.
      (다음 단계에서 추억 게시물 스키마가 이 테이블 위에 확장된다)
    */
    roomIds.length > 0
      ? supabase
          .from('memories')
          .select('room_id, created_at')
          .in('room_id', roomIds)
          // 지운 글은 행이 남아 있을 뿐 없는 것이다(소프트 삭제).
          // 이 조건이 빠지면 홈의 "게시물 N개"가 방 안에서 실제로 보이는 수보다 많아진다.
          .is('deleted_at', null)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (membersResult.error) {
    // 이름을 못 읽어도 카드는 그린다. 아바타 자리만 비어 보일 뿐이다.
    console.error('[홈] 멤버 조회 실패:', membersResult.error.message)
  }
  if (memoriesResult.error) {
    console.error('[홈] 게시물 조회 실패:', memoriesResult.error.message)
  }

  const namesByRoom = new Map<string, string[]>()
  for (const member of membersResult.data ?? []) {
    if (!member.room_id) continue
    const list = namesByRoom.get(member.room_id) ?? []
    /*
      이름을 못 읽는 경우(탈퇴)에도 자리는 남긴다 — 인원수가 실제와 어긋나면 안 된다.
      그래서 여기서는 roomMemberName의 기본 문구('알 수 없는 사람')를 쓰지 않고 빈 칸으로 둔다.
      아바타는 첫 글자만 쓰므로 긴 문구가 들어가면 오히려 이상해진다.
    */
    const nickname = member.nickname?.trim()
    list.push(nickname || member.users?.name || '')
    namesByRoom.set(member.room_id, list)
  }

  // 방마다 게시물 수와 가장 최근 게시물 시각을 한 번에 접는다.
  const postCountByRoom = new Map<string, number>()
  const lastPostAtByRoom = new Map<string, string>()
  for (const memory of memoriesResult.data ?? []) {
    if (!memory.room_id) continue
    postCountByRoom.set(
      memory.room_id,
      (postCountByRoom.get(memory.room_id) ?? 0) + 1,
    )
    const seen = lastPostAtByRoom.get(memory.room_id)
    if (!seen || memory.created_at > seen) {
      lastPostAtByRoom.set(memory.room_id, memory.created_at)
    }
  }

  // 직접 올린 커버는 비공개 버킷이라 서명된 주소가 필요하다.
  // 프리셋만 쓰는 방은 여기 해당이 없어서 요청 자체를 보내지 않는다.
  const coverPaths = rows
    .map((row) => resolveRoomCover({
      coverPath: row.rooms?.cover_path,
      coverPreset: row.rooms?.cover_preset,
      customCoverPath: row.custom_cover_path,
      customCoverPreset: row.custom_cover_preset,
    }).path)
    .filter((path): path is string => Boolean(path))

  const coverUrlByPath = new Map<string, string>()
  if (coverPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('covers')
      .createSignedUrls(coverPaths, COVER_URL_TTL_SEC)

    for (const item of signed ?? []) {
      if (item.path && item.signedUrl && !item.error) {
        coverUrlByPath.set(item.path, item.signedUrl)
      }
    }
  }

  // 프로토타입은 방이 없을 때 body에 `center`를 붙여 세로 가운데로 모은다(.body.center).
  // 카드 목록일 때는 위에서부터 쌓인다.
  const isEmpty = !error && rows.length === 0

  return (
    // 100dvh: 모바일 브라우저 주소창이 접혔다 펴져도 높이가 흔들리지 않는다.
    //
    // 공용 TabScreen을 쓰지 않는다. 그쪽은 "제목 + 본문"을 전제로 짜여 있어
    // 프로토타입 #home의 브랜드 앱바·빈 화면 세로 정렬을 표현하려면 옵션을 계속 붙여야 한다.
    // 홈은 프로토타입 마크업이 정답이므로 여기서 직접 3단으로 쌓았다.
    // (다른 화면은 아직 TabScreen을 쓴다 — 화면들이 다 옮겨진 뒤에 공통 부품을 다시 뽑는다)
    <div className="flex h-[100dvh] flex-col">
      {/*
        appbar (프로토타입 .appbar — padding 6px 20px 12px, 아래 구분선 없음).
        바탕색이 페이지와 같아 선이 없어야 이어져 보인다. 카드가 흰색이라 스크롤하면 경계가 저절로 생긴다.
      */}
      <header className="shrink-0 bg-canvas">
        <div className="mx-auto flex w-full max-w-md items-center gap-2 px-screen-x pt-1.5 pb-3">
          {/*
            프로토타입 .brand — 하트 + 서비스 이름이 곧 이 화면의 제목이다(19px/900).
            오른쪽 알림 종(.iconbtn)은 5-B단계에서 붙였다 — 그전까지는 눌러도
            아무 일이 없는 껍데기라 일부러 비워두고 있었다.
          */}
          <h1 className="flex min-w-0 flex-1 items-center gap-2 truncate text-2xl font-bold tracking-[-0.02em] text-ink">
            <BrandMark size={24} />
            오늘도 사랑해
          </h1>

          <NotificationBell items={notifications} />
        </div>
      </header>

      {/* body (프로토타입 .body — flex:1, 여기만 스크롤된다, padding 2px 20px 22px) */}
      <main
        className={[
          'min-h-0 flex-1 overflow-y-auto',
          isEmpty ? 'flex flex-col' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/*
          빈 화면을 세로 가운데로 모을 때 부모에 justify-center를 주면 안 된다 —
          내용이 뷰포트보다 길어지면(글자 크게 설정·세로가 짧은 기기) 위로 넘친 부분이
          스크롤 영역 밖으로 밀려나 영영 못 본다.
          my-auto는 자리가 남을 때만 가운데로 모으고, 모자라면 0이 되어 위에서부터 쌓인다.
        */}
        <div
          className={[
            'mx-auto w-full max-w-md px-screen-x pt-0.5 pb-screen-b',
            isEmpty ? 'my-auto' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {error ? (
            <p
              role="alert"
              className="rounded-inner bg-surface-soft px-4 py-4 text-base leading-relaxed text-ink"
            >
              앨범방을 불러오지 못했어요. 잠시 후 다시 열어봐 주세요.
            </p>
          ) : rows.length > 0 ? (
            /*
              보이는 섹션 제목은 두지 않는다 — 캡처에 없고, 앱바가 이미 어느 화면인지 말한다.
              낭독기에는 목록 이름이 있어야 하므로 제목 대신 목록 자체에 이름을 붙였다.
              mt-card·gap-card(14px)는 프로토타입 .album-card의 margin-top 실측값이다.
            */
            <ul
              aria-label="나의 앨범방"
              className="mt-card flex flex-col gap-card"
            >
              {rows.map((row) => {
                const room = row.rooms
                if (!room) return null

                // 이름도 커버도 **내 화면 기준**으로 고른다. 내가 바꾼 것이 있으면 그것,
                // 없으면 방을 만들 때 정해진 값이다(@/lib/room-name).
                const cover = resolveRoomCover({
                  coverPreset: room.cover_preset,
                  coverPath: room.cover_path,
                  customCoverPreset: row.custom_cover_preset,
                  customCoverPath: row.custom_cover_path,
                })

                return (
                  <RoomCard
                    key={row.id}
                    as="li"
                    roomId={room.id}
                    name={roomDisplayName({
                      name: room.name,
                      customName: row.custom_name,
                    })}
                    coverPreset={cover.preset}
                    coverUrl={
                      cover.path ? (coverUrlByPath.get(cover.path) ?? null) : null
                    }
                    memberNames={namesByRoom.get(room.id) ?? []}
                    postCount={postCountByRoom.get(room.id) ?? 0}
                    // 아직 게시물이 없으면 방을 만든 시각을 쓴다 —
                    // 갓 만든 방도 "방금 전"으로 읽혀야 자연스럽다(캡처 37).
                    lastActivityAt={
                      lastPostAtByRoom.get(room.id) ?? room.created_at
                    }
                    favorited={row.favorited}
                  />
                )
              })}
            </ul>
          ) : (
            <EmptyHero />
          )}
        </div>
      </main>

      {/*
        action-bar (프로토타입 .action-bar — 고정, 위쪽 1px 선, 흰 바탕).
        방이 있든 없든 같은 자리에 있다. 아무것도 없는 화면일수록
        "무엇을 하면 되는지"가 늘 손 닿는 곳에 있어야 한다.
      */}
      <div className="shrink-0 border-t border-hairline bg-card px-screen-x py-3">
        <div className="mx-auto w-full max-w-md">
          <ButtonLink href="/rooms/new" fullWidth>
            새로운 앨범방 만들기
          </ButtonLink>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

/**
 * 아직 방이 하나도 없을 때(프로토타입 .empty-hero).
 *
 * 버튼을 여기 달지 않는다 — 아래 고정 줄에 이미 같은 버튼이 있다(프로토타입도 같다).
 * 공용 EmptyState 대신 여기서 직접 짰다: 프로토타입은 제목이 <h2>라 낭독기에서
 * 화면 안 구획으로 읽히는데, EmptyState는 <p>로 그린다.
 */
function EmptyHero() {
  return (
    // 26px 모서리·40/24/34 여백·흰색→분홍 그라데이션은 프로토타입 .empty-hero 실측값이다.
    // 테두리 색만 우리 토큰(hairline)으로 바꿨다 — 프로토타입의 #FBEAEF는 검증을 거치지 않은 색이다.
    <div className="mt-4 rounded-[26px] border border-hairline bg-linear-to-b from-card to-primary-soft px-6 pt-10 pb-8 text-center shadow-card">
      {/*
        118px 원은 프로토타입 .empty-emoji 실측값이다. 색만 우리 토큰으로 바꿨다 —
        프로토타입의 분홍 그라데이션(#FFE1E9→#FFC9D8)은 대비 검증을 거치지 않았다.
        장식이라 낭독기에서는 숨긴다. 뜻은 아래 글이 이미 말해준다.
      */}
      <div
        aria-hidden
        className="mx-auto mb-5 flex h-[118px] w-[118px] items-center justify-center rounded-full bg-primary-soft text-primary"
      >
        <PhotoIcon />
      </div>

      {/*
        문구는 캡처 04 그대로다. 이전에 내가 "아직 만든 앨범방이 없어요"로 바꿨던 것은
        캡처가 기준이 되면서 되돌렸다.

        break-keep: 한글이 낱말 중간에서 잘리지 않게 한다.
        캡처는 <br>로 줄을 직접 끊었지만, 글자 크기를 키운 우리 화면에서는
        좁은 기기에서 어색하게 남는다. 끊는 자리는 기기 너비에 맡긴다.
      */}
      <h2 className="text-2xl leading-snug font-bold tracking-[-0.02em] break-keep text-ink">
        아직 연결된 소중한 공간이 없어요
      </h2>

      <p className="mt-3 text-base leading-relaxed font-medium break-keep text-muted">
        우리만의 첫 번째 앨범방을 만들고 소중한 사람들을 초대해 보세요.
      </p>
    </div>
  )
}

/**
 * 빈 홈의 사진 그림(프로토타입 #i-image, 52px 선 아이콘).
 * 아직 아무것도 담기지 않은 앨범을 뜻한다.
 */
function PhotoIcon() {
  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4.5" width="18" height="15" rx="3" />
      <circle cx="8.6" cy="9.8" r="1.7" />
      <path d="m4 17 4.6-4.4a2 2 0 0 1 2.7 0L16 17" />
      <path d="m14 14.4 1.6-1.5a2 2 0 0 1 2.7 0L21 15.4" />
    </svg>
  )
}
