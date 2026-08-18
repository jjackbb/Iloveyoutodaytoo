import {
  notificationHref,
  type AppNotification,
} from '@/lib/notification-view'
import { createClient } from '@/lib/supabase/server'

/**
 * 알림함 읽기 (캡처 05).
 *
 * 알림은 앱이 만들지 않는다 — DB 트리거가 넣는다. 추억·댓글·입장·마음을 넣는 경로가
 * 여러 군데라, 각 경로에서 알림 넣기를 잊으면 조용히 안 오기 때문이다.
 * 그래서 여기에는 읽기만 있다.
 *
 * 화면에 보일 문장·링크는 @/lib/notification-view 에 있다. 그쪽은 클라이언트 부품도
 * 쓰기 때문에 서버 전용 코드와 한 파일에 두면 브라우저 번들로 딸려 들어간다
 * (실제로 한 번 빌드가 깨졌다). **이 파일을 클라이언트 부품에서 import 하지 마라.**
 */

/** 한 번에 읽어올 개수. 캡처에 더 보기가 없어 목록은 여기서 끊는다. */
const PAGE_SIZE = 30

/**
 * 안 읽은 알림 개수.
 *
 * 목록과 따로 세는 함수를 둔 이유: 배지만 필요한 화면이 생기면 알림 30개를
 * 통째로 읽어올 이유가 없다. `head: true`라 행은 안 받고 개수만 받는다.
 * (지금은 홈이 목록을 이미 받아 거기서 세므로 쓰지 않는다.)
 */
export async function countUnreadNotifications(): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
    .is('read_at', null)

  if (error) {
    // 배지가 안 보일 뿐이라 화면을 막지 않는다.
    console.error('[알림] 안 읽은 개수 세기 실패:', error.message)
    return 0
  }

  return count ?? 0
}

/** 알림 목록. 최신순, 지운 것 제외. RLS가 내 것만 내려준다. */
export async function loadNotifications(): Promise<AppNotification[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notifications')
    .select(
      'id, type, created_at, read_at, room_id, memory_id, heart_message_id, actor:actor_id(name)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  if (error) {
    console.error('[알림] 목록 읽기 실패:', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    actorName: row.actor?.name ?? null,
    createdAt: row.created_at,
    read: row.read_at !== null,
    href: notificationHref(row),
  }))
}
