import type { Metadata } from 'next'

import { SendForm } from './send-form'
import { RoomAppBar } from '@/components/room/RoomAppBar'
import { loadSendCandidates } from '@/lib/actions/heart-send'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: '마음 보내기 · 오늘도 사랑해' }

/**
 * 마음 보내기 (캡처 40~45).
 *
 * 모양: [←] 마음 보내기 / "받는 사람" +추가하기 / "메세지 녹음" 마이크 카드 / 아래 고정 [보내기]
 *
 * 받는 사람 후보만 서버가 읽어 내려준다. 녹음은 브라우저에서 만들고,
 * 고른 것을 실제 받는 사람으로 푸는 일은 **보내기를 누른 순간** 서버가 다시 한다
 * (화면을 열어둔 사이에 누가 방을 나갔을 수 있다).
 *
 * 머리띠는 앨범방 화면들과 같은 부품을 쓴다. 이름은 RoomAppBar지만 하는 일은
 * "[←] + 제목"이라 캡처 40의 머리띠와 똑같다 — 같은 모양을 두 벌 만들지 않는다.
 *
 * 탭바가 없다(캡처 40). 보내는 중에 다른 탭으로 새면 녹음이 사라지기 때문이다.
 */
export default async function SendHeartPage() {
  await requireUser()

  const candidates = await loadSendCandidates()

  return (
    <div className="flex h-[100dvh] flex-col">
      <RoomAppBar
        backHref="/mailbox"
        backLabel="사서함으로 돌아가기"
        title="마음 보내기"
      />

      <SendForm candidates={candidates} />
    </div>
  )
}
