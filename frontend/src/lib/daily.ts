import type { SupabaseClient } from '@supabase/supabase-js'

import { roomDisplayName } from '@/lib/room-name'
import type { Database } from '@/types/database'

/**
 * 매일 바뀌는 자리 (DAILY-01, PRD §6⑱).
 *
 * 오늘의 질문은 주 단위 고정 그대로 두고(PROMPT-01), **매일 열 이유**는 "쌓인 것"이
 * 만든다 — `작년 오늘` 이 있으면 그것을, 없으면 `이번 달 N번 남겼어요`.
 *
 * "12번 주고받았어요"가 아니라 **"12번 남겼어요"** 로 센다. 앞의 문장은 상대가 없으면
 * 실패로 읽히고, 뒤의 문장은 혼자여도 성립한다. 혼자 쓰는 사람을 버리지 않는 것이
 * 이 자리의 숨은 역할이다(북극성 "혼자여도 성립").
 *
 * 세는 것은 **추억 + 마음**이다(사용자 결정). 댓글은 응답이라 뺐다 — 숫자의 뜻이
 * "내가 먼저 건넨 것"이어야 즐거움이 된다. 바꾸려면 아래 count 하나만 더하면 된다.
 *
 * 날짜는 전부 KST 기준이다. 서버는 UTC 로 돌지만 사용자는 한국에 있다 —
 * 자정을 UTC 로 자르면 "작년 오늘"이 아홉 시간 어긋난다.
 */

export type DailySlotData = {
  /** 작년 오늘 내 방들에 남겨진 추억 하나. 없으면 null. */
  lastYear: {
    memoryId: string
    roomId: string
    roomName: string
    authorName: string
  } | null
  /** 이번 달 내가 남긴 추억 + 마음 */
  monthCount: number
  /** "9월" 처럼 화면에 붙일 달 이름 */
  monthLabel: string
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** UTC 시각을 KST 달력의 연·월·일로. */
function kstCalendar(now: Date) {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(), // 0-11
    day: shifted.getUTCDate(),
  }
}

/** KST 자정을 UTC ISO 로. Date.UTC 가 월·일 넘침(2월 30일 등)을 알아서 넘긴다. */
function kstMidnightIso(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day) - KST_OFFSET_MS).toISOString()
}

export async function loadDailySlot(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
): Promise<DailySlotData> {
  const { year, month, day } = kstCalendar(now)

  const monthStart = kstMidnightIso(year, month, 1)
  const monthEnd = kstMidnightIso(year, month + 1, 1)
  const lastYearStart = kstMidnightIso(year - 1, month, day)
  const lastYearEnd = kstMidnightIso(year - 1, month, day + 1)

  // 셋은 서로 무관하니 같이 출발시킨다.
  const [memoriesRes, heartsRes, lastYearRes] = await Promise.all([
    supabase
      .from('memories')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', userId)
      .is('deleted_at', null)
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd),
    supabase
      .from('heart_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', userId)
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd),
    // RLS 가 내 방의 추억만 돌려준다. 작성자가 나든 남이든 "그날 우리 방에 있었던 것"이다.
    supabase
      .from('memories')
      .select(
        'id, room_id, author:users!memories_author_id_fkey(name), room:rooms!memories_room_id_fkey(name)',
      )
      .is('deleted_at', null)
      .gte('created_at', lastYearStart)
      .lt('created_at', lastYearEnd)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (memoriesRes.error) console.error('[매일 자리] 추억 수 조회 실패:', memoriesRes.error.message)
  if (heartsRes.error) console.error('[매일 자리] 마음 수 조회 실패:', heartsRes.error.message)
  if (lastYearRes.error) console.error('[매일 자리] 작년 오늘 조회 실패:', lastYearRes.error.message)

  const monthCount = (memoriesRes.count ?? 0) + (heartsRes.count ?? 0)
  const monthLabel = `${month + 1}월`

  const row = lastYearRes.data
  if (!row) {
    return { lastYear: null, monthCount, monthLabel }
  }

  // 방 이름은 **내 화면 기준**이다(ALBUM-01 — 각자 자기 화면에서만 바꾼다).
  const { data: membership } = await supabase
    .from('room_members')
    .select('custom_name')
    .eq('room_id', row.room_id)
    .eq('user_id', userId)
    .maybeSingle()

  return {
    lastYear: {
      memoryId: row.id,
      roomId: row.room_id,
      roomName: roomDisplayName({
        name: row.room?.name ?? '',
        customName: membership?.custom_name ?? null,
      }),
      authorName: row.author?.name ?? '탈퇴한 사용자',
    },
    monthCount,
    monthLabel,
  }
}
