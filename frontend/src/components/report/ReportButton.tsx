import { ButtonLink } from '@/components/ui/Button'
import {
  REPORT_TARGET_NOUN,
  type ReportTargetType,
} from '@/components/report/reasons'

/**
 * 신고 화면으로 가는 작은 버튼. 어느 화면에서든 붙여 쓸 수 있다.
 *
 * 왜 모달이 아니라 화면 이동인가:
 * 시니어 사용자가 주요 대상이다. 작은 창이 겹쳐 뜨면 "뒤로 가기"가 어디인지 헷갈리고,
 * 화면 낭독기에서도 초점이 튄다. 신고는 자주 하는 일이 아니라 한 화면을 통째로 써도 된다.
 * 자바스크립트 없이도 동작한다는 점도 덤이다.
 *
 * 눈에는 띄되 주된 동작처럼 보이면 안 된다:
 * 이 화면의 주인공은 언제나 "마음 한마디"다. 그래서 ghost(테두리 없는 연한) 모양에
 * 작은 크기를 기본으로 둔다. bg-primary(꽉 찬 분홍)는 쓰지 않는다.
 *
 * 색만으로 뜻을 전하지 않도록 깃발 아이콘과 '신고' 글자를 항상 함께 보여준다.
 */

export interface ReportButtonProps {
  targetType: ReportTargetType
  /** 신고할 대상의 uuid. reports.target_id에 그대로 들어간다. */
  targetId: string
  /**
   * 신고를 마치거나 그만두었을 때 돌아올 경로. 예: `/rooms/${roomId}`
   * 우리 사이트 안의 경로만 통한다(신고 화면에서 safeNextPath로 다시 거른다).
   */
  backTo?: string
  /**
   * 버튼에 적을 글자. 기본값 '신고'.
   * 목록 안에서 여러 개가 나란히 놓일 때는 기본값 그대로 두는 편이 덜 시끄럽다.
   */
  label?: string
  /**
   * 화면 낭독기에 읽어줄 문구. 목록에 버튼이 여럿이면 "신고"만으로는 무엇을 신고하는지
   * 알 수 없으므로, 대상을 알아볼 수 있는 말을 넣어준다. 예: "김영희님이 남긴 마음 한마디 신고하기"
   */
  accessibleLabel?: string
  className?: string
}

export function ReportButton({
  targetType,
  targetId,
  backTo,
  label = '신고',
  accessibleLabel,
  className,
}: ReportButtonProps) {
  const query = backTo ? `?next=${encodeURIComponent(backTo)}` : ''
  const href = `/report/${targetType}/${targetId}${query}`

  return (
    <ButtonLink
      href={href}
      variant="ghost"
      size="md"
      aria-label={
        accessibleLabel ?? `${REPORT_TARGET_NOUN[targetType]} 신고하기`
      }
      className={['text-muted hover:text-primary', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      <FlagIcon />
      {label}
    </ButtonLink>
  )
}

/** 신고를 뜻하는 깃발. 글자와 함께 쓰므로 낭독기에서는 숨긴다. */
function FlagIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 21V4" />
      <path d="M5 4.5h11l-2 3.5 2 3.5H5" />
    </svg>
  )
}
