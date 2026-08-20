/**
 * KST(한국 표준시) 기준 날짜·시각 표시 도우미.
 *
 * 왜 이 파일이 필요한가:
 * DB의 created_at은 UTC로 저장된다(02_DATA_MODEL.md). 하지만 사용자에게 보여줄 때와
 * "오늘/어제"를 따질 때는 반드시 한국 시간 자정을 기준으로 해야 한다.
 * 서버(Vercel, UTC)와 브라우저(사용자 기기 시간대)에서 결과가 달라지면
 * 화면이 깜빡이며 다른 날짜로 바뀌므로, timeZone을 항상 명시해 못 박는다.
 *
 * 주의: 스트릭 계산은 DB 트리거가 이미 한다. 여기 함수들은 "표시" 전용이다.
 */

/** 모든 날짜 계산의 기준 시간대. */
export const KST_TIME_ZONE = 'Asia/Seoul'

/** 이 파일의 함수들이 받아주는 값. Date, ISO 문자열, 타임스탬프 숫자 모두 가능. */
export type DateInput = Date | string | number

const MS_PER_DAY = 86_400_000

/** 잘못된 값이 들어와도 화면이 죽지 않도록 null로 흘려보낸다. */
function toDate(input: DateInput | null | undefined): Date | null {
  if (input === null || input === undefined) return null
  const date = input instanceof Date ? input : new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

type KstParts = { year: number; month: number; day: number }

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KST_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function toKstParts(date: Date): KstParts {
  const parts = partsFormatter.formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')

  return { year: pick('year'), month: pick('month'), day: pick('day') }
}

/**
 * KST 기준 날짜 키. 예: "2026-08-07"
 * 두 시각이 "같은 날"인지 비교할 때 이 값을 문자열로 비교하면 된다.
 */
export function toKstDateKey(input: DateInput | null | undefined): string {
  const date = toDate(input)
  if (!date) return ''
  const { year, month, day } = toKstParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 지금 이 순간의 KST 날짜 키. 예: "2026-08-07" */
export function kstTodayKey(): string {
  return toKstDateKey(new Date())
}

/** 날짜 키("2026-08-07")를 비교 가능한 숫자로. 내부용. */
function dateKeyToTime(key: string): number | null {
  if (!key) return null
  const time = Date.parse(`${key}T00:00:00Z`)
  return Number.isNaN(time) ? null : time
}

/**
 * KST 기준으로 두 날짜가 며칠 차이인지. (뒤 - 앞)
 * 예: kstDaysBetween('어제', '오늘') === 1
 */
export function kstDaysBetween(
  from: DateInput | null | undefined,
  to: DateInput | null | undefined,
): number | null {
  const fromTime = dateKeyToTime(toKstDateKey(from))
  const toTime = dateKeyToTime(toKstDateKey(to))
  if (fromTime === null || toTime === null) return null
  return Math.round((toTime - fromTime) / MS_PER_DAY)
}

function formatWith(
  input: DateInput | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(input)
  if (!date) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: KST_TIME_ZONE,
    ...options,
  }).format(date)
}

/**
 * "8월 7일" — 올해가 아니면 "2025년 8월 7일"
 * withYear를 직접 주면 강제할 수 있다.
 */
export function formatKstDate(
  input: DateInput | null | undefined,
  options?: { withYear?: boolean },
): string {
  const date = toDate(input)
  if (!date) return ''

  const withYear =
    options?.withYear ??
    toKstParts(date).year !== toKstParts(new Date()).year

  return formatWith(date, {
    year: withYear ? 'numeric' : undefined,
    month: 'long',
    day: 'numeric',
  })
}

/** "2026년 8월 7일" — 연도를 항상 붙인다. (방 시작일 등) */
export function formatKstFullDate(input: DateInput | null | undefined): string {
  return formatKstDate(input, { withYear: true })
}

/** "금요일" */
export function formatKstWeekday(input: DateInput | null | undefined): string {
  return formatWith(input, { weekday: 'long' })
}

/** "오후 3:12" */
export function formatKstTime(input: DateInput | null | undefined): string {
  return formatWith(input, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * 사람이 읽기 편한 날짜. "오늘" / "어제" / "그저께" / "8월 7일"
 * 시니어 사용자가 한눈에 알아보도록 최근 날짜는 말로 바꿔준다.
 */
export function formatKstDay(input: DateInput | null | undefined): string {
  const diff = kstDaysBetween(input, new Date())
  if (diff === null) return ''

  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff === 2) return '그저께'
  if (diff === -1) return '내일'

  return formatKstDate(input)
}

/** "오늘 오후 3:12" / "8월 5일 오전 9:04" */
export function formatKstDateTime(input: DateInput | null | undefined): string {
  const day = formatKstDay(input)
  if (!day) return ''
  return `${day} ${formatKstTime(input)}`
}

/**
 * 목록에서 시각만 짧게 보여줄 때. 오늘이면 시각만, 아니면 날짜만.
 * 예: 오늘 → "오후 3:12", 지난주 → "8월 1일"
 */
export function formatKstCompact(input: DateInput | null | undefined): string {
  const diff = kstDaysBetween(input, new Date())
  if (diff === null) return ''
  return diff === 0 ? formatKstTime(input) : formatKstDate(input)
}

/** 오늘(KST)인지. */
export function isKstToday(input: DateInput | null | undefined): boolean {
  return kstDaysBetween(input, new Date()) === 0
}

/**
 * "방금 전" / "5분 전" / "3시간 전" / "2일 전" — 마지막 활동 시각.
 * 홈 앨범방 카드의 정보 줄에 쓴다(캡처 37: "멤버 1명 · 게시물 1개 · 방금 전").
 *
 * 한 달이 넘어가면 "31일 전"처럼 세는 것이 오히려 안 읽힌다. 그때는 날짜로 바꾼다.
 * 시간대를 타는 계산이 아니라 두 시각의 차이라 KST 변환이 필요 없다 —
 * created_at은 UTC로 저장돼 있고 Date끼리 빼면 그대로 절대 시간차가 된다.
 *
 * 서버에서 그려지는 값이라 화면에 붙은 뒤에는 저절로 갱신되지 않는다.
 * 홈은 서버 컴포넌트라 다시 들어올 때마다 새로 계산된다.
 */
export function formatRelativeTime(
  input: DateInput | null | undefined,
): string {
  const date = toDate(input)
  if (!date) return ''

  const diffMs = Date.now() - date.getTime()

  // 기기 시계가 서버보다 느리면 미래로 보일 수 있다. 그때도 "방금 전"이 자연스럽다.
  if (diffMs < 60_000) return '방금 전'

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes}분 전`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`

  const days = Math.floor(hours / 24)
  if (days <= 30) return `${days}일 전`

  return formatKstDate(date)
}

/**
 * 재생바 옆에 붙는 시계 표기. "0:17" / "1:05" (캡처 18·22)
 *
 * formatDuration("17초")과 나눠 쓰는 이유: 글로 읽어주는 자리(사서함 목록,
 * 낭독기 라벨)에는 "17초"가 자연스럽고, 재생바처럼 숫자가 1초마다 바뀌는 자리에는
 * 폭이 흔들리지 않는 시계 표기가 맞다. 한 함수로 합치면 둘 중 하나가 어색해진다.
 */
export function formatClock(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return '0:00'
  }
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/**
 * 음성/영상 길이. "12초" / "1분 5초"
 * duration_sec 컬럼을 그대로 넣으면 된다.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return ''
  }
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60

  if (minutes === 0) return `${rest}초`
  if (rest === 0) return `${minutes}분`
  return `${minutes}분 ${rest}초`
}

/**
 * KST 기준 "2026년 8월". 갤러리에서 사진을 월별로 묶는 이름이다.
 *
 * 묶는 이름을 **서버에서** 만들어 내려보낸다 — 브라우저 시간대에 따라
 * 월말 밤에 올린 사진이 다음 달로 넘어가면 안 된다.
 */
export function formatKstMonth(input: DateInput | null | undefined): string {
  const key = toKstDateKey(input)
  if (!key) return ''
  const [year, month] = key.split('-')
  return `${year}년 ${Number(month)}월`
}
