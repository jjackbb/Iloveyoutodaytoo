/**
 * 서비스 로고 (앱바·시작 화면에 붙는 작은 마크).
 *
 * 2026-08-25에 **직접 그린 하트 SVG를 버리고 실제 로고 이미지로 바꿨다.**
 * 하트는 그리기 쉬워서 임시로 쓰던 것이고, 로고와 다르게 생겼었다 —
 * 앱바에서 본 모양과 홈 화면 아이콘이 서로 다르면 같은 앱으로 안 읽힌다.
 *
 * ⚠️ **좋아요·즐겨찾기의 하트는 이것으로 바꾸지 마라.** 그쪽은 로고가 아니라
 * "누른다/눌렸다"를 뜻하는 기능 아이콘이라 로고로 대신할 수 없다.
 * (LikeButton, FavoriteButton, FavoriteHeartButton, AvatarCircle)
 *
 * 원본은 저장소 루트의 `logo.png`(1242px)이고, `public/logo.png`는 256px로 줄인 것이다.
 * 이 마크가 화면에 붙는 크기는 최대 44px이라 256px이면 3배 화면에서도 충분하다.
 */

type BrandMarkProps = {
  /** 보이는 한 변의 길이(px). 앱바 22, 시작 화면 44 정도. */
  size?: number
  className?: string
}

export function BrandMark({ size = 22, className }: BrandMarkProps) {
  return (
    // next/image 를 쓰지 않는다 — 크기가 고정된 작은 장식이라 최적화할 것이 없고,
    // Image 를 끼우면 서버/클라이언트 경계에서 걸리는 화면이 생긴다.
    //
    // width/height 를 속성으로도 적는 이유: 이미지가 늦게 와도 자리가 미리 잡혀
    // 옆 글자가 밀렸다 돌아오지 않는다(레이아웃 이동 방지).
    <img
      src="/logo.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={['shrink-0 rounded-[22%] object-contain', className]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
