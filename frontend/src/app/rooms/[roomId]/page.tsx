import type { Metadata } from 'next'

import { MoreDrawer } from './more-drawer'
import { MemoryCard } from '@/components/memory/MemoryCard'
import { BottomNav } from '@/components/nav/BottomNav'
import { RoomAppBar, RoomAppBarLink } from '@/components/room/RoomAppBar'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Toast } from '@/components/ui/Toast'
import { requireUser } from '@/lib/auth'
import {
  buildMemoryCards,
  loadHiddenMemoryIds,
  MEMORY_CARD_SELECT,
} from '@/lib/room-feed'
import { createClient } from '@/lib/supabase/server'
import { FeedItem, FeedScroll } from '@/app/rooms/[roomId]/feed-scroll'
import { FeedSearch, type FeedAuthor } from '@/app/rooms/[roomId]/feed-search'
import { roomMemberName } from '@/lib/member-name'
import { loadRoomName } from '@/lib/room-look'

export const metadata: Metadata = { title: '앨범방 · 오늘도 사랑해' }

/** 한 번에 불러올 게시물 수. 최근 것부터 가져온다. */
const MEMORY_PAGE_SIZE = 30

/** 더보기 서랍의 갤러리 미리보기에 놓을 사진 수 (캡처 `참고/앨범방_더보기.png`). */
const GALLERY_PREVIEW_COUNT = 3

/**
 * 찾는 동안 읽어올 게시물 수.
 *
 * 찾기는 목록을 거르지 않고 **그 자리로 데려가는** 방식이라, 찾은 게시물이 화면에
 * 실제로 있어야 한다. 평소 30개만 읽으면 조금만 옛날 것이어도 갈 곳이 없다.
 * 이보다 더 오래된 것은 아직 못 간다 — 피드에 더보기(페이지네이션)가 생기면 그때 잇는다.
 */
const SEARCH_FEED_LIMIT = 200

/**
 * 앨범방 상세 — 추억 피드 (캡처 10 빈 화면 / 캡처 22 게시물).
 *
 * 화면은 홈과 같은 4단이다: 머리띠(고정) / 피드(스크롤) / [마음 표현하기](고정) / 탭.
 *
 * 데이터는 요청마다 서버가 DB에서 읽는다. 클라이언트가 목록을 들고 있지 않으므로
 * 글을 남기고 돌아오면(revalidatePath) 늘 서버가 센 그대로가 보인다.
 *
 * 보이는 범위는 RLS(`is_room_member(room_id)`)가 정한다 — 방 안의 모두가 같은 피드를 본다.
 * 예전 이 화면이 보여주던 heart_messages(1:1 마음)는 지우지 않았다. 그건 사서함의 것이고,
 * 이 화면에서 안 보일 뿐이다.
 */
/**
 * 그 다음 날의 날짜 키. "2026-08-31" → "2026-09-01".
 *
 * Date를 UTC로만 다뤄 서버 시간대에 흔들리지 않게 한다 —
 * 이 값은 시각이 아니라 **날짜 이름**이다.
 */
function nextKstDay(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

export default async function RoomPage({
  params,
  searchParams,
}: PageProps<'/rooms/[roomId]'>) {
  const { roomId } = await params
  const query = await searchParams

  // 방을 막 만들고 넘어왔는지(캡처 10의 "앨범방이 만들어졌어요 🎉").
  // 만든 쪽에서 상태를 들고 오지 않고 주소로만 알린다 — 새로고침하면 자연히 사라진다.
  const justCreated = query.created === '1'

  /*
    찾아보기 조건 (노션 IA 3.4·6.8). **주소에만 있다.**
    화면이 들고 있지 않으므로 뒤로가기로 되돌아가고, 그 화면을 그대로 다시 열 수 있다.

    형식이 어긋난 값은 조용히 버린다(null). 여기서 오류를 띄울 일이 아니다 —
    주소를 손으로 고쳤거나 옛 링크를 열었을 뿐이고, 그때는 그냥 전체를 보여주면 된다.
  */
  const who = typeof query.who === 'string' && query.who ? query.who : null
  const on =
    typeof query.on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.on)
      ? query.on
      : null
  /*
    글자로 찾기 (카카오톡 채팅방의 돋보기와 같은 것).
    사람·날짜 필터보다 **이쪽이 본체**다 — 돋보기를 누르는 이유의 대부분은
    "그 말 어디 있더라"이기 때문이다(_workspace/12_ux_baseline.md).
    앞뒤 공백만 있는 값은 안 찾은 것으로 본다.
  */
  const q =
    typeof query.q === 'string' && query.q.trim() ? query.q.trim() : null

  const searchOpen =
    query.find === '1' || who !== null || on !== null || q !== null

  // 멤버인지는 layout.tsx가 이미 확인했다. 여기서 사람을 다시 읽는 것은
  // **누구의 화면인지**를 알아야 하기 때문이다 — 좋아요·저장·숨김은 사람마다 다르고,
  // 수정·삭제는 자기 글에만 보인다.
  const viewer = await requireUser()
  const supabase = await createClient()

  /*
    내가 숨긴 글은 목록에 **들어오기 전에** 걸러야 한다.
    30개를 가져온 뒤에 빼면 숨긴 만큼 화면이 짧아진다.
  */
  const [roomNameResult, hiddenIds] = await Promise.all([
    // 방 이름은 사람마다 다를 수 있다 — 내가 바꿔 부르는 이름이 있으면 그것이다(@/lib/room-look).
    loadRoomName(roomId),
    loadHiddenMemoryIds(supabase, roomId, viewer.id),
  ])

  const roomName = roomNameResult ?? '앨범방'

  /*
    찾는 중이면 피드를 더 많이 가져온다.

    **찾기는 목록을 거르지 않고 그 자리로 데려간다**(카카오톡 채팅방 검색과 같다.
    사용자 결정 2026-08-20 — "걸러서 보기는 필요없어"). 그러려면 찾은 게시물이
    화면에 실제로 있어야 하므로, 찾는 동안에는 범위를 넓혀서 읽는다.
  */
  const feedLimit = searchOpen ? SEARCH_FEED_LIMIT : MEMORY_PAGE_SIZE

  const memoriesQuery = supabase
    .from('memories')
    .select(MEMORY_CARD_SELECT)
    .eq('room_id', roomId)
    // 지운 글은 행이 남아 있을 뿐 없는 것이다(소프트 삭제). 모든 조회가 이 조건을 건다.
    .is('deleted_at', null)
    /*
      고정된 글이 맨 위, 그 아래는 최신순.
      nullsFirst를 끄지 않으면 내림차순의 기본값이 NULLS FIRST라 **고정 안 된 글이 위로 온다**
      (고정 안 한 글의 pinned_at이 null이므로). 한 방에 고정은 하나라 결과는 "고정 1개 + 최신순"이다.
    */
    .order('pinned_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(feedLimit)

  const memoriesResult = await (hiddenIds.length > 0
    ? memoriesQuery.not('id', 'in', `(${hiddenIds.join(',')})`)
    : memoriesQuery)


  // 사진 서명·좋아요·저장·이름 정하기는 전부 여기서 끝난다(N+1 없음, @/lib/room-feed).
  const cards = await buildMemoryCards({
    supabase,
    roomId,
    viewerId: viewer.id,
    rows: memoriesResult.data ?? [],
  })

  /*
    찾아보기의 [누가] 칩에 쓸 사람 목록.
    지금 화면에 보이는 카드에서 뽑지 않고 **방의 구성원**에서 뽑는다 —
    카드에서 뽑으면 "그 사람 걸로 좁히면 목록이 비는" 조건은 아예 고를 수도 없어서,
    왜 안 보이는지 알 길이 없다. 찾기 칸을 열었을 때만 읽는다.
  */
  /*
    이 방의 구성원. 찾기의 [누가] 칩과 **더보기 서랍 맨 위 아바타 줄**이 함께 쓴다.
    그래서 찾는 중이 아니어도 읽는다 — 서랍은 언제든 열릴 수 있다.
  */
  const members = await loadFeedAuthors(supabase, roomId)
  const authors = searchOpen ? members : []

  /*
    찾은 게시물의 번호들 — **피드에 보이는 순서 그대로**.
    화면은 이 목록을 받아 그 자리로 데려가고, ∧∨로 앞뒤 결과를 오간다.
    목록 자체는 손대지 않는다(거르지 않는다).
  */
  const matchIds = await findMatchingMemoryIds({
    supabase,
    roomId,
    q,
    who,
    on,
    // 화면에 없는 게시물로는 데려갈 수 없다. 보이는 것들 안에서만 찾는다.
    within: cards.map((card) => card.memoryId),
  })

  /*
    더보기 서랍의 갤러리 미리보기 — **가장 최근 게시물 3개**의 대표 사진.
    피드가 이미 서명해 둔 주소를 다시 쓴다. 서랍을 위해 조회를 한 번 더 하지 않는다.
    카드 순서는 고정 글이 맨 위라 시간순과 다르므로 여기서 다시 세운다.
  */
  const previewPhotos = [...cards]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, GALLERY_PREVIEW_COUNT)
    .map((card) => card.photos[0]?.url)
    .filter((url): url is string => Boolean(url))

  return (
    // 100dvh: 모바일 브라우저 주소창이 접혔다 펴져도 높이가 흔들리지 않는다(홈과 같다).
    <div className="flex h-[100dvh] flex-col">
      <RoomAppBar backHref="/" backLabel="홈으로 돌아가기" title={roomName}>
        {/*
          찾아보기 (노션 IA 3.4). 링크인 이유 — 여는 것도 주소(?find=1)라
          뒤로가기로 그대로 닫힌다. 여는 데에 화면 상태를 쓰지 않는다.
        */}
        <RoomAppBarLink
          href={searchOpen ? `/rooms/${roomId}` : `/rooms/${roomId}?find=1`}
          label={searchOpen ? '추억 찾기 닫기' : '추억 찾아보기'}
        >
          <SearchIcon />
        </RoomAppBarLink>

        {/* 멤버 추가 (캡처 10의 person+). 기존 초대 화면으로 그대로 이어진다. */}
        <RoomAppBarLink
          href={`/rooms/${roomId}/invite`}
          label={`${roomName}에 멤버 추가하기`}
        >
          <PersonAddIcon />
        </RoomAppBarLink>

        {/*
          더보기 서랍 (캡처 `참고/앨범방_더보기.png`).
          예전에 이 자리에 있던 [방 설정] 링크가 서랍 안의 '앨범방 나가기'로 들어갔다 —
          그 링크는 방 설정 화면의 나가기 칸(#leave)으로 그대로 이어지므로
          멤버 목록·차단으로 가는 길도 끊기지 않는다.
        */}
        <MoreDrawer
          roomId={roomId}
          roomName={roomName}
          previewPhotos={previewPhotos}
          memberNames={members.map((member) => member.name)}
        />
      </RoomAppBar>

      {/*
        스크롤 칸과 떠 있는 [맨 아래로] 버튼을 함께 그린다 (노션 IA 3.4).
        카드 목록은 여기서(서버에서) 그린 그대로 꽂히므로 번들에 들어가지 않는다.
      */}
      <FeedScroll showJump={cards.length > 0} matchIds={matchIds}>
        <div className="mx-auto w-full max-w-md px-screen-x pt-0.5 pb-screen-b">
          {/* 찾기 칸 (노션 IA 3.4·6.8). 고르는 일만 여기서 하고 거르는 일은 위 조회가 했다. */}
          <FeedSearch
            authors={authors}
            who={who}
            on={on}
            q={q}
            open={searchOpen}
            matchCount={matchIds.length}
          />

          {memoriesResult.error ? (
            <p
              role="alert"
              className="mt-4 rounded-inner bg-surface-soft px-4 py-4 text-base leading-relaxed text-ink"
            >
              추억을 불러오지 못했어요. 잠시 후 다시 열어봐 주세요.
            </p>
          ) : cards.length === 0 ? (
            // 조건을 걸어서 비었으면 "첫 추억을 남겨보세요"가 아니다 —
            // 그 안내는 찾기 칸이 이미 하고 있다(FeedSearch).
            searchOpen ? null : (
              <EmptyFeed />
            )
          ) : (
            <ul
              aria-label={`${roomName}의 추억`}
              className="mt-card flex flex-col gap-card"
            >
              {cards.map((card) => (
                // 찾은 결과로 데려갈 때 이 자리를 표시한다. 카드 내용은 그대로 지나간다.
                <FeedItem key={card.memoryId} memoryId={card.memoryId}>
                  <MemoryCard {...card} as="div" />
                </FeedItem>
              ))}
            </ul>
          )}
        </div>
      </FeedScroll>

      {/* 아래 고정 줄 (캡처 10·22). 추억이 있든 없든 늘 같은 자리에 있다. */}
      <div className="shrink-0 border-t border-hairline bg-card px-screen-x py-3">
        <div className="mx-auto w-full max-w-md">
          <ButtonLink href={`/rooms/${roomId}/compose`} fullWidth>
            마음 표현하기
          </ButtonLink>
        </div>
      </div>

      <BottomNav />

      {/* 방을 막 만들고 들어왔을 때만 뜬다 (캡처 10). */}
      {justCreated ? (
        <Toast message="앨범방이 만들어졌어요 🎉" offsetClassName="bottom-32" />
      ) : null}
    </div>
  )
}

/**
 * 조건에 맞는 게시물의 번호들 — **화면에 보이는 순서 그대로**.
 *
 * 찾기는 목록을 거르지 않는다. 어떤 게시물이 걸렸는지만 알아내고, 데려가는 일은 화면이 한다
 * (카카오톡 채팅방 검색과 같다. 사용자 결정 2026-08-20).
 *
 * `within`은 지금 화면에 그려진 게시물들이다. 그 밖의 것이 걸려도 데려갈 자리가 없으므로
 * 아예 후보에서 뺀다 — "3개 찾았어요"라고 해놓고 두 번째에서 멈추면 고장으로 읽힌다.
 */
async function findMatchingMemoryIds(options: {
  supabase: Awaited<ReturnType<typeof createClient>>
  roomId: string
  q: string | null
  who: string | null
  on: string | null
  within: string[]
}): Promise<string[]> {
  const { supabase, roomId, q, who, on, within } = options

  // 아무 조건도 없으면 찾은 것도 없다. 조건 없이 "전부 찾음"으로 두면 ∧∨가 의미를 잃는다.
  if (!q && !who && !on) return []
  if (within.length === 0) return []

  let query = supabase
    .from('memories')
    .select('id')
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .in('id', within)

  if (who) query = query.eq('author_id', who)

  /*
    날짜는 **KST 하루**로 자른다. `+09:00`을 직접 붙이는 이유:
    서버가 어느 시간대에서 돌든 같은 하루를 가리켜야 한다. 서버 기본 시간대를 믿으면
    밤 11시에 올린 추억이 다음 날로 잡힌다.
  */
  if (on) {
    query = query
      .gte('created_at', `${on}T00:00:00+09:00`)
      .lt('created_at', `${nextKstDay(on)}T00:00:00+09:00`)
  }

  /*
    글자로 찾기. 게시물 문구뿐 아니라 **댓글까지** 본다 —
    찾는 말은 내가 쓴 말일 수도, 상대가 남긴 말일 수도 있다.

    한국어는 Postgres 기본 전문검색이 제대로 못 쪼갠다. 방 하나의 게시물은 많아야 수백 개라
    ilike(부분 일치)로 충분하고, 오히려 "사랑"으로 "사랑해"가 걸리는 편이 기대에 맞는다.
  */
  if (q) {
    const inComments = await loadMemoryIdsMatchingComments(supabase, roomId, q)
    query = query.or(
      `description.ilike.%${escapeForFilter(q)}%,id.in.(${inComments.join(',')})`,
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('[앨범방 찾기] 실패:', error.message)
    return []
  }

  // 화면에 놓인 순서(고정 글 먼저, 그다음 최신순)를 그대로 따른다.
  // DB가 준 순서를 믿지 않는다 — ∧∨가 화면 순서와 어긋나면 위아래가 뒤집힌 것처럼 보인다.
  const found = new Set((data ?? []).map((row) => row.id))
  return within.filter((id) => found.has(id))
}

/**
 * PostgREST의 `or()` 문자열에 값을 넣을 때 문법을 깨뜨리는 글자를 지운다.
 *
 * `or()`는 쉼표로 조건을, 괄호로 묶음을 구분하는 **문자열 문법**이다.
 * 사용자가 친 쉼표·괄호가 그대로 들어가면 조건이 쪼개지거나 문법 오류가 난다.
 * 검색어에서 이 글자들이 의미를 갖는 경우는 사실상 없으므로 지우고 찾는다.
 */
function escapeForFilter(value: string): string {
  return value.replace(/[,()\\*]/g, ' ').trim()
}

/**
 * 댓글에 그 말이 들어 있는 게시물 번호들.
 *
 * 항상 최소 한 개(있을 수 없는 번호)를 넣어 돌려준다 — 빈 목록이면
 * `id.in.()` 이 되어 문법이 깨진다.
 */
async function loadMemoryIdsMatchingComments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string,
  keyword: string,
): Promise<string[]> {
  const EMPTY = '00000000-0000-0000-0000-000000000000'

  const { data, error } = await supabase
    .from('memory_comments')
    .select('memory_id, memories!inner(room_id)')
    .eq('memories.room_id', roomId)
    .is('deleted_at', null)
    .ilike('body', `%${keyword}%`)
    .limit(200)

  if (error) {
    // 댓글을 못 뒤졌어도 게시물 문구로는 찾을 수 있다. 화면을 막지 않는다.
    console.error('[앨범방 찾기] 댓글 검색 실패:', error.message)
    return [EMPTY]
  }

  const ids = Array.from(new Set((data ?? []).map((row) => row.memory_id)))
  return ids.length > 0 ? ids : [EMPTY]
}

/**
 * 찾아보기의 [누가] 칩에 놓을 사람들 — 이 방의 활성 구성원.
 *
 * 이름 규칙은 피드 카드와 같다(별명이 있으면 별명, 없으면 전역 이름).
 * 여기서만 본명으로 보이면 같은 사람이 화면마다 다른 사람처럼 읽힌다(@/lib/member-name).
 */
async function loadFeedAuthors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  roomId: string,
): Promise<FeedAuthor[]> {
  const { data, error } = await supabase
    .from('room_members')
    .select('user_id, nickname, users(name)')
    .eq('room_id', roomId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })

  if (error) {
    // 사람 목록을 못 읽어도 날짜로는 찾을 수 있다. 화면을 통째로 막지 않는다.
    console.error('[앨범방 찾기] 구성원 조회 실패:', error.message)
    return []
  }

  return (data ?? []).map((member) => ({
    id: member.user_id,
    name: roomMemberName({
      userId: member.user_id,
      nickname: member.nickname,
      name: member.users?.name,
    }),
  }))
}

/**
 * 아직 아무것도 없을 때 (캡처 10).
 *
 * 2026-08-25까지는 맨 글씨를 화면 위쪽에 띄웠는데, 홈은 같은 상황을 **카드**에 담고 있어서
 * 같은 앱에서 같은 상황이 다르게 보였다. 담긴 데가 없으니 화면이 덜 만들어진 것처럼도 읽혔다.
 * 공용 EmptyState(홈과 같은 모양)로 옮겼다.
 *
 * 버튼을 여기 달지 않는다 — 아래 고정 줄에 이미 [마음 표현하기]가 있다.
 * 대신 그 버튼의 이름을 문장 안에서 굵게 짚어준다. 캡처도 같은 방식이다.
 */
function EmptyFeed() {
  return (
    <div className="mt-9">
      <EmptyState
        icon={<PhotoIcon />}
        title="아직 추억이 없어요"
        description={
          <>
            아래 <strong className="font-bold text-ink">마음 표현하기</strong>로
            <br />첫 번째 추억을 남겨보세요.
          </>
        }
      />
    </div>
  )
}

/** 빈 방의 사진 그림 (홈의 빈 화면과 같은 것). 아직 아무것도 담기지 않은 앨범을 뜻한다. */
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

/** 찾아보기(돋보기). */
function SearchIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  )
}

/** 멤버 추가(캡처 10의 person+). */
function PersonAddIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9.5" cy="8" r="3.6" />
      <path d="M3 19.5c0-3.4 2.9-5.2 6.5-5.2 1.3 0 2.5.2 3.5.7" />
      <path d="M18 14v6M15 17h6" />
    </svg>
  )
}
