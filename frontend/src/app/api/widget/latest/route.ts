import { NextResponse } from 'next/server'

import {
  NO_STORE,
  anonClient,
  bearerToken,
  serviceClientForWidgetPhoto,
} from '@/lib/widget-api'

/**
 * GET /api/widget/latest — 홈 화면 위젯이 30분마다 부르는 "최근 표현 1건" (WIDGET-01).
 *
 * 인증은 쿠키 세션이 아니라 **위젯 전용 토큰**(Authorization: Bearer)이다. 위젯은
 * 웹뷰 밖에서 살아 세션을 못 본다. 검사는 DB 함수 widget_latest 가 한다 —
 * 여기서는 토큰을 그대로 넘기고 결과를 JSON 모양으로 옮길 뿐이다.
 *
 * 응답 모양은 android/…/widget/WidgetItem.java 가 그대로 읽는다. 필드를 바꾸면 그쪽도 함께.
 *   200 { item: { memoryId, roomId, roomName, authorId, authorName, createdAt,
 *                 photoUrl | null, voiceDurationSec | null, hasHandwriting, caption | null, isMine } }
 *   200 { item: null }   — 볼 것이 없다
 *   401                  — 토큰 없음/무효 → 위젯은 "앱에서 로그인해 주세요"
 */

export const dynamic = 'force-dynamic'

/** 서명 URL 유효 시간. 위젯 갱신 주기(30분)의 두 배 — 한 번 놓쳐도 다음 갱신까지 산다. */
const PHOTO_URL_TTL_SEC = 60 * 60
/** 추억 사진이 사는 버킷. memory_photos.storage_path 는 여기 경로다. */
const PHOTO_BUCKET = 'media'

export async function GET(request: Request) {
  const token = bearerToken(request)
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const { data, error } = await anonClient().rpc('widget_latest', { p_token: token })

  if (error) {
    // 28000 = DB 가 "토큰이 유효하지 않다"고 던진 것(supabase/schema/10). 나머지는 서버 탓.
    if (error.code === '28000') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
    }
    console.error('[위젯 API] latest 실패:', error.message)
    return NextResponse.json({ error: 'failed' }, { status: 500, headers: NO_STORE })
  }

  const row = data?.[0]
  if (!row) {
    return NextResponse.json({ item: null }, { headers: NO_STORE })
  }

  // 사진은 DB 가 "이 토큰이 봐도 되는 사진"이라고 답한 경로 하나에만 서명한다.
  let photoUrl: string | null = null
  if (row.photo_path) {
    const service = serviceClientForWidgetPhoto()
    if (service) {
      const { data: signed, error: signError } = await service.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(row.photo_path, PHOTO_URL_TTL_SEC)
      if (signError) {
        // 사진이 빠져도 위젯은 글로 그린다. 조용히 넘기되 원인은 남긴다.
        console.error('[위젯 API] 사진 서명 실패:', signError.message)
      } else {
        photoUrl = signed?.signedUrl ?? null
      }
    }
  }

  return NextResponse.json(
    {
      item: {
        memoryId: row.memory_id,
        roomId: row.room_id,
        roomName: row.room_name,
        authorId: row.author_id,
        authorName: row.author_name,
        createdAt: row.created_at,
        photoUrl,
        voiceDurationSec: row.voice_duration_sec ?? null,
        hasHandwriting: Boolean(row.handwriting_path),
        caption: row.caption ?? null,
        isMine: row.is_mine,
      },
    },
    { headers: NO_STORE },
  )
}
