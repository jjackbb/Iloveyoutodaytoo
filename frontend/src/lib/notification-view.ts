import type { Enums } from '@/types/database'

/**
 * 알림을 **화면에 어떻게 보일지**만 담은 모듈.
 *
 * 왜 읽기(@/lib/notifications)와 갈라놨나:
 * 알림 모달은 클라이언트 부품이라 문장 만드는 함수가 브라우저 번들에 들어간다.
 * 그런데 읽기 쪽은 서버 전용 Supabase 클라이언트를 불러온다. 한 파일에 두면
 * 그 서버 코드까지 브라우저로 딸려 들어가 빌드가 깨진다(실제로 한 번 깨졌다).
 * 그래서 서버만 쓰는 것과 양쪽이 쓰는 것을 파일로 나눈다.
 */

export type NotificationType = Enums<'notification_type'>

export type AppNotification = {
  id: string
  type: NotificationType
  /** 알림을 일으킨 사람의 이름. 탈퇴했으면 null이다. */
  actorName: string | null
  createdAt: string
  read: boolean
  /** 눌렀을 때 갈 곳. 갈 곳을 만들 수 없으면 null이고, 그러면 누를 수 없게 그린다. */
  href: string | null
}

/**
 * 눌렀을 때 갈 곳.
 *
 * 원본이 지워졌으면 연결이 끊겨(ON DELETE CASCADE) 알림 자체가 같이 사라지므로,
 * 여기서 null이 나오는 건 데이터가 어긋난 드문 경우다. 그때는 누를 수 없게 그린다 —
 * 눌렀는데 404가 뜨는 것보다 낫다.
 */
export function notificationHref(row: {
  type: NotificationType
  room_id: string | null
  memory_id: string | null
}): string | null {
  switch (row.type) {
    case 'memory_created':
    case 'comment_created':
      return row.room_id && row.memory_id
        ? `/rooms/${row.room_id}/memories/${row.memory_id}`
        : null
    case 'member_joined':
      return row.room_id ? `/rooms/${row.room_id}` : null
    case 'heart_received':
      // 사서함의 '받은 마음'으로 보낸다. 마음 하나만 보는 화면은 없다.
      return '/mailbox'
  }
}

/**
 * 알림 한 줄에 쓸 문장.
 *
 * 이름을 앞에 세우는 이유: 시니어 사용자가 목록을 훑을 때 "누가"가 먼저 읽혀야
 * 열어볼지 말지 정할 수 있다. 탈퇴한 사람은 이름 자리가 비므로 문장을 바꾼다.
 */
export function notificationText(n: AppNotification): string {
  const who = n.actorName ?? '탈퇴한 사용자'

  switch (n.type) {
    case 'memory_created':
      return `${who}님이 새 추억을 남겼어요`
    case 'comment_created':
      return `${who}님이 내 추억에 댓글을 남겼어요`
    case 'member_joined':
      return `${who}님이 앨범방에 들어왔어요`
    case 'heart_received':
      return `${who}님에게서 마음이 도착했어요`
  }
}
