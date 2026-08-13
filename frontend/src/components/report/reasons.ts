/**
 * 신고 기능에서 서버·화면이 함께 쓰는 값 모음. (약관 제9조 3항 근거)
 *
 * 왜 별도 파일인가:
 * 1) Server Action 파일('use server')은 async 함수만 export할 수 있다.
 *    사유 목록 같은 상수를 거기 두면 빌드가 통째로 깨진다. (@/lib/limits 와 같은 이유)
 * 2) 'use client' 파일에서 상수를 꺼내 서버 코드로 가져오면 클라이언트 참조 프록시가 되어
 *    서버에서 값으로 쓸 수 없다. 그래서 지시문·클라이언트 경계가 없는 순수 모듈로 둔다.
 * 3) 사유 목록이 화면(고르는 쪽)과 서버(검증하는 쪽)에 따로 적히면
 *    한쪽만 고쳐져 조용히 어긋난다. 단일 출처를 여기 하나로 못 박는다.
 *
 * DB 제약과 맞춰야 하는 값:
 * - reports.target_type CHECK ('user' | 'heart_message' | 'memory')
 * - reports.status CHECK ('pending' | 'reviewing' | 'resolved' | 'dismissed') — 넣을 땐 기본값 'pending'을 그대로 쓴다
 */

/* ------------------------------------------------------------------ */
/* 신고 대상                                                            */
/* ------------------------------------------------------------------ */

/** DB의 reports_target_type_check 와 반드시 같은 목록이어야 한다. */
export const REPORT_TARGET_TYPES = ['user', 'heart_message', 'memory'] as const

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number]

export function isReportTargetType(value: unknown): value is ReportTargetType {
  return (
    typeof value === 'string' &&
    (REPORT_TARGET_TYPES as readonly string[]).includes(value)
  )
}

/** 화면 문구에 넣을 대상 이름. "이 마음 한마디를 신고합니다" 처럼 쓴다. */
export const REPORT_TARGET_NOUN: Record<ReportTargetType, string> = {
  user: '이용자',
  heart_message: '마음 한마디',
  memory: '추억',
}

/* ------------------------------------------------------------------ */
/* 신고 사유                                                            */
/* ------------------------------------------------------------------ */

/**
 * reports.reason 에는 아래 value(영문 코드)를 그대로 넣는다.
 *
 * 왜 한국어 라벨이 아니라 코드인가:
 * 문구는 나중에 다듬어질 수 있는데, 그때마다 이미 쌓인 신고 기록의 값이 달라지면
 * "욕설·비방이 몇 건인지" 세는 것조차 어려워진다. 표시 문구는 reportReasonLabel()로 만든다.
 */
export const REPORT_REASONS = [
  {
    value: 'abuse',
    label: '욕설·비방',
    hint: '심한 말이나 모욕적인 표현이 있어요',
  },
  {
    value: 'sexual',
    label: '음란물·성적인 내용',
    hint: '보기 불편한 사진이나 표현이 있어요',
  },
  {
    value: 'impersonation',
    label: '사칭',
    hint: '다른 사람인 척하고 있어요',
  },
  {
    value: 'spam',
    label: '광고·스팸',
    hint: '광고나 관계없는 내용을 계속 보내요',
  },
  {
    value: 'other',
    label: '기타',
    hint: '위에 없는 다른 이유예요. 아래에 적어주세요',
  },
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]['value']

export function isReportReason(value: unknown): value is ReportReason {
  return (
    typeof value === 'string' &&
    REPORT_REASONS.some((reason) => reason.value === value)
  )
}

/** 저장된 코드를 사람이 읽는 문구로. 모르는 값이 들어오면 코드를 그대로 돌려준다. */
export function reportReasonLabel(value: string): string {
  return REPORT_REASONS.find((reason) => reason.value === value)?.label ?? value
}

/*
 * '자세한 내용'의 최대 글자 수(REPORT_DETAIL_MAX_LENGTH)는 여기 두지 않는다.
 * 길이 상한의 단일 출처는 @/lib/limits 다. 필요하면 거기서 가져다 쓴다.
 */

/* ------------------------------------------------------------------ */
/* 주소로 들어온 id 걸러내기                                             */
/* ------------------------------------------------------------------ */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 주소창의 target_id가 uuid 모양인지.
 *
 * 모양이 아니면 Postgres가 22P02(잘못된 입력 구문) 오류를 던지는데,
 * 그러면 사용자에게는 원인을 알 수 없는 오류 화면이 뜬다. 조회 전에 먼저 걸러낸다.
 */
export function isUuidLike(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}
