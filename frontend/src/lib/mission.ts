import { createClient } from '@/lib/supabase/server'

/**
 * 답장 미션 (PRD [MISSION-01] + 수정안 1) — 서버가 보는 쪽.
 *
 * 규칙은 DB에 있다(`locked_senders()`, `mark_heart_read()`). 여기는 그걸 불러다
 * 화면이 쓰기 좋은 모양으로 바꿔줄 뿐이다.
 *
 * **왜 규칙을 DB에 두었나:** 락은 "안 보여줘야 할 것을 안 보여주는" 장치다.
 * 앱 코드에서만 가리면, 화면을 거치지 않고 데이터를 요청하는 길이 하나라도 있으면
 * 그대로 새어 나간다. DB가 막으면 어느 길로 와도 같은 답이 나온다.
 *
 * **락은 저장하지 않고 셈으로 구한다.** 락 상태를 컬럼에 적어두면 답장·삭제 때마다
 * 그 값을 같이 고쳐야 하고, 한 군데만 놓쳐도 "답장했는데 안 풀리는" 상태가 남는다.
 *
 * 이 파일은 서버 전용이다 — 클라이언트 부품에서 import 하지 마라(@/lib/notifications 참고).
 */

/** 나에게 락이 걸린 사람들. key는 보낸 사람 id, value는 듣고도 답장 안 한 통수. */
export type LockedSenders = Map<string, number>

export async function loadLockedSenders(): Promise<LockedSenders> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('locked_senders')

  if (error) {
    /*
      못 읽었을 때는 **잠그지 않는다**(빈 Map).

      반대로 "모르면 일단 잠근다"로 두면, 일시적인 오류 한 번에 사서함 전체가
      잠긴 것처럼 보인다. 미션은 사용자를 벌주는 장치가 아니라 대화를 잇는 장치라,
      의심스러울 때는 열어두는 쪽이 맞다.
    */
    console.error('[답장 미션] 락 상태 읽기 실패:', error.message)
    return new Map()
  }

  return new Map((data ?? []).map((row) => [row.sender_id, row.unreplied_count]))
}

/**
 * 이 마음을 지금 열어볼 수 있는가.
 *
 * 이미 들은 마음은 언제나 열린다 — 한 번 들은 것을 도로 잠그면
 * "아까는 들렸는데 왜 안 들리지"가 된다. PRD도 락을 **다음 메시지를 확인하는 행동**에만
 * 걸라고 못박고 있다.
 */
export function isHeartLocked(
  message: { senderId: string | null; readAt: string | null },
  locked: LockedSenders,
): boolean {
  if (message.readAt !== null) return false
  if (!message.senderId) return false
  return locked.has(message.senderId)
}
