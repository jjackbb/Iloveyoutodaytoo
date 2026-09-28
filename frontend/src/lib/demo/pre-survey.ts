/** 첫 설문은 서버나 데모 IndexedDB에 넣지 않고 현재 탭의 임시 저장소에만 둔다. */
const KEY = 'oneuldo-pre-survey-v1'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export type PreSurveyScene = 'expressed' | 'withheld' | 'none'
export type PreSurvey = {
  version: 1
  savedAt: number
  enteredBy: 'participant' | 'interviewer'
  portfolioUse: 'yes' | 'no'
  usual: string
  scene: PreSurveyScene
  expressedScene: string
  reflection: string
  withheldScene: string
  laterAction: string
  withheldReason: string
  easyMoment: string
  other: string
}

export function readPreSurvey(): PreSurvey | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return null
    const survey = value as PreSurvey
    if (survey.version !== 1 || !['participant', 'interviewer'].includes(survey.enteredBy)
      || !['yes', 'no'].includes(survey.portfolioUse)
      || !['expressed', 'withheld', 'none'].includes(survey.scene)
      || !Number.isFinite(survey.savedAt) || Date.now() - survey.savedAt > MAX_AGE_MS) return null
    for (const key of ['usual', 'expressedScene', 'reflection', 'withheldScene', 'laterAction', 'withheldReason', 'easyMoment', 'other'] as const) {
      if (typeof survey[key] !== 'string') return null
    }
    return survey
  } catch {
    return null
  }
}

export function savePreSurvey(survey: Omit<PreSurvey, 'version' | 'savedAt'>): void {
  sessionStorage.setItem(KEY, JSON.stringify({ ...survey, version: 1, savedAt: Date.now() }))
}

export function clearPreSurvey(): void {
  try { sessionStorage.removeItem(KEY) } catch { /* 저장소가 막힌 환경에서는 지울 것도 없다. */ }
}

const shown = (value: string) => value.trim() || '응답하지 않음'

export function formatPreSurvey(survey: PreSurvey): string {
  const lines = [
    '첫 설문 · 가족에게 마음을 전하거나 망설였던 경험',
    `입력 방식: ${survey.enteredBy === 'interviewer' ? '진행자가 답을 듣고 입력' : '참여자 직접 입력'}`,
    '내부 기획용 비식별 요약: 동의',
    `포트폴리오 비식별 요약: ${survey.portfolioUse === 'yes' ? '동의' : '동의하지 않음'}`,
    '',
    `1. 평소 가족에게 마음을 어떻게 표현하세요?\n${shown(survey.usual)}`,
    `2. 최근 한 장면: ${survey.scene === 'expressed' ? '실제로 표현한 장면' : survey.scene === 'withheld' ? '전하고 싶었지만 전하지 않은 장면' : '떠오르는 장면 없음'}`,
  ]
  if (survey.scene === 'expressed') {
    lines.push(
      `3-A. 가장 최근에는 언제 표현하셨나요? 그때 어떻게 하셨어요?\n${shown(survey.expressedScene)}`,
      `4-A. 그때 쓰신 방법으로 마음을 어느 정도 담거나 전했다고 느끼세요?\n${shown(survey.reflection)}`,
    )
  }
  if (survey.scene === 'withheld') {
    lines.push(
      `3-B. 전하고 싶었지만 전하지 않은 그때의 상황은 어땠나요?\n${shown(survey.withheldScene)}`,
      `4-B. 그 뒤에는 어떻게 하셨어요?\n${shown(survey.laterAction)}`,
      `5-B. 그때 마음을 전하지 않은 이유가 있다면 말씀해 주실 수 있나요?\n${shown(survey.withheldReason)}`,
    )
  }
  lines.push(
    `6. 최근 가족에게 마음을 표현하기 편했던 순간이 있다면 어떤 때였고, 왜 편했나요?\n${shown(survey.easyMoment)}`,
    `7. 묻지 않았지만 더 기억나는 경험이 있나요?\n${shown(survey.other)}`,
  )
  return lines.join('\n\n')
}
