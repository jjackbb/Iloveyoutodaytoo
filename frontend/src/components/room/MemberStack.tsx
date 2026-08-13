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
          className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary-soft text-sm font-extrabold text-primary first:ml-0"
        >
          {initial(name)}
        </span>
      ))}

      {extra > 0 ? (
        <span
          aria-hidden
          className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-sm font-extrabold text-white"
        >
          +{extra}
        </span>
      ) : null}
    </div>
  )
}

/**
 * 이름에서 동그라미에 넣을 한 글자.
 *
 * 한글은 첫 글자가 곧 성이라 그대로 쓰고, 이름을 못 읽는 경우(방을 떠났거나 탈퇴)에는
 * 물음표 대신 사람 모양을 뜻하는 가운뎃점을 쓴다 — 물음표는 오류처럼 보인다.
 *
 * 이모지처럼 두 칸을 차지하는 글자가 첫 글자면 잘려서 깨지므로, 코드 포인트 단위로 자른다.
 */
function initial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '·'
  return [...trimmed][0] ?? '·'
}
