import type { Enums } from '@/types/database'

/**
 * 방 커버.
 *
 * 홈 화면의 카드는 커버 위에 정보가 얹히는 구조라 커버가 비면 카드가 무너진다.
 * 그래서 **커버 없는 방은 만들지 않는다** — 직접 올린 사진이 없으면 항상 프리셋을 쓴다.
 *
 * 프리셋을 사진이 아니라 그라데이션으로 만든 이유:
 * 이미지 파일을 쓰면 저작권을 따져야 하고, 방 목록을 열 때마다 내려받아야 한다.
 * 그라데이션은 CSS 한 줄이라 즉시 그려지고 어떤 화면 크기에서도 깨지지 않는다.
 *
 * ⚠️ 여기 키를 바꾸면 DB의 rooms_cover_preset_check 제약도 함께 고쳐야 한다.
 * 한쪽만 바꾸면 방 만들기가 통째로 실패한다.
 *
 * residue-scan-allow: hardcoded-color — 커버는 배경 전용 팔레트라 글자 대비 기준의 대상이 아니다.
 * 커버 위에 얹히는 글자는 이 색이 아니라 어두운 오버레이 위에 올라간다.
 */

export const COVER_PRESETS = {
  warm: {
    label: '노을',
    gradient: 'linear-gradient(135deg, #ffd9a8 0%, #ffb27a 100%)',
  },
  blush: {
    label: '분홍',
    gradient: 'linear-gradient(135deg, #ffd3e2 0%, #ff9ec0 100%)',
  },
  sky: {
    label: '하늘',
    gradient: 'linear-gradient(135deg, #cfe6ff 0%, #93c2f5 100%)',
  },
  sage: {
    label: '풀빛',
    gradient: 'linear-gradient(135deg, #d6ebd8 0%, #9ccba5 100%)',
  },
  dusk: {
    label: '해질녘',
    gradient: 'linear-gradient(135deg, #ddd6f3 0%, #a99be0 100%)',
  },
  sand: {
    label: '모래',
    gradient: 'linear-gradient(135deg, #ede7e3 0%, #cbbfb6 100%)',
  },
} as const

export type CoverPreset = keyof typeof COVER_PRESETS

/** 고르는 화면에서 쓸 목록. 객체 순서를 그대로 따른다. */
export const COVER_PRESET_LIST = Object.entries(COVER_PRESETS).map(
  ([key, value]) => ({ key: key as CoverPreset, ...value }),
)

export function isCoverPreset(value: unknown): value is CoverPreset {
  return typeof value === 'string' && value in COVER_PRESETS
}

/**
 * 관계 유형별 기본 커버.
 * 방을 만들 때 커버를 고르지 않아도 관계에 어울리는 색이 잡혀 있게 한다 —
 * 시니어 사용자에게 "골라야만 넘어갈 수 있는 단계"를 하나 더 만들지 않기 위해서다.
 */
export const DEFAULT_COVER_BY_TYPE: Record<
  Enums<'relationship_type'>,
  CoverPreset
> = {
  family: 'warm',
  lover: 'blush',
  friend: 'sky',
  self: 'sand',
}

/**
 * 카드에 씌울 배경 스타일.
 *
 * 직접 올린 사진(coverUrl)이 있으면 그것이 이긴다. 없으면 프리셋 그라데이션.
 * coverUrl은 비공개 버킷의 서명된 주소라, 만들지 못했으면 null로 들어온다 —
 * 그때는 조용히 프리셋으로 돌아간다. 깨진 이미지 아이콘을 보여주지 않는다.
 */
export function coverStyle(
  preset: string | null | undefined,
  coverUrl?: string | null,
): {
  backgroundImage: string
  backgroundSize: string
  backgroundPosition: string
} {
  const key = isCoverPreset(preset) ? preset : 'warm'

  return {
    // 서명된 주소에 따옴표가 섞여 들어와도 url(...)이 끊기지 않도록 인코딩한다.
    // (이 값은 서버 컴포넌트에서도 만들어지므로 브라우저 전용 API는 쓸 수 없다)
    backgroundImage: coverUrl
      ? `url("${coverUrl.replace(/"/g, '%22')}")`
      : COVER_PRESETS[key].gradient,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
}
