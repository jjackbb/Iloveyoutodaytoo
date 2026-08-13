import type { Metadata } from 'next'

import { MailboxTabs } from './mailbox-tabs'
import { TabScreen } from '@/components/layout/TabScreen'
import { ButtonLink } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { fetchMailboxPage, type MailboxBox } from '@/lib/actions/mailbox'
import { requireUser } from '@/lib/auth'

/**
 * 사서함 (캡처 38·39·46·47).
 *
 * 세그먼트 [받은 마음|보낸 마음] → 칩 줄 → 카드 목록 → 아래 고정 [🎙 마음 보내기].
 *
 * 첫 페이지는 서버에서 미리 채워 보내서 기다림 없이 바로 보이게 한다.
 * 마음을 보내고 돌아오면 `?box=sent`가 붙어 오므로 그 탭을 먼저 그린다 —
 * 방금 보낸 것이 안 보이면 보내기가 실패한 줄 안다(캡처 45 → 46의 흐름).
 */

export const metadata: Metadata = { title: '사서함 · 오늘도 사랑해' }

export default async function MailboxPage({
  searchParams,
}: {
  searchParams: Promise<{ box?: string; sent?: string }>
}) {
  // 로그인 확인. 서버 액션 쪽에서도 다시 확인하므로 여기만 믿지는 않는다.
  const [, query] = await Promise.all([requireUser(), searchParams])

  const initialBox: MailboxBox = query.box === 'sent' ? 'sent' : 'received'

  // 방금 보낸 통수. 주소로 넘어온 값이라 그대로 믿지 않고 숫자만 취한다.
  const sentCount = Number.parseInt(query.sent ?? '', 10)
  const justSent = Number.isFinite(sentCount) && sentCount > 0 ? sentCount : 0

  const initialPage = await fetchMailboxPage(initialBox, 0)

  return (
    <TabScreen
      title="사서함"
      leading={<MailIcon />}
      align="start"
      action={
        <ButtonLink href="/mailbox/send" fullWidth>
          <MicIcon />
          마음 보내기
        </ButtonLink>
      }
    >
      <MailboxTabs initialPage={initialPage} initialBox={initialBox} />

      {/* 마음을 막 보내고 돌아왔을 때만 뜬다 (캡처 44의 알약과 같은 부품). */}
      {justSent > 0 ? (
        <Toast
          message={`${justSent}명에게 마음을 보냈어요 💌`}
          offsetClassName="bottom-32"
        />
      ) : null}
    </TabScreen>
  )
}

/**
 * 앱바 제목 왼쪽의 편지 아이콘 (캡처 38).
 * 제목 글자가 이미 "사서함"이라고 읽히므로 낭독기에서는 숨긴다.
 */
function MailIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 text-primary"
    >
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  )
}

/** 아래 고정 버튼의 마이크 (캡처 38 — "🎙 마음 보내기"). */
function MicIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </svg>
  )
}
