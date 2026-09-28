'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { formatPreSurvey, readPreSurvey, type PreSurvey } from '@/lib/demo/pre-survey'

const ACTIONS = ['작성', '예시 열람·재생', '좋아요·댓글', '다시 보기', '아무것도 못 함', '기타'] as const
const NONE = '아무것도 못 함'
const WRITTEN_QUESTIONS: { number: number; name: string; title: string; hint?: string }[] = [
  { number: 3, name: 'stopped', title: '하려던 일을 하면서 멈추거나 도움을 받은 곳이 있었다면, 그때 무엇을 하려 했나요?', hint: '없었다면 ‘없음’이라고 적거나 건너뛰셔도 됩니다.' },
  { number: 4, name: 'easy', title: '가장 쉬웠던 부분과 이유는 무엇인가요?' },
  { number: 5, name: 'hard', title: '가장 부담스럽거나 헷갈린 부분과 이유는 무엇인가요?' },
  { number: 6, name: 'comparison', title: '평소 전화·메시지 등과 비교해 이 데모를 쓰고 싶은 상황, 쓰지 않을 상황이 있나요?' },
  { number: 7, name: 'other', title: '화면을 써 본 뒤 생각이 달라진 점이나 빠진 의견이 있나요?' },
] as const

function answer(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim() || '응답하지 않음'
}

function copyText(form: FormData, preSurvey: PreSurvey): string {
  const device = answer(form, 'device')
  const deviceOther = String(form.get('deviceOther') ?? '').trim()
  const actions = form.getAll('actions').map(String)
  const actionOther = String(form.get('actionOther') ?? '').trim()
  const actionText = actions.length
    ? actions.map((item) => item === '기타' && actionOther ? `기타: ${actionOther}` : item).join(', ')
    : '응답하지 않음'

  return [
    '오늘도 사랑해 · 첫 설문 + 데모 후기',
    '',
    formatPreSurvey(preSurvey),
    '',
    '데모 체험 후 설문',
    '',
    `1. 어떤 기기로 체험하셨나요? ${device === '기타' && deviceOther ? `기타: ${deviceOther}` : device}`,
    `2. 데모에서 직접 해 본 것은 무엇인가요? ${actionText}`,
    ...WRITTEN_QUESTIONS.map(({ number, name, title }) => `${number}. ${title}\n${answer(form, name)}`),
    '',
    `내부 기획용 비식별 요약: ${form.get('internalUse') === 'yes' ? '동의' : '동의하지 않음'}`,
    `포트폴리오 비식별 요약: ${form.get('portfolioUse') === 'yes' ? '동의' : '동의하지 않음'}`,
  ].join('\n')
}

export function FeedbackForm() {
  const [preSurvey, setPreSurvey] = useState<PreSurvey | null | undefined>(undefined)
  const [actions, setActions] = useState<string[]>([])
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const [manualText, setManualText] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setPreSurvey(readPreSurvey()), 0)
    return () => window.clearTimeout(timer)
  }, [])

  function toggleAction(item: string) {
    setActions((current) => {
      if (item === NONE) return current.includes(NONE) ? [] : [NONE]
      const other = current.filter((value) => value !== NONE)
      return other.includes(item) ? other.filter((value) => value !== item) : [...other, item]
    })
  }

  async function handleCopy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!preSurvey) return
    const text = copyText(new FormData(event.currentTarget), preSurvey)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
      setManualText('')
    } catch {
      setCopyState('manual')
      setManualText(text)
    }
  }

  return <main className="demo-feedback-page">
    <div className="demo-feedback-container">
      <Link className="demo-feedback-back" href="/demo">← 데모로 돌아가기</Link>
      <header className="demo-feedback-header">
        <p className="demo-feedback-eyebrow">통합 참여 · 마지막 단계</p>
        <h1>데모 후기 설문</h1>
        <p>데모를 둘러본 경험을 알려주세요. 답하기 불편한 질문은 건너뛰셔도 됩니다.</p>
        <p>마지막에 첫 설문과 후기 답변을 함께 복사할 수 있어요. 자동으로 전송되지는 않으니 데모 링크를 받은 대화방에 붙여넣어 보내주세요.</p>
      </header>

      {preSurvey === undefined ? <p className="demo-feedback-result" role="status">첫 설문 답변을 확인하고 있어요…</p> : null}
      {preSurvey === null ? <section className="demo-feedback-result demo-feedback-missing" role="alert">
        <h2>첫 설문 답변을 찾지 못했어요.</h2>
        <p>같은 탭에서 첫 설문을 마친 뒤 데모와 후기를 이어가면 두 답변을 함께 복사할 수 있어요.</p>
        <Link className="demo-feedback-copy demo-pre-continue" href="/demo/pre-survey">첫 설문 작성하기</Link>
      </section> : null}

      {preSurvey ? <form className="demo-feedback-form" onSubmit={(event) => void handleCopy(event)} onChange={() => { setCopyState('idle'); setManualText('') }}>
        <div className="demo-feedback-privacy">
          이름·연락처·소중한 존재의 실명·사적인 글·사진·음성은 적지 말아 주세요. 대화방으로 보내면 그 대화방의 발신자 정보는 수신자에게 보일 수 있습니다.
        </div>

        <fieldset className="demo-feedback-fieldset">
          <legend>1. 어떤 기기로 체험하셨나요?</legend>
          <div className="demo-feedback-options">
            {['휴대전화', '컴퓨터', '기타'].map((item) => <label key={item}><input type="radio" name="device" value={item} />{item}</label>)}
          </div>
          <label className="demo-feedback-detail">기타 기기라면 적어 주세요<input name="deviceOther" type="text" /></label>
        </fieldset>

        <fieldset className="demo-feedback-fieldset">
          <legend>2. 데모에서 직접 해 본 것은 무엇인가요?</legend>
          <p className="demo-feedback-hint">해 본 것을 모두 고르세요. 실제 과업 완료 여부를 확인하는 문항은 아닙니다.</p>
          <div className="demo-feedback-options">
            {ACTIONS.map((item) => <label key={item}><input type="checkbox" name="actions" value={item} checked={actions.includes(item)} onChange={() => toggleAction(item)} />{item}</label>)}
          </div>
          {actions.includes('기타') ? <label className="demo-feedback-detail">기타 행동을 적어 주세요<input name="actionOther" type="text" /></label> : null}
        </fieldset>

        {WRITTEN_QUESTIONS.map(({ number, name, title, hint }) => <label className="demo-feedback-question" key={name}>
          <span>{number}. {title}</span>
          {hint ? <small>{hint}</small> : null}
          <textarea name={name} rows={3} />
        </label>)}

        <fieldset className="demo-feedback-fieldset demo-feedback-consent">
          <legend>답변 활용 범위</legend>
          <p className="demo-feedback-hint">내부 기획용과 포트폴리오 활용을 따로 선택해 주세요. 동의하지 않은 범위에는 답변을 사용하지 않습니다.</p>
          <div className="demo-feedback-consent-group">
            <strong>내부 기획용 비식별 요약</strong>
            <label><input type="radio" name="internalUse" value="yes" required />동의</label>
            <label><input type="radio" name="internalUse" value="no" />동의하지 않음</label>
          </div>
          <label className="demo-feedback-portfolio"><input type="checkbox" name="portfolioUse" value="yes" />포트폴리오에 직접 인용 없이 비식별 요약으로 쓰는 데 동의합니다. (선택)</label>
        </fieldset>

        <button className="demo-feedback-copy" type="submit">첫 설문 + 데모 후기 답변 복사하기</button>
        {copyState === 'copied' ? <div className="demo-feedback-result" role="status">답변을 복사했어요. 아직 전송되지 않았습니다. 데모 링크를 받은 대화방에 붙여넣어 보내주세요.</div> : null}
        {copyState === 'manual' ? <div className="demo-feedback-result" role="alert">
          자동 복사가 안 됐어요. 아래 답변을 선택해 직접 복사한 뒤 대화방에 보내주세요.
          <textarea aria-label="직접 복사할 설문 답변" readOnly rows={8} value={manualText} onFocus={(event) => event.currentTarget.select()} />
        </div> : null}
      </form> : null}
    </div>
  </main>
}
