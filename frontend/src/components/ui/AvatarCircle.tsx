/**
 * 동그란 프로필 사진.
 *
 * 마이 카드·내 정보·마음 보내기(받는 사람 고르기)·사서함 카드가 같은 모양을 써야 해서
 * 부품으로 뺐다. 한쪽만 고쳐지는 일을 없애려는 것이다.
 * (원래 src/app/my/avatar-circle.tsx에 있던 것을 사서함에서도 쓰게 되면서 여기로 옮겼다)
 *
 * 사진이 없으면 **브랜드 하트**를 기본 그림으로 쓴다(캡처 그대로).
 * 사람 실루엣 아이콘을 쓰지 않은 이유: 하트는 이미 앱바·스플래시에서 쓰는 우리 표시라
 * 처음 보는 그림이 아니다.
 *
 * 앨범방을 가리키는 자리(마음 보내기의 "ㅇㅇ (전체)")에는 사람 사진이 없다.
 * 그때는 방 커버 그라데이션을 대신 깔 수 있게 `fallbackGradient`를 열어 뒀다 —
 * 하트를 그리면 "사람"으로 읽혀서 방과 개인이 구분되지 않는다.
 *
 * 서버·브라우저 어느 쪽에서 그려도 되도록 상태를 두지 않았다. props만 받는다.
 */

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

/** 지름. xs는 목록 줄, sm은 마이 카드·고른 사람 칩, lg는 내 정보 화면. */
const BOX_CLASS: Record<AvatarSize, string> = {
  xs: 'h-11 w-11',
  sm: 'h-14 w-14',
  md: 'h-[68px] w-[68px]',
  lg: 'h-[120px] w-[120px]',
}

const HEART_CLASS: Record<AvatarSize, string> = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-[68px] w-[68px]',
}

export function AvatarCircle({
  /** 서명된 사진 주소. 없으면 기본 하트(또는 fallbackGradient)를 그린다. */
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
  /** 사진이 없을 때 하트 대신 깔 CSS 그라데이션(방 커버). */
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
        <span className="flex h-full w-full items-center justify-center">
          {/* 글자가 이미 이름을 말해주므로 낭독기에서는 숨긴다. */}
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
            className={['text-primary', HEART_CLASS[size]].join(' ')}
          >
            <path d="M12 20.5S3.5 15.2 3.5 9.4A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 8.5 3.4c0 5.8-8.5 11.1-8.5 11.1Z" />
          </svg>
        </span>
      )}
    </div>
  )
}
