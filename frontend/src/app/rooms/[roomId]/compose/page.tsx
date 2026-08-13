import type { Metadata } from 'next'

import { RoomAppBar } from '@/components/room/RoomAppBar'
import { ComposeForm } from './compose-form'

export const metadata: Metadata = { title: '마음 표현하기 · 오늘도 사랑해' }

/**
 * 마음 표현하기 (캡처 12~21).
 *
 * 이 화면은 서버에서 가져올 것이 없다 — 사진도 녹음도 문구도 전부 브라우저에서 만든다.
 * 그래서 여기서는 머리띠와 껍데기만 그리고, 나머지는 compose-form.tsx가 맡는다.
 * (예전의 '오늘의 질문'과 '받는 사람 고르기'는 캡처 흐름에 없다.
 *  1:1로 보내는 마음은 사서함의 [마음 보내기]로 옮겨 갔다 — 4단계)
 *
 * 이 방의 멤버가 맞는지는 상위 layout.tsx가 이미 확인했다.
 */
export default async function ComposePage({
  params,
}: PageProps<'/rooms/[roomId]/compose'>) {
  const { roomId } = await params

  return (
    <div className="flex h-[100dvh] flex-col">
      <RoomAppBar
        backHref={`/rooms/${roomId}`}
        backLabel="앨범방으로 돌아가기"
        title="마음 표현하기"
      />

      <ComposeForm roomId={roomId} />
    </div>
  )
}
