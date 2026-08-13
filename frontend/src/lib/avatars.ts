import { createClient } from '@/lib/supabase/server'

/**
 * 프로필 사진(아바타).
 *
 * `users.profile_image`에는 **주소가 아니라 저장 경로**가 들어간다.
 *   예) `9f3c…-uuid/avatar-1754800000000.jpg`
 *
 * 왜 경로인가: avatars 버킷은 비공개다(public=false). 주소를 통째로 넣어두면
 * 서명이 만료된 뒤 죽은 주소가 DB에 남는다. 경로만 두고 볼 때마다 서명을 새로 만든다.
 *
 * 경로 맨 앞이 반드시 **본인 user id**여야 한다 — 버킷 정책 네 개가 전부
 * `path_uuid(name) = auth.uid()` 를 본다(covers는 방 id, media·voice도 같은 규약).
 * 읽기만 예외로 `shares_room_with(...)`가 더 붙어 있어, 같은 방을 쓰는 분은
 * 서로의 프로필 사진을 볼 수 있다.
 */

export const AVATAR_BUCKET = 'avatars'

/**
 * 서명 주소의 유효 시간(초).
 *
 * 마이·내 정보 화면은 오래 열어두는 화면이 아니다. 다만 시니어 사용자가
 * 화면을 켜둔 채 자리를 비우는 일이 있어 홈 커버와 같은 한 시간으로 맞췄다.
 */
export const AVATAR_URL_TTL_SEC = 60 * 60

/** 새로 올릴 파일이 놓일 자리. 시각을 붙여 이름이 겹치지 않게 한다. */
export function avatarPath(userId: string): string {
  return `${userId}/avatar-${Date.now()}.jpg`
}

/**
 * 저장 경로 하나를 화면에 띄울 수 있는 주소로 바꾼다.
 *
 * 만들지 못했으면 조용히 null을 돌려준다 — 깨진 이미지 아이콘 대신
 * 기본 그림(하트)이 보이는 편이 낫다. 원인은 서버 로그에만 남긴다.
 */
export async function loadAvatarUrl(
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null

  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, AVATAR_URL_TTL_SEC)

  if (error || !data?.signedUrl) {
    console.error('[프로필 사진] 서명 주소 실패:', error?.message ?? '주소 없음')
    return null
  }
  return data.signedUrl
}
