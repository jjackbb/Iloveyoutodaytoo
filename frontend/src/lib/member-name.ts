/**
 * 이 방에서 이 사람을 뭐라고 부를지 — 화면에 보이는 이름을 정하는 **단 한 곳**.
 *
 * 규칙은 하나다: **방별 별명(room_members.nickname)이 있으면 그것, 없으면 전역 이름(users.name).**
 * 별명은 본인이 정하고 그 방의 모두에게 같은 이름으로 보인다(개인 설정이 아니다).
 * 그래서 마이 탭에서 전역 이름을 바꿔도 별명을 정해둔 방에서는 별명이 그대로 보인다.
 *
 * 왜 함수로 빼는가: 같은 사람이 피드에서는 별명, 방 설정에서는 본명으로 보이면
 * 두 화면이 서로 다른 사람 얘기를 하는 것처럼 읽힌다. 이름을 고르는 규칙은 한 곳에만 둔다.
 * (아바타 첫 글자를 뽑는 규칙이 MemoryCard·MemberStack에서 같은 이유로 맞춰져 있다)
 */

/** 작성자 자리가 비었을 때(users 행이 지워진 경우). */
const WITHDRAWN = '탈퇴한 사용자'

/** id는 있는데 이름을 못 읽은 경우(방을 떠난 분은 users RLS에 막힌다). */
const UNKNOWN = '알 수 없는 사람'

export function roomMemberName(input: {
  /** users.id. 탈퇴로 author_id가 null이 된 자리는 null이 온다. */
  userId: string | null
  /** room_members.nickname. 이 방에서만 쓰는 별명. */
  nickname?: string | null
  /** users.name. 전역 이름. */
  name?: string | null
}): string {
  if (!input.userId) return WITHDRAWN

  // DB CHECK가 앞뒤 공백을 막지만, 옛 데이터나 손으로 넣은 값까지 믿지는 않는다.
  const nickname = input.nickname?.trim()
  if (nickname) return nickname

  const name = input.name?.trim()
  if (name) return name

  return UNKNOWN
}
