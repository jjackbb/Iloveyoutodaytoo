import { nameInitial } from '@/lib/member-name'

/**
 * 앨범방 멤버 아바타 더미. 커버 사진 위에 겹쳐 놓는다(캡처 37 좌하단).
 *
 * 프로필 사진 기능이 아직 없어서 이름 첫 글자를 쓴다.
 * 사진이 생기면 이 컴포넌트 안만 고치면 되고 부르는 쪽은 그대로다.
 *
 * 커버가 어떤 색일지 알 수 없으므로 동그라미마다 흰 테두리를 두른다 —
 * 밝은 커버 위에서도 서로 겹친 경계가 보인다.
 */

/** 한 번에 보여줄 최대 인원. 넘으면 마지막 자리에 "+N"으로 접는다. */
const VISIBLE_LIMIT = 3

export function MemberStack({ names }: { names: string[] }) {
  const visible = names.slice(0, VISIBLE_LIMIT)
  const extra = names.length - visible.length

  return (
    // 낭독기에는 동그라미를 하나씩 읽히지 않고 한 문장으로 전한다.
    <div className="flex" role="img" aria-label={`멤버 ${names.length}명`}>
      {visible.map((name, index) => (
        <span
          key={`${name}-${index}`}
          aria-hidden
          className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary-soft text-sm font-bold text-primary first:ml-0"
        >
          {nameInitial(name)}
        </span>
      ))}

      {extra > 0 ? (
        <span
          aria-hidden
          className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-sm font-bold text-white"
        >
          +{extra}
        </span>
      ) : null}
    </div>
  )
}
