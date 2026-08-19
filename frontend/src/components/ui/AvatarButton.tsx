'use client'

import { useState } from 'react'

import { PhotoViewer } from '@/components/media/PhotoViewer'
import { AvatarCircle } from '@/components/ui/AvatarCircle'

/**
 * 누르면 크게 보이는 프로필 사진 (노션 IA 6.4).
 *
 * 동그란 사진은 지름이 44~120px이라 얼굴을 알아보기 어렵다. 특히 시니어 사용자에게는
 * "누구인지 확인하려고" 누르는 동작이 자연스럽다.
 *
 * **사진이 없으면 버튼을 만들지 않는다.** 기본 하트 그림을 눌러 크게 봐야 할 이유가 없고,
 * 눌러도 아무 일이 없는 버튼은 고장 난 화면으로 읽힌다(프로필 사진 지우기 ×와 같은 판단).
 * 그때는 AvatarCircle을 그대로 그린다.
 *
 * 크게 보여주는 일은 사진 뷰어가 한다 — 사진 한 장짜리로 부른다.
 * 확대·닫기 규칙을 두 벌로 만들지 않기 위해서다.
 */
export function AvatarButton({
  url,
  name,
  size = 'sm',
  /** 낭독기에 읽힐 설명. 안 주면 "○○님의 프로필 사진". */
  alt,
}: {
  url: string | null
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  alt?: string
}) {
  const [open, setOpen] = useState(false)

  if (!url) return <AvatarCircle url={null} name={name} size={size} alt={alt} />

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${name}님의 프로필 사진 크게 보기`}
        className="rounded-full focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <AvatarCircle url={url} name={name} size={size} alt={alt} />
      </button>

      {open ? (
        <PhotoViewer
          photos={[{ url, alt: alt ?? `${name}님의 프로필 사진` }]}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}
