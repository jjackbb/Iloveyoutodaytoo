import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { ReportDialog } from '@/components/report/ReportDialog'
import {
  isReportTargetType,
  isUuidLike,
  type ReportTargetType,
} from '@/components/report/reasons'
import { ButtonLink } from '@/components/ui/Button'
import { requireUser } from '@/lib/auth'
import { formatKstDate } from '@/lib/format'
import { safeNextPath } from '@/lib/safe-redirect'
import { createClient } from '@/lib/supabase/server'

/**
 * 주소에 신고 대상의 id가 그대로 드러나고, 화면에는 남이 남긴 글이 인용된다.
 * 검색엔진이 주워 담을 자리가 아니다.
 */
export const metadata: Metadata = {
  title: '신고하기 · 오늘도 사랑해',
  robots: { index: false, follow: false },
}

/** 탈퇴한 사람이 남긴 글은 이름이 없다. 담담하게 이렇게 적는다. */
const WITHDRAWN_NAME = '탈퇴한 사용자'

/** 미리보기로 보여줄 글자 수. 신고할 내용을 알아볼 만큼만 인용한다. */
const PREVIEW_MAX_LENGTH = 100

function snippet(text: string | null | undefined): string | null {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return null
  return trimmed.length > PREVIEW_MAX_LENGTH
    ? `${trimmed.slice(0, PREVIEW_MAX_LENGTH)}…`
    : trimmed
}

type TargetView = {
  /** 무엇을 신고하는지 한 줄 요약 */
  summary: string
  /** 신고할 내용 일부. 없으면 null */
  preview: string | null
  /** 그 내용을 남긴 사람. 탈퇴했으면 null */
  ownerId: string | null
  /**
   * 그 내용이 있던 관계방. 차단은 방 설정 화면에서만 걸 수 있어서 안내 링크에 쓴다.
   * 이용자 신고처럼 방을 특정할 수 없으면 null.
   */
  roomId: string | null
}

/**
 * 부적절한 콘텐츠·이용자 신고 화면. (이용약관 제9조 3항)
 *
 * 이 화면이 하는 일:
 *   1) 신고할 대상이 실제로 있고 내가 볼 수 있는 것인지 확인한다 (조회는 RLS를 그대로 탄다)
 *   2) 이미 신고한 대상이면 다시 받지 않고 그렇게 안내한다
 *   3) 사유를 고르고 확인한 뒤 접수한다 (ReportDialog)
 *
 * 대상 id는 주소창에서 오는 값이라 아무 uuid나 적어 넣을 수 있다.
 * 확인 없이 받으면 있지도 않은 대상에 대한 신고가 쌓여 검토할 사람의 시간을 낭비시킨다.
 * (같은 확인을 Server Action에서도 다시 한다 — 화면의 검사는 믿을 수 없다)
 */
export default async function ReportPage({
  params,
  searchParams,
}: PageProps<'/report/[targetType]/[targetId]'>) {
  const [{ targetType, targetId }, query] = await Promise.all([
    params,
    searchParams,
  ])

  // 돌아갈 곳. 외부 주소로 나가지 못하게 거른다. 값이 없으면 홈으로.
  const backHref = safeNextPath(query.next)

  const user = await requireUser()

  if (!isReportTargetType(targetType) || !isUuidLike(targetId)) {
    return (
      <Shell title="신고할 대상을 찾지 못했어요" backHref={backHref}>
        주소가 중간에 잘렸을 수 있어요. 앞 화면으로 돌아가 신고 버튼을 다시
        눌러주세요.
      </Shell>
    )
  }

  const supabase = await createClient()
  const target = await loadTarget(supabase, targetType, targetId)

  if (!target) {
    return (
      <Shell title="신고할 내용을 찾지 못했어요" backHref={backHref}>
        이미 지워졌거나, 지금은 볼 수 없는 내용일 수 있어요. 이미 그분을
        차단하셨다면 그분이 남긴 글은 보이지 않아요.
      </Shell>
    )
  }

  if (target.ownerId && target.ownerId === user.id) {
    return (
      <Shell title="내가 남긴 내용이에요" backHref={backHref}>
        내가 남긴 내용은 신고 대상이 아니에요. 지우고 싶은 내용이라면 앞 화면에서
        직접 지워주세요.
      </Shell>
    )
  }

  // 같은 대상을 두 번 신고하지 못하게 막는다.
  // DB에 unique 제약이 없어서(스키마는 임의로 바꾸지 않는다) 여기서 먼저 조회한다.
  // RLS(reports_select)가 내 신고만 보여주므로, 남이 신고했는지는 알 수 없다 — 그게 맞다.
  const { data: existing } = await supabase
    .from('reports')
    .select('id, created_at')
    .eq('reporter_id', user.id)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: false })
    .limit(1)

  const alreadyReported = existing?.[0] ?? null

  // 차단은 "함께 있는 관계방의 설정 > 함께하는 분" 목록에서만 걸 수 있다.
  // 어느 방인지 알 때만 링크를 준다. 잘못된 곳으로 보내면 안내가 없느니만 못하다.
  const blockHref = target.roomId ? `/rooms/${target.roomId}/settings` : null

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-ink">신고하기</h1>
        <p className="text-base leading-relaxed text-muted">
          불편한 일이 있으셨다면 알려주세요. 운영자가 확인한 뒤 필요한 조치를
          취해요.
        </p>
      </header>

      {alreadyReported ? (
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink">이미 신고하셨어요</h2>
            <p className="text-base leading-relaxed text-muted">
              {formatKstDate(alreadyReported.created_at)}에 접수된 신고가 있어요.
              같은 내용을 다시 접수하지 않으셔도 괜찮아요. 운영자가 확인하고
              있어요.
            </p>
            <p className="text-base leading-relaxed text-muted">
              신고한 내용: {target.summary}
            </p>
          </div>

          {/* 문구는 실제 동작과 맞춰 적는다. 차단을 거는 곳은 방 설정 화면이다. */}
          <aside className="flex flex-col gap-2 rounded-[14px] bg-primary-soft px-5 py-4">
            <h3 className="text-lg font-medium text-ink">
              지금 바로 안 보이게 하고 싶다면
            </h3>
            <p className="text-base leading-relaxed text-ink">
              상대를 차단하면 그분의 글이 내 화면에 더는 보이지 않아요.{' '}
              {blockHref ? (
                <>
                  차단은{' '}
                  <Link href={blockHref} className="text-primary underline">
                    이 방의 설정 화면
                  </Link>
                  에서 함께하는 분 목록을 열면 할 수 있어요.
                </>
              ) : (
                <>
                  차단은 그분과 함께 있는 관계방을 열고 [설정] 화면의 함께하는 분
                  목록에서 할 수 있어요.
                </>
              )}
            </p>
            <p className="text-base leading-relaxed text-muted">
              차단해도 지금까지 주고받은 기록은 지워지지 않아요. 차단하는
              동안에는 그분의 마음이 사서함에서도 보이지 않다가, 차단을 풀면 다시
              보여요.
            </p>
          </aside>

          <ButtonLink href={backHref} fullWidth>
            돌아가기
          </ButtonLink>
        </section>
      ) : (
        <ReportDialog
          targetType={targetType}
          targetId={targetId}
          targetSummary={target.summary}
          targetPreview={target.preview}
          backHref={backHref}
          blockHref={blockHref}
        />
      )}
    </main>
  )
}

/**
 * 신고할 대상을 한 줄 요약으로 만든다. 볼 수 없는 대상이면 null.
 *
 * 조회는 RLS를 그대로 탄다 — 남의 방 메시지나 나와 방을 함께 쓰지 않는 사람은
 * 여기서 자연스럽게 걸러진다. 별도의 권한 검사를 코드로 또 짜지 않는다.
 */
async function loadTarget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetType: ReportTargetType,
  targetId: string,
): Promise<TargetView | null> {
  if (targetType === 'user') {
    const { data } = await supabase
      .from('users')
      .select('id, name')
      .eq('id', targetId)
      .maybeSingle()

    if (!data) return null

    return {
      summary: `${data.name ?? WITHDRAWN_NAME}님`,
      preview: null,
      ownerId: data.id,
      // 이용자 신고는 여러 방에 걸쳐 있을 수 있어 한 방을 고를 수 없다.
      roomId: null,
    }
  }

  if (targetType === 'heart_message') {
    const { data } = await supabase
      .from('heart_messages')
      // 한 줄로 둔다 — 문자열을 이어 붙이면 타입 추론이 풀려서 결과 타입이 unknown이 된다.
      .select(
        'id, room_id, type, content, created_at, sender_id, sender:users!heart_messages_sender_id_fkey(id, name)',
      )
      .eq('id', targetId)
      .maybeSingle()

    if (!data) return null

    const senderName = data.sender_id
      ? (data.sender?.name ?? '이름 없음')
      : WITHDRAWN_NAME

    // 음성·영상은 글자로 인용할 수 없다. 종류만 알려준다.
    const preview =
      data.type === 'text'
        ? snippet(data.content)
        : data.type === 'voice'
          ? '음성으로 남긴 한마디예요'
          : '영상으로 남긴 한마디예요'

    return {
      summary: `${senderName}님이 ${formatKstDate(data.created_at)}에 남긴 마음 한마디`,
      preview,
      ownerId: data.sender_id,
      roomId: data.room_id,
    }
  }

  const { data } = await supabase
    .from('memories')
    .select(
      'id, room_id, media_type, description, created_at, author_id, author:users!memories_author_id_fkey(id, name)',
    )
    .eq('id', targetId)
    .maybeSingle()

  if (!data) return null

  const authorName = data.author_id
    ? (data.author?.name ?? '이름 없음')
    : WITHDRAWN_NAME
  const mediaNoun = data.media_type === 'video' ? '영상' : '사진'

  return {
    summary: `${authorName}님이 ${formatKstDate(data.created_at)}에 올린 ${mediaNoun}`,
    preview: snippet(data.description),
    ownerId: data.author_id,
    roomId: data.room_id,
  }
}

/** 신고를 진행할 수 없을 때 보여주는 안내 한 장. */
function Shell({
  title,
  backHref,
  children,
}: {
  title: string
  backHref: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-6 py-12 text-center">
      <h1 className="text-2xl font-bold leading-snug text-ink">{title}</h1>
      <p className="text-base leading-relaxed text-muted">{children}</p>
      <ButtonLink href={backHref} variant="secondary" fullWidth>
        돌아가기
      </ButtonLink>
    </main>
  )
}
