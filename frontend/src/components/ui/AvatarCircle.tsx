/**
 * 동그란 프로필 사진.
 *
 * 마이 카드·내 정보·마음 보내기(받는 사람 고르기)·사서함 카드가 같은 모양을 써야 해서
 * 부품으로 뺐다. 한쪽만 고쳐지는 일을 없애려는 것이다.
 * (원래 src/app/my/avatar-circle.tsx에 있던 것을 사서함에서도 쓰게 되면서 여기로 옮겼다)
 *
 * 사진이 없으면 **이름 첫 글자**를 쓴다.
 *
 * 2026-08-25까지는 하트를 그렸는데, 하트는 로고도 기능 아이콘도 아닌 어중간한 자리였다.
 * 게다가 사람이 여럿 있는 화면에서는 **모두가 같은 하트**라 누가 누군지 구분이 안 됐다.
 * 첫 글자는 사람마다 달라서 목록에서 눈이 바로 짚는다.
 * 같은 규칙을 MemberStack도 쓴다(@/lib/member-name 의 nameInitial).
 *
 * 앨범방을 가리키는 자리(마음 보내기의 "ㅇㅇ (전체)")에는 사람 사진이 없다.
 * 그때는 방 커버 그라데이션을 대신 깔 수 있게 `fallbackGradient`를 열어 뒀다 —
 * 하트를 그리면 "사람"으로 읽혀서 방과 개인이 구분되지 않는다.
 *
 * 서버·브라우저 어느 쪽에서 그려도 되도록 상태를 두지 않았다. props만 받는다.
 */

import { nameInitial } from '@/lib/member-name'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

/** 지름. xs는 목록 줄, sm은 마이 카드·고른 사람 칩, lg는 내 정보 화면. */
const BOX_CLASS: Record<AvatarSize, string> = {
  xs: 'h-11 w-11',
  sm: 'h-14 w-14',
  md: 'h-[68px] w-[68px]',
  lg: 'h-[120px] w-[120px]',
}

/** 첫 글자의 크기. 동그라미 지름의 절반쯤이라야 갇힌 느낌 없이 앉는다. */
const INITIAL_CLASS: Record<AvatarSize, string> = {
  xs: 'text-lg',
  sm: 'text-2xl',
  md: 'text-[28px]',
  lg: 'text-5xl',
}

export function AvatarCircle({
  /** 서명된 사진 주소. 없으면 이름 첫 글자(또는 fallbackGradient)를 그린다. */
  url,
  /** 낭독기에서 누구의 사진인지 말해주기 위해 받는다. */
  name,
  size = 'sm',
  fallbackGradient = null,
  alt,
}: {
  url: string | null
  name: string
  size?: AvatarSize
  /** 사진이 없을 때 첫 글자 대신 깔 CSS 그라데이션(방 커버). */
  fallbackGradient?: string | null
  /**
   * 낭독기에 읽힐 그림 설명. 안 주면 "○○님의 프로필 사진".
   * 사람이 아닌 자리(앨범방 커버)는 "○○ 커버 사진"처럼 직접 준다 —
   * 방을 두고 "님의 프로필 사진"이라고 읽으면 사람으로 오해한다.
   */
  alt?: string
}) {
  return (
    <div
      className={[
        'relative shrink-0 overflow-hidden rounded-full bg-primary-soft',
        BOX_CLASS[size],
      ].join(' ')}
      // 그라데이션 값은 @/lib/covers가 정한 방 커버 팔레트다. 여기서 색을 만들지 않는다.
      style={fallbackGradient && !url ? { backgroundImage: fallbackGradient } : undefined}
    >
      {url ? (
        /*
          next/image를 쓰지 않는다. 이 주소는 비공개 버킷의 **서명된 주소**라
          한 시간마다 값이 바뀐다 — next.config의 remotePatterns에 도메인을 등록하고
          최적화 캐시를 돌려봐야 매번 새 주소라 캐시가 맞지 않는다.
          그림 하나가 100KB 안쪽(512px JPEG)이라 최적화로 얻을 것도 거의 없다.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt ?? `${name}님의 프로필 사진`}
          className="h-full w-full object-cover"
        />
      ) : fallbackGradient ? null : (
        /*
          옆에 이름이 이미 적혀 있는 자리가 대부분이라 낭독기에서는 숨긴다 —
          안 숨기면 "민 민규"처럼 두 번 읽힌다.
        */
        <span
          aria-hidden
          className={[
            'flex h-full w-full items-center justify-center font-bold text-primary',
            INITIAL_CLASS[size],
          ].join(' ')}
        >
          {nameInitial(name)}
        </span>
      )}
    </div>
  )
}
