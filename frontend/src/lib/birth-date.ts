/**
 * 생년월일 다루기 — 저장 형태는 'YYYY-MM-DD' 하나뿐이다.
 *
 * 화면에서는 "1985년 8월 9일"로 보여주고 년/월/일을 따로 입력받지만,
 * 폼으로 나가는 값과 DB(users.birth_date, date 타입)에 들어가는 값은 언제나 이 형태다.
 * 형태를 바꾸는 계산이 화면마다 흩어지면 "브라우저에서는 되는데 서버가 거절하는"
 * 일이 생긴다. 그래서 검사·조립·표시를 전부 여기 모았다.
 *
 * 서버·브라우저 양쪽에서 쓴다. 서버 전용 모듈을 import하지 않는다.
 */

/** 저장 형태. 이것 말고 다른 모양은 서버가 받지 않는다. */
export const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * 받아들이는 가장 이른 출생연도.
 * 살아 있는 사람의 나이 상한을 넉넉히 잡은 값이다. 1899년 같은 오타는 여기서 걸린다.
 */
export const MIN_BIRTH_YEAR = 1900

export interface BirthDateParts {
  year: number
  month: number
  day: number
}

/**
 * 휠에 늘어놓을 연도 — 1900년부터 올해까지.
 *
 * 예전에는 "올해로부터 100년"이라 1926년부터 시작했다. 그러면 1900~1925년생은
 * 휠로 고를 수가 없어서, 굴려도 굴려도 자기 해가 안 나온다.
 * 검사 하한(MIN_BIRTH_YEAR)과 같은 값으로 맞춰 두 곳이 어긋나지 않게 한다.
 */
export function birthYearOptions(today = new Date()): number[] {
  const thisYear = today.getFullYear()
  const length = Math.max(1, thisYear - MIN_BIRTH_YEAR + 1)
  return Array.from({ length }, (_, index) => MIN_BIRTH_YEAR + index)
}

/** 그 달에 며칠이 있는지. 윤년 2월(29일)도 여기서 맞는다. */
export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || !Number.isInteger(month)) return 31
  if (month < 1 || month > 12) return 31
  // 다음 달의 0일 = 이번 달의 마지막 날
  return new Date(year, month, 0).getDate()
}

/** 년/월/일 → 'YYYY-MM-DD'. 값이 하나라도 비면 빈 문자열. */
export function toIsoDate(parts: Partial<BirthDateParts>): string {
  const { year, month, day } = parts
  if (!year || !month || !day) return ''
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')
}

/** 'YYYY-MM-DD' → 년/월/일. 모양이 다르면 null. */
export function parseIsoDate(value: string): BirthDateParts | null {
  if (!BIRTH_DATE_PATTERN.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

/**
 * 생년월일로 쓸 수 있는 값인지 본다.
 * 맞으면 null, 아니면 그대로 보여줄 한국어 문구를 돌려준다.
 *
 * 여기서 잡는 것들:
 *   - 여섯 자리 연도(123456-08-09) — 예전 달력 입력칸이 그대로 받아주던 값이다
 *   - 13월, 32일, 2월 30일처럼 없는 날
 *   - 아직 오지 않은 날
 */
export function validateBirthDate(
  value: string,
  today = new Date(),
): string | null {
  if (!value) return '생년월일을 입력해주세요.'

  const parts = parseIsoDate(value)
  if (!parts) return '생년월일을 년 4자리, 월, 일로 정확히 입력해주세요.'

  const { year, month, day } = parts
  const thisYear = today.getFullYear()

  if (year < MIN_BIRTH_YEAR || year > thisYear) {
    return `태어난 해는 ${MIN_BIRTH_YEAR}년부터 ${thisYear}년 사이로 입력해주세요.`
  }
  if (month < 1 || month > 12) return '월은 1월부터 12월까지 있어요.'
  if (day < 1 || day > daysInMonth(year, month)) {
    return `${year}년 ${month}월은 ${daysInMonth(year, month)}일까지 있어요.`
  }

  // 시각까지 비교하면 같은 날이 미래로 잡힐 수 있어 날짜만 본다.
  const birth = new Date(year, month - 1, day)
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  if (birth.getTime() > todayOnly.getTime()) {
    return '아직 오지 않은 날짜예요. 다시 확인해주세요.'
  }

  return null
}

/** 년·월·일 덩이가 각각 받을 수 있는 자릿수. **연도 4자리 제한이 여기 한 곳에 있다.** */
const GROUP_LIMITS = [4, 2, 2] as const

/** 각 덩이 뒤에 붙는 단위. 입력칸에 보이는 구분자가 이 셋이다(참고/생년월일.png). */
const GROUP_UNITS = ['년', '월', '일'] as const

/**
 * 입력칸에 들어갈 수 있는 글자를 그 자리에서 제한한다. **연도 네 자리 제한의 본체다.**
 *
 * 왼쪽부터 한 글자씩 읽으며 년(4) · 월(2) · 일(2) 칸을 채운다.
 *  - 숫자: 지금 칸에 넣는다. 그 칸이 다 찼으면 **다음 칸으로 넘어가서** 넣는다.
 *    (그래서 `19850809` 를 쭉 치면 `1985년 08월 09` 가 된다 — 넘치는 숫자를 버리지 않는다.)
 *  - 기호(`-` `.` `/` 공백 `년` `월` `일` …): "이 칸은 여기까지"라는 뜻으로 다음 칸으로 넘어간다.
 *    (그래서 `1985.8.9` 처럼 한 자리로 적은 달·날도 그대로 살아난다.)
 *  - 세 칸이 다 차면 그 뒤 글자는 버린다.
 *
 * **구분자는 하이픈이 아니라 `년`·`월`·`일`이다.** 치는 동안에도 화면에는 늘 한국어로 보인다.
 * 다만 **마지막으로 적고 있는 덩이에는 단위를 붙이지 않는다** — 붙여 버리면 그 글자를
 * 지우자마자 다시 붙어서 숫자를 지울 수 없게 된다(지우기 함정).
 * 사용자가 직접 기호를 찍어 "이 칸 끝"이라고 알린 덩이에는 붙는다.
 *
 *   `19850809`        → `1985년 08월 09`
 *   `1985.8.9`        → `1985년 8월 9`
 *   `1985년 8월 9일`  → `1985년 8월 9일`   (제 손으로 찍은 단위는 그대로 — 한 번 더 지나도 같다)
 *   `1985`            → `1985`
 *   `1985년`          → `1985년`
 *   `123456`          → `1234년 56`        (넘친 두 자리가 달 칸으로)
 *   `12345678-08-09`  → `1234년 56월 78`   (앞 여덟 자리로 다 차고 나머지는 버림)
 *
 * 완성형("1985년 8월 9일" — 0을 떼고 단위까지 붙인 모양)으로 다듬는 일은 이 함수가 아니라
 * 값을 다 읽어낸 쪽(`BirthDateField`)이 `formatBirthDateKorean` 으로 한다.
 * 지우는 중인지 아닌지를 아는 쪽이 거기뿐이기 때문이다.
 *
 * `maxLength` 속성 하나로 끝내지 않는 이유: 그 속성은 **붙여넣기·자동완성을 막지 못하고**,
 * 무엇보다 이 칸은 년·월·일이 한 줄에 같이 들어오는 칸이라 전체 글자 수로는 연도를 제한할 수 없다
 * (`12345678-08-09` 도 열네 자다). 자릿수 제한은 칸 단위로만 뜻이 있다.
 */
export function maskTypedBirthDate(raw: string): string {
  const groups = ['', '', '']
  let index = 0
  /** 방금 기호를 찍어 "이 칸은 끝"이라고 알린 상태인지 ("1985년" 을 그대로 보여주기 위해). */
  let awaitingNext = false

  for (const char of raw) {
    if (index > 2) break

    if (char >= '0' && char <= '9') {
      // 지금 칸이 다 찼으면 다음 칸으로. 넘치는 숫자를 버리지 않는다.
      while (index <= 2 && groups[index].length >= GROUP_LIMITS[index]) {
        index += 1
      }
      if (index > 2) break

      groups[index] += char
      awaitingNext = false
      continue
    }

    // 기호. 아직 아무것도 안 적은 칸에서 찍은 기호는 무시한다(기호만 여러 번 친 경우).
    if (groups[index].length > 0) {
      index += 1
      awaitingNext = true
    }
  }

  // 칸은 왼쪽부터 차므로 마지막으로 채워진 칸까지가 곧 적은 만큼이다.
  const lastFilled = groups.reduce(
    (last, group, position) => (group ? position : last),
    -1,
  )
  if (lastFilled < 0) return ''

  const parts: string[] = []
  for (let position = 0; position <= lastFilled; position += 1) {
    // 뒤에 다른 칸이 있거나, 사용자가 기호로 끝을 알린 칸에만 단위를 붙인다.
    const closed = position < lastFilled || awaitingNext
    parts.push(groups[position] + (closed ? GROUP_UNITS[position] : ''))
  }
  return parts.join(' ')
}

/**
 * 사람이 친 글자를 'YYYY-MM-DD'로 읽어낸다. 못 읽으면 빈 문자열.
 *
 * 다음이 전부 같은 값이 된다:
 *   `19850809` · `1985-08-09` · `1985.8.9` · `1985 / 8 / 9` · `1985년 8월 9일`
 *
 * 왜 치는 대로 두고 나중에 읽는가:
 * 치는 동안 `1985-08-` 처럼 모양을 자동으로 고쳐주면 달을 한 자리로 적는 사람
 * (`1985.8.9`)이 조용히 다른 날짜가 된다. 넣은 그대로 두고 읽어내는 편이,
 * 무엇으로 읽었는지를 화면에 바로 보여줄 수 있어 오해가 없다.
 *
 * **연도는 언제나 네 자리만 인정한다.** `123456-08-09` 는 여기서 빈 값이 되어
 * 여섯 자리 연도가 만들어질 길이 없다.
 */
export function parseTypedBirthDate(raw: string): string {
  const groups = raw.split(/[^0-9]+/).filter(Boolean)

  // 기호로 나눠 적은 경우 — 1985.8.9, 1985년 8월 9일
  if (groups.length >= 3) {
    const [year, month, day] = groups
    if (year.length !== 4 || month.length > 2 || day.length > 2) return ''
    return toIsoDate({
      year: Number(year),
      month: Number(month),
      day: Number(day),
    })
  }

  // 숫자만 이어 적은 경우 — 19850809
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 8) return ''
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

/** 'YYYY-MM-DD' → "1985년 8월 9일". 못 읽으면 빈 문자열. */
export function formatBirthDateKorean(value: string): string {
  const parts = parseIsoDate(value)
  if (!parts) return ''
  return `${parts.year}년 ${parts.month}월 ${parts.day}일`
}
