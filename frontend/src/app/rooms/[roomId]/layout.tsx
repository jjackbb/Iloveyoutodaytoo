import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * 앨범방 화면들의 문지기.
 *
 * 이 방의 멤버가 맞는지 여기서 한 번에 확인한다. 아니면 홈으로 돌려보낸다 —
 * 자식 화면(피드/작성/초대/설정)은 이 검사를 또 하지 않아도 된다.
 * (RLS가 이미 막아주지만, 빈 화면 대신 제대로 안내하려면 서버에서 확인해야 한다)
 *
 * **머리띠는 여기서 그리지 않는다.** 화면마다 제목도 오른쪽 동작도 다르고
 * (피드는 방 이름 + 멤버추가, 작성은 "마음 표현하기"), 피드는 아래 고정 버튼과
 * 탭까지 포함한 4단 셸이라 공통 껍데기 안에 넣으면 자리를 못 잡는다.
 * 머리띠는 각 화면이 RoomAppBar로 직접 그린다.
 */
export default async function RoomLayout({
  children,
  params,
}: LayoutProps<'/rooms/[roomId]'>) {
  const { roomId } = await params
  const user = await requireUser()
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  // 멤버가 아니거나 이미 나간 방이면 조용히 홈으로 보낸다.
  if (!membership) redirect('/')

  return children
}
