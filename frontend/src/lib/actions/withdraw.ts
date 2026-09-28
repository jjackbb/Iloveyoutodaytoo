'use server'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * 회원 탈퇴 Server Action.
 *
 * DB 함수 withdraw_account가 삭제 대상 파일을 작업표에 기록하고 계정을 지운다.
 * 성공 뒤 Storage 삭제를 시도하고 남은 세션을 정리한다.
 *
 * 코드가 직접 하지 않는 일 (DB 함수가 이미 한다. 또 하면 중복이 된다):
 *  - withdrawal_reasons 에 탈퇴 사유 넣기
 *  - 나 말고 아무도 발을 들인 적 없는 방 정리
 *    (owner_id = 나 이면서 나 외의 room_members 행이 하나도 없는 방. status는 보지 않는다)
 *  - 남는 방의 방장 승계 — 남은 활성 구성원에게 owner_id와 admin 역할을 넘긴다
 *  - 계정(auth.users) 삭제
 *
 * 그래서 탈퇴해도 함께 쓰던 방과 상대의 사서함은 사라지지 않는다.
 * rooms.owner_id 는 ON DELETE SET NULL, heart_messages 의 sender_id·receiver_id 도
 * ON DELETE SET NULL 이라, 내 자리만 비고 기록은 상대 쪽에 남는다.
 * 화면 문구(my/withdraw)는 이 사실에 맞춰 쓰여 있다. 함수를 고치면 문구도 함께 고쳐야 한다.
 *
 * auth.admin.deleteUser 는 쓰지 않는다. 클라이언트에 관리자 키를 두지 않는 규칙이다.
 * 대신 SECURITY DEFINER 함수인 withdraw_account 가 그 일을 대신한다.
 */

/**
 * 마지막 확인 문구.
 *
 * 같은 문구가 withdraw-form.tsx 에도 있다. 'use server' 파일은 async 함수 외에
 * 아무것도 export 할 수 없어서 한곳에 모아둘 수가 없다.
 * 대신 비교할 때 공백을 모두 지우고 맞춰 보기 때문에, 띄어쓰기 차이로는 어긋나지 않는다.
 */
const CONFIRM_PHRASE = '탈퇴합니다'

/** 자유 입력 길이 상한. DB 함수가 어차피 1000자에서 자른다(left(...,1000)). */
const DETAIL_MAX_LENGTH = 1000

/** 탈퇴 사유 길이 상한. DB 함수가 200자에서 자른다. */
const REASON_MAX_LENGTH = 200

/**
 * DB 거래가 남긴 삭제 작업표를 시도한다. 삭제 실패나 호출 중단 뒤에도 작업표는 남아
 * 관리자가 재시도할 수 있다. finish_storage_deletions는 실제 객체가 사라진 행만 지운다.
 */
async function settleWithdrawStorageDeletions(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<void> {
  const { data: pending, error: listError } = await supabase.rpc(
    'pending_storage_deletions',
  )
  if (listError) {
    console.error('[회원 탈퇴] 파일 삭제 작업표 조회 실패:', listError.message)
    return
  }

  const byBucket = new Map<string, string[]>()
  for (const job of pending ?? []) {
    const paths = byBucket.get(job.bucket_id) ?? []
    paths.push(job.object_name)
    byBucket.set(job.bucket_id, paths)
  }

  const failures: string[] = []
  for (const [bucket, paths] of byBucket) {
    for (let offset = 0; offset < paths.length; offset += 100) {
      try {
        const { error } = await supabase.storage
          .from(bucket)
          .remove(paths.slice(offset, offset + 100))
        if (error) failures.push(`${bucket}: ${error.message}`)
      } catch (cause) {
        failures.push(
          `${bucket}: ${cause instanceof Error ? cause.message : String(cause)}`,
        )
      }
    }
  }

  const { data: left, error: finishError } = await supabase.rpc(
    'finish_storage_deletions',
    { p_error: failures.length > 0 ? failures.join(' / ') : undefined },
  )
  if (finishError) {
    console.error('[회원 탈퇴] 파일 삭제 작업표 확인 실패:', finishError.message)
  } else if (left && left > 0) {
    console.error(`[회원 탈퇴] 파일 ${left}개 정리 대기:`, failures.join(' / '))
  }
}

export type WithdrawState =
  | {
      status: 'error'
      /** 사용자에게 그대로 보여줄 문구 */
      message: string
      /** 어느 입력칸 아래에 보여줄지. 없으면 폼 전체 오류로 본다. */
      field?: 'confirm'
    }
  | { status: 'done' }
  | null

/**
 * 탈퇴를 실행한다.
 *
 * 성공하면 status: 'done' 을 돌려준다. 여기서 redirect 하지 않는 이유:
 * 로그아웃하면서 쿠키를 지우면 Next.js가 현재 화면을 서버에서 다시 그린다.
 * 그때 /my/withdraw 화면이 "로그인한 사람이 없음"을 보고 작별 인사를 보여준다.
 * 다시 그리기가 일어나지 않는 경우를 대비해 폼도 같은 작별 인사를 띄운다.
 */
export async function withdrawAccount(
  _prev: WithdrawState,
  formData: FormData,
): Promise<WithdrawState> {
  // 폼 밖에서도 호출될 수 있는 통로다. 서버에서 로그인 여부를 다시 확인한다.
  await requireUser()

  // 되돌릴 수 없는 동작이라 마지막 확인 문구를 반드시 본다.
  // 버튼을 잠가두는 대신 눌러보고 안내를 받게 했다 — 왜 안 눌리는지 모르는 상황을 만들지 않는다.
  const typed = String(formData.get('confirm') ?? '').replace(/\s/g, '')

  if (!typed) {
    return {
      status: 'error',
      message: `확인을 위해 "${CONFIRM_PHRASE}"를 적어주세요.`,
      field: 'confirm',
    }
  }
  if (typed !== CONFIRM_PHRASE) {
    return {
      status: 'error',
      message: `문구가 조금 다릅니다. "${CONFIRM_PHRASE}"를 그대로 적어주세요.`,
      field: 'confirm',
    }
  }

  /*
   * 탈퇴 사유는 선택이다. 고르지 않았으면 null을 보내고, DB 함수는 아무것도 남기지 않는다.
   * 값을 화이트리스트로 검사하지 않는 이유: 사유는 통계용 자유 텍스트 칸이고
   * (withdrawal_reasons.reason 은 text, 제약 없음) 사용자와 이어지는 참조가 없다.
   * 보기 목록을 이 파일에 한 벌 더 적어두면 화면과 조용히 어긋나기만 한다.
   * 길이는 여기서도 자르고 DB 함수도 자른다.
   */
  const rawReason = String(formData.get('reason') ?? '').trim()
  const rawDetail = String(formData.get('detail') ?? '').trim()

  const reason = rawReason ? rawReason.slice(0, REASON_MAX_LENGTH) : null
  const detail = rawDetail ? rawDetail.slice(0, DETAIL_MAX_LENGTH) : null

  const supabase = await createClient()

  // DB 함수가 삭제 대상 파일을 작업표에 먼저 남기고 계정을 지운다.
  /*
   * withdraw_account 는 이번에 새로 만든 DB 함수라 src/types/database.ts 에 아직 없다.
   * 그 파일은 스키마에서 자동 생성되는 파일이라 손으로 고치지 않는다(수정 금지 목록).
   * 그래서 이 호출 한 군데에서만 함수 이름과 인자 모양을 직접 적어 쓴다.
   * types/database.ts 를 다시 생성하면 이 캐스팅은 지워도 된다.
   *
   * ⚠️ .bind(supabase) 를 빼지 마라. supabase-js의 rpc는 프로토타입 메서드이고
   * 그 안에서 `this.rest` 를 쓴다. 함수만 떼어내 변수에 담으면 `this` 가 사라져
   * 호출하는 순간 "Cannot read properties of undefined (reading 'rest')" 로 터진다.
   * (2026-08-10 확인: 실제로 이 이유로 탈퇴가 500 오류를 내고 계정이 지워지지 않았다.
   *  파일 정리는 이미 끝난 뒤라 프로필 사진만 사라지고 계정은 남는 상태가 됐다.)
   */
  type WithdrawAccountRpc = (
    fn: 'withdraw_account',
    args: { p_reason: string | null; p_detail: string | null },
  ) => PromiseLike<{ error: { message: string } | null }>

  const callWithdrawAccount = supabase.rpc.bind(
    supabase,
  ) as unknown as WithdrawAccountRpc

  const { error } = await callWithdrawAccount('withdraw_account', {
    p_reason: reason,
    p_detail: detail,
  })

  if (error) {
    /*
     * 사용자에게는 부드럽게, 원인은 서버 로그에 남긴다. 조용히 삼키면 고칠 수가 없다.
     *
   * 같은 DB 거래가 실패한 것이므로 계정과 파일은 그대로 있다.
     */
    console.error('[회원 탈퇴] withdraw_account 실패:', error.message)
    return {
      status: 'error',
      message:
        '탈퇴 처리 중에 문제가 생겼어요. 계정은 그대로 있습니다. 잠시 후 다시 시도해주세요.',
    }
  }

  // 계정 삭제가 끝난 뒤 파일을 지운다. 실패한 객체는 작업표에 남는다.
  await settleWithdrawStorageDeletions(supabase)

  /*
   * 계정이 방금 사라졌으므로 로그아웃 요청은 401/403을 받을 수 있다.
   * supabase-js는 그 경우에도 브라우저·서버에 남은 세션 쿠키를 지운다.
   * 실패하더라도 탈퇴 자체는 이미 끝났으므로 되돌리지 않고 진행한다.
   */
  const { error: signOutError } = await supabase.auth.signOut()
  if (signOutError) {
    console.error('[회원 탈퇴] 로그아웃 정리 실패:', signOutError.message)
  }

  return { status: 'done' }
}
