/**
 * 오늘의 질문 프롬프트.
 *
 * 왜 필요한가:
 * "오늘 한마디 남기세요"라는 빈 칸 앞에서 사람들은 대체로 멈춘다.
 * 구체적인 질문 하나가 있으면 훨씬 쉽게 쓴다(01_PRD.md §5 "구체적 질문 프롬프트").
 *
 * 지켜야 할 톤:
 * - 부담을 주지 않는다. "매일 써야 해요" 같은 압박, "왜 안 썼어요" 같은 추궁은 없다.
 * - 답을 강제하지 않는다. 질문은 어디까지나 거들 뿐이고, 무시하고 아무 말이나 써도 된다.
 * - 시니어 사용자가 소리 내어 읽어도 어색하지 않은 쉬운 말로 쓴다.
 *
 * 여기서 고른 질문은 heart_messages.prompt_used 컬럼에 그대로 저장된다.
 */

import { kstTodayKey } from '@/lib/format'

/**
 * 질문 목록. 날짜에 따라 이 중 하나가 뽑힌다.
 *
 * 순서를 바꾸거나 중간에 끼워 넣어도 괜찮다 — 뽑는 방식이 순번이 아니라
 * 날짜 해시라서, 목록이 바뀌면 그날 질문도 자연스럽게 바뀔 뿐 아무것도 깨지지 않는다.
 */
export const HEART_PROMPTS: readonly string[] = [
  '오늘 그 사람의 어떤 점이 고마웠어요?',
  '요즘 그 사람에게 가장 해주고 싶은 말은 뭔가요?',
  '오늘 문득 그 사람이 떠오른 순간이 있었나요?',
  '그 사람과 함께 있을 때 제일 편안한 순간은 언제인가요?',
  '오늘 하루 어땠는지 한 문장으로 들려주세요.',
  '그 사람에게 배운 것 중 지금도 쓰고 있는 게 있나요?',
  '요즘 그 사람의 하루가 어떤지 궁금한 게 있나요?',
  '오늘 본 것 중에 그 사람에게 보여주고 싶은 게 있었나요?',
  '그 사람과 같이 먹고 싶은 음식이 있다면 뭔가요?',
  '함께 웃었던 기억 하나만 떠올려볼까요?',
  '그 사람에게 미처 못 한 말이 있다면 뭘까요?',
  '오늘 그 사람이 곁에 있었다면 뭐라고 했을까요?',
  '요즘 그 사람이 잘 지내는 것 같아 마음이 놓이는 점이 있나요?',
  '다음에 만나면 같이 하고 싶은 일이 있나요?',
  '오늘 마음이 따뜻해진 순간을 하나 나눠주세요.',
]

/**
 * 문자열을 숫자로 바꾸는 아주 단순한 해시(FNV-1a 변형).
 *
 * 암호용이 아니다. "같은 날 같은 방이면 항상 같은 질문"만 보장하면 되므로
 * 라이브러리를 들이지 않고 여기서 짧게 끝낸다.
 */
function hashToInt(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    // 32비트 곱셈. Math.imul을 쓰면 큰 수에서 정밀도가 흐트러지지 않는다.
    hash = Math.imul(hash, 16777619)
  }
  // 부호 없는 32비트로 맞춘다.
  return hash >>> 0
}

export interface DailyPromptOptions {
  /**
   * 방마다 다른 질문이 나오게 하는 값. 보통 roomId를 넣는다.
   * 넣지 않으면 그날 모든 방에 같은 질문이 뜬다.
   */
  seed?: string | null
  /**
   * 기준 날짜(KST 날짜 키, 예: '2026-08-07'). 기본값은 오늘.
   * 서버와 브라우저가 같은 값을 보게 하려면 서버에서 뽑아 props로 내려주는 편이 안전하다.
   */
  dateKey?: string
}

/**
 * 오늘의 질문 하나.
 *
 * 같은 날 · 같은 방이면 몇 번을 불러도 같은 질문이 나온다.
 * (작성 화면을 껐다 켰다 할 때 질문이 바뀌면 산만하다)
 */
export function getDailyPrompt(options?: DailyPromptOptions): string {
  const dateKey = options?.dateKey || kstTodayKey()
  const seed = options?.seed ?? ''

  const index = hashToInt(`${dateKey}|${seed}`) % HEART_PROMPTS.length
  return HEART_PROMPTS[index]
}

/**
 * ISO-8601 주차(1~53). 순수 달력 계산이라 시간대 변환이 다시 필요하지 않다 —
 * dateKey는 이미 kstTodayKey() 등을 거쳐 KST 기준 연-월-일로 정해져 있고,
 * 그 값을 UTC 자정으로 놓고 계산해도 "무슨 요일·몇 째 주"라는 달력상의 답은 같다.
 */
function isoWeekNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  // 그 날이 속한 주의 목요일로 옮긴다(ISO 주는 목요일이 있는 연도에 속한다).
  const dayNum = (date.getUTCDay() + 6) % 7 // 월=0 … 일=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3)

  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)

  return (
    1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
  )
}

/**
 * "이번 주 질문"의 목록 인덱스.
 *
 * 왜 날짜 해시(getDailyPrompt)가 아니라 ISO 주차인가:
 * 매번 무작위로 바뀌면 "우리가 이번 주에 받은 질문"이라는 감각이 안 생긴다.
 * 같은 주(월요일~일요일, KST)에는 항상 같은 질문에서 시작해야 그 감각이 생긴다.
 * [다른 질문 보기]로 그 자리에서 넘기는 것은 이 값과 무관하게 화면(클라이언트) 상태로만 다룬다.
 */
export function getWeeklyPromptIndex(dateKey?: string): number {
  const key = dateKey || kstTodayKey()
  return isoWeekNumber(key) % HEART_PROMPTS.length
}

/** 이번 주의 시작 질문. */
export function getWeeklyPrompt(dateKey?: string): string {
  return HEART_PROMPTS[getWeeklyPromptIndex(dateKey)]
}
