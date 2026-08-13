import type { Metadata } from 'next'
import Link from 'next/link'

import { TabScreen } from '@/components/layout/TabScreen'
import { BackButton } from '@/components/nav/BackButton'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { requireUser } from '@/lib/auth'
import { formatKstFullDate } from '@/lib/format'
import { loadBlockedUsers, unblockUser } from '@/lib/actions/blocks'

export const metadata: Metadata = { title: '차단한 분 · 오늘도 사랑해' }

/**
 * 내가 차단한 분 목록.
 *
 * 이 화면은 브라우저 자바스크립트 없이도 그대로 동작한다.
 * 차단 해제는 평범한 <form>이고, "정말 푸시겠어요?" 확인은 주소의 ?confirm= 으로 편다.
 * 시니어 사용자는 통신이 불안정한 환경이 많아서, 눌렀는데 아무 일도 안 일어나는
 * 상황을 만들지 않는 편이 안전하다.
 *
 * 차단을 푸는 데 확인을 두는 이유:
 * 차단은 "같은 방에 함께 있는 분"만 걸 수 있다. 그 방을 이미 나왔다면
 * 한 번 풀고 나서 다시 걸 방법이 없다. 되돌리기 어려운 동작으로 다룬다.
 */
export default async function BlocksPage({
  searchParams,
}: PageProps<'/my/blocks'>) {
  await requireUser()

  const [{ items, error }, query] = await Promise.all([
    loadBlockedUsers(),
    searchParams,
  ])

  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value

  const result = first(query.result)
  const confirmId = first(query.confirm) ?? null

  return (
    <TabScreen
      title="차단한 분"
      leading={<BackButton href="/my" label="마이로 돌아가기" compact />}
    >
      <p className="text-base leading-relaxed text-muted">
        차단한 분이 보내는 마음은 사서함에 보이지 않아요. 지금까지의 기록은
        그대로 남아 있어요.
      </p>

      {/* 방금 무슨 일이 있었는지 알린다. 화면 낭독기도 이 칸을 읽는다. */}
      {result ? (
        <p
          role="status"
          className="rounded-[14px] bg-primary-soft px-4 py-4 text-base leading-relaxed text-primary"
        >
          {result === 'unblocked'
            ? '차단을 풀었어요. 이제 이분의 마음이 사서함에 다시 보여요.'
            : '차단을 풀지 못했어요. 잠시 후 다시 눌러주세요.'}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-[14px] bg-surface-soft px-4 py-4 text-base leading-relaxed text-ink"
        >
          {error}
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          title="차단한 분이 없어요"
          description="불편한 분이 생기면 관계방의 구성원 목록에서 차단할 수 있어요."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((person) => {
            const confirming = confirmId === person.blockId

            return (
              <li
                key={person.blockId}
                className="flex flex-col gap-3 rounded-card bg-card p-5 shadow-card"
              >
                <div className="flex flex-col gap-1">
                  <p className="truncate text-lg font-bold text-ink">
                    {person.name ?? '이름을 볼 수 없는 분'}
                  </p>
                  <p className="text-base text-muted">
                    {formatKstFullDate(person.createdAt)}에 차단했어요
                  </p>
                  {person.name === null ? (
                    <p className="text-base leading-relaxed text-muted">
                      지금은 함께 있는 방이 없어서 이름이 보이지 않아요. 차단은
                      그대로 유지되고 있어요.
                    </p>
                  ) : null}
                </div>

                {confirming ? (
                  <div className="flex flex-col gap-4 rounded-[14px] bg-surface-soft p-5">
                    <h2 className="text-lg font-bold text-ink">
                      차단을 풀까요?
                    </h2>

                    <ul className="flex list-none flex-col gap-2 text-base leading-relaxed text-ink">
                      <li>· 이분이 보낸 마음이 사서함에 다시 보여요.</li>
                      <li>· 이분이 보내는 초대장도 다시 받을 수 있어요.</li>
                      <li>
                        · 함께 있는 방이 없으면 나중에{' '}
                        <strong>다시 차단하기 어려워요.</strong>
                      </li>
                    </ul>

                    <form action={unblockUser} className="flex flex-col gap-3">
                      <input
                        type="hidden"
                        name="blocked_id"
                        value={person.userId}
                      />
                      <Button type="submit" fullWidth>
                        네, 차단을 풀게요
                      </Button>
                    </form>

                    <Link
                      href="/my/blocks"
                      className="inline-flex min-h-[52px] items-center justify-center rounded-[8px] text-base font-medium text-primary active:bg-primary-soft"
                    >
                      그만두기
                    </Link>
                  </div>
                ) : (
                  <Link
                    href={`/my/blocks?confirm=${person.blockId}`}
                    className="inline-flex min-h-[52px] items-center justify-center rounded-button border-2 border-primary bg-card px-6 text-lg font-medium text-primary active:bg-primary-soft"
                  >
                    차단 풀기
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </TabScreen>
  )
}
