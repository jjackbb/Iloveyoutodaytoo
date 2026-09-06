import {
  HANDWRITING_H,
  HANDWRITING_PEN_WIDTH,
  HANDWRITING_W,
  strokePath,
  type HandwritingDoc,
} from '@/lib/handwriting'

/**
 * 손글씨를 **다 쓴 상태로** 그린다. 서버·클라이언트 어디서든 된다(상태 없음).
 *
 * 타임랩스(HandwritingPlayer)가 끝난 뒤의 마지막 장면이자, 재생이 필요 없는 자리
 * (작은 미리보기)에서 그대로 쓰는 그림이다. SVG 라 화면 크기에 따라 선명하게 늘어난다.
 *
 * 색은 currentColor — 부모의 글자색을 따른다. 펜은 검정 한 색(사용자 결정)이라
 * 텍스트와 같은 잉크색(text-ink)이면 된다.
 */
export function HandwritingView({
  doc,
  label,
  className,
}: {
  doc: HandwritingDoc
  /** 낭독기용. "○○님의 손글씨" */
  label: string
  className?: string
}) {
  return (
    <svg
      viewBox={`0 0 ${HANDWRITING_W} ${HANDWRITING_H}`}
      role="img"
      aria-label={label}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={HANDWRITING_PEN_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {doc.strokes.map((stroke, index) => (
        <path key={index} d={strokePath(stroke)} />
      ))}
    </svg>
  )
}
