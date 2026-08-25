import webpush from 'web-push'

import { createClient } from '@/lib/supabase/server'

/**
 * 웹푸시 발송 (앱 밖 알림).
 *
 * 이 앱에는 `notifications`(알림함)이 이미 있지만, 그건 **앱 안에서만** 보인다.
 * 답장 미션·연속 기록처럼 "다시 들어와야" 뜻이 있는 장치들이 정작 다시 들어오라고
 * 말할 통로가 없었다 — 이 파일이 그 통로다.
 *
 * SUPABASE_SERVICE_ROLE_KEY를 쓰지 않는다(PRD 결정). 대신 DB의
 * `push_targets_for_user()` 함수(SECURITY DEFINER)가 "같은 방을 공유하고
 * 차단 관계가 아닌 사람"에게만 구독 정보를 내준다 — RLS를 우회하되,
 * users_select와 같은 기준으로 스스로를 제한한다.
 *
 * VAPID 키가 없으면(.env.local 미설정) 조용히 건너뛴다 — 알림이 앱의 핵심 기능이
 * 아니라 곁다리 채널이라, 설정을 깜빡했다고 게시물 작성 같은 진짜 기능을 막으면 안 된다.
 */

export type PushPayload = {
  /** 알림 제목. */
  title: string
  /** 알림 본문. */
  body: string
  /** 눌렀을 때 이동할 경로. 절대경로(예: "/rooms/abc"). */
  url: string
}

/*
  요청마다 다시 설정한다 — 서버가 요청 사이에 값을 들고 있는 모듈 최상단 변수를
  두지 않기 위해서다(잔여데이터 검사 규칙과 같은 이유). setVapidDetails는 가벼운
  동기 호출이라 매번 불러도 비용이 거의 없다.
*/
function ensureVapid(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false

  webpush.setVapidDetails(
    // web-push 스펙상 발신자 연락처가 필요하다. 실제 서비스 메일로 바꿔두면 좋다.
    'mailto:noreply@oneuldo.app',
    publicKey,
    privateKey,
  )
  return true
}

/**
 * 한 사람의 모든 기기로 웹푸시를 보낸다.
 *
 * 기기(브라우저)마다 구독이 따로라 여러 통이 나갈 수 있다. 하나가 실패해도
 * 나머지는 계속 보낸다 — 폰 알림이 꺼져 있다고 PC 알림까지 막을 이유가 없다.
 *
 * 실패는 절대 던지지 않는다. 알림은 부가 기능이라, 이 함수를 부르는 쪽(게시물 작성 등)의
 * 성공 여부를 알림 발송 성패가 좌우하면 안 된다. 호출부에서도 감싸 쓰되, 여기서도
 * 한 번 더 막아 둔다.
 */
export async function sendPush(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureVapid()) return

  try {
    const supabase = await createClient()

    const { data: targets, error } = await supabase.rpc(
      'push_targets_for_user',
      { p_user_id: userId },
    )

    if (error) {
      console.error('[웹푸시] 구독 목록을 못 읽었다:', error.message)
      return
    }
    if (!targets || targets.length === 0) return

    await Promise.all(
      targets.map(async (target) => {
        const subscription = {
          endpoint: target.endpoint,
          keys: { p256dh: target.p256dh, auth: target.auth },
        }

        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify(payload),
          )
        } catch (err) {
          const statusCode =
            err && typeof err === 'object' && 'statusCode' in err
              ? (err as { statusCode?: number }).statusCode
              : undefined

          // 404/410 = 브라우저가 이 구독을 이미 버렸다(알림 권한을 끄거나 재설치).
          // 다시 보내봐야 계속 실패하니 지운다.
          if (statusCode === 404 || statusCode === 410) {
            const { error: pruneError } = await supabase.rpc(
              'prune_push_subscription',
              { p_endpoint: target.endpoint },
            )
            if (pruneError) {
              console.error('[웹푸시] 죽은 구독 정리 실패:', pruneError.message)
            }
            return
          }
          console.error('[웹푸시] 발송 실패:', err)
        }
      }),
    )
  } catch (err) {
    console.error('[웹푸시] 예기치 못한 오류:', err)
  }
}
