'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'

import { clearPreSurvey, readPreSurvey, savePreSurvey, type PreSurveyScene } from '@/lib/demo/pre-survey'

const field = (form: FormData, key: string) => String(form.get(key) ?? '').trim()

export function PreSurveyForm() {
  const [stage, setStage] = useState<'loading' | 'form' | 'ready' | 'declined'>('loading')
  const [consent, setConsent] = useState<'yes' | 'no' | ''>('')
  const [scene, setScene] = useState<PreSurveyScene | ''>('')
  const [interviewer, setInterviewer] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setStage(readPreSurvey() ? 'ready' : 'form'), 0)
    return () => window.clearTimeout(timer)
  }, [])

  function startAgain() {
    clearPreSurvey()
    setConsent('')
    setScene('')
    setInterviewer(false)
    setError(null)
    setStage('form')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (consent === 'no') {
      clearPreSurvey()
      setStage('declined')
      return
    }
    if (consent !== 'yes' || !scene || !['yes', 'no'].includes(field(form, 'portfolioUse'))) return
    try {
      savePreSurvey({
        enteredBy: interviewer ? 'interviewer' : 'participant',
        portfolioUse: field(form, 'portfolioUse') as 'yes' | 'no',
        usual: field(form, 'usual'),
        scene,
        expressedScene: scene === 'expressed' ? field(form, 'expressedScene') : '',
        reflection: scene === 'expressed' ? field(form, 'reflection') : '',
        withheldScene: scene === 'withheld' ? field(form, 'withheldScene') : '',
        laterAction: scene === 'withheld' ? field(form, 'laterAction') : '',
        withheldReason: scene === 'withheld' ? field(form, 'withheldReason') : '',
        easyMoment: field(form, 'easyMoment'),
        other: field(form, 'other'),
      })
      setError(null)
      setStage('ready')
      window.scrollTo({ top: 0, behavior: 'instant' })
    } catch {
      setError('이 브라우저에서 답변을 임시 보관하지 못했어요. 저장 공간 설정을 확인한 뒤 다시 눌러주세요.')
    }
  }

  return <main className="demo-feedback-page">
    <div className="demo-feedback-container">
      <Link className="demo-feedback-back" href="/demo">← 데모로 돌아가기</Link>
      <header className="demo-feedback-header">
        <p className="demo-feedback-eyebrow">통합 참여 · 첫 번째 단계</p>
        <h1>가족에게 마음을 전하거나 망설였던 경험</h1>
        <p>서비스 기획을 위해 실제 경험을 듣습니다. 성인만 참여하며, 원하지 않으면 언제든 그만둘 수 있어요. 불편한 질문은 건너뛰셔도 됩니다.</p>
        <p>이름·연락처·가족 실명·사진·음성은 받지 않습니다. 식별될 만한 사연은 자세히 적지 않아도 돼요. 답변 원문과 직접 인용은 포트폴리오에 쓰지 않습니다.</p>
        <p>답변은 서버로 보내지 않고 이 탭에 임시 보관됩니다. 데모와 후기 설문을 마친 뒤 한 번에 복사해, 안내받은 대화방으로 직접 보내주세요. 별도 후속 연락은 하지 않습니다.</p>
      </header>

      {stage === 'loading' ? <p className="demo-feedback-result" role="status">첫 설문을 준비하고 있어요…</p> : null}

      {stage === 'declined' ? <section className="demo-feedback-result" role="status">
        <h2>참여하지 않으셔도 괜찮아요.</h2>
        <p>경험 질문은 받지 않았고, 이 탭에 보관한 첫 설문 답변도 지웠습니다.</p>
        <Link className="demo-feedback-back" href="/demo">데모로 돌아가기</Link>
      </section> : null}

      {stage === 'ready' ? <section className="demo-feedback-result demo-pre-ready" role="status">
        <h2>첫 설문 답변을 이 탭에 임시 보관했어요.</h2>
        <p>이제 데모를 체험해 주세요. 아래 이야기는 질문에 영향을 주지 않도록 답변을 마친 뒤에만 보여드립니다.</p>
        <blockquote>저는 어머니를 가장 좋아하는데도 집에서는 표현을 잘 하지 않아, 어머니께서 제가 어머니를 좋아하지 않는다고 생각하셨다는 걸 알게 됐어요. 그래서 요즘은 함께 사는 어머니께 자기 전마다 ‘사랑합니다’라고 말하고 있어요. 이 경험을 겪으며, 떨어져 사는 가족은 마음을 전하고 싶을 때 어떻게 표현을 시작하는지 궁금해졌고, 그 고민에서 이 아이디어가 시작됐습니다.</blockquote>
        <Link className="demo-feedback-copy demo-pre-continue" href="/demo">데모 체험 시작하기</Link>
        <button className="demo-pre-reset" type="button" onClick={startAgain}>첫 설문 답변 새로 작성하기</button>
      </section> : null}

      {stage === 'form' ? <form className="demo-feedback-form" onSubmit={submit}>
        <label className="demo-feedback-fieldset demo-pre-interviewer"><input type="checkbox" checked={interviewer} onChange={(event) => setInterviewer(event.target.checked)} />진행자가 참여자의 답을 듣고 대신 입력합니다.</label>

        <fieldset className="demo-feedback-fieldset">
          <legend>참여와 내부 기획용 비식별 요약에 동의하시나요?</legend>
          <p className="demo-feedback-hint">동의하지 않으면 경험 질문 없이 끝납니다.</p>
          <div className="demo-feedback-options">
            <label><input type="radio" name="internalUse" value="yes" checked={consent === 'yes'} onChange={() => setConsent('yes')} required />동의합니다</label>
            <label><input type="radio" name="internalUse" value="no" checked={consent === 'no'} onChange={() => setConsent('no')} />동의하지 않습니다</label>
          </div>
        </fieldset>

        {consent === 'yes' ? <>
          <fieldset className="demo-feedback-fieldset">
            <legend>비식별 요약을 포트폴리오에도 활용해도 될까요?</legend>
            <p className="demo-feedback-hint">동의하지 않아도 첫 설문과 데모 체험에 참여할 수 있어요. 답변 원문·직접 인용은 어느 경우에도 사용하지 않습니다.</p>
            <div className="demo-feedback-options">
              <label><input type="radio" name="portfolioUse" value="yes" required />동의합니다</label>
              <label><input type="radio" name="portfolioUse" value="no" />동의하지 않습니다</label>
            </div>
          </fieldset>

          <label className="demo-feedback-question"><span>1. 평소 가족에게 마음을 어떻게 표현하세요?</span><small>특별히 표현하지 않는다면 그렇게 적거나 건너뛰셔도 됩니다.</small><textarea name="usual" rows={3} /></label>

          <fieldset className="demo-feedback-fieldset">
            <legend>2. 가장 최근에 떠오르는 장면 하나를 골라 주세요.</legend>
            <p className="demo-feedback-hint">둘 다 있었다면 이번에 이야기할 가장 최근 한 장면을 골라 주세요.</p>
            <div className="demo-feedback-options">
              <label><input type="radio" name="scene" value="expressed" checked={scene === 'expressed'} onChange={() => setScene('expressed')} required />실제로 표현한 장면</label>
              <label><input type="radio" name="scene" value="withheld" checked={scene === 'withheld'} onChange={() => setScene('withheld')} />전하고 싶었지만 전하지 않은 장면</label>
              <label><input type="radio" name="scene" value="none" checked={scene === 'none'} onChange={() => setScene('none')} />떠오르는 장면 없음</label>
            </div>
          </fieldset>

          {scene === 'expressed' ? <>
            <label className="demo-feedback-question"><span>3-A. 가장 최근에는 언제 표현하셨나요? 그때 어떻게 하셨어요?</span><small>당시 상황·전하려던 마음·실제로 사용한 방법을 편하게 적어 주세요.</small><textarea name="expressedScene" rows={3} /></label>
            <label className="demo-feedback-question"><span>4-A. 그때 쓰신 방법으로 마음을 어느 정도 담거나 전했다고 느끼세요?</span><small>메시지를 보냈다면 보낸 내용에 마음이 담겼는지, 다른 방법이었다면 그 방법으로 전해졌는지를 돌아봐 주세요.</small><textarea name="reflection" rows={3} /></label>
          </> : null}

          {scene === 'withheld' ? <>
            <label className="demo-feedback-question"><span>3-B. 전하고 싶었지만 전하지 않은 그때의 상황은 어땠나요?</span><small>실제로 말하려다 멈췄다면 그때 무슨 일이 있었는지도 적어 주세요.</small><textarea name="withheldScene" rows={3} /></label>
            <label className="demo-feedback-question"><span>4-B. 그 뒤에는 어떻게 하셨어요?</span><small>아무 행동도 하지 않았다면 그렇게 적어도 됩니다.</small><textarea name="laterAction" rows={3} /></label>
            <label className="demo-feedback-question"><span>5-B. 그때 마음을 전하지 않은 이유가 있다면 말씀해 주실 수 있나요?</span><small>이유가 없거나 기억나지 않으면 건너뛰셔도 됩니다.</small><textarea name="withheldReason" rows={3} /></label>
          </> : null}

          <label className="demo-feedback-question"><span>6. 최근 가족에게 마음을 표현하기 편했던 순간이 있다면 어떤 때였고, 왜 편했나요?</span><small>그런 순간이 없다면 ‘없음’이라고 적거나 건너뛰셔도 됩니다.</small><textarea name="easyMoment" rows={3} /></label>
          <label className="demo-feedback-question"><span>7. 오늘 묻지 않았지만 가족에게 마음을 전할 때 더 기억나는 경험이 있나요?</span><small>선택 문항입니다.</small><textarea name="other" rows={3} /></label>
        </> : null}

        {error ? <p className="demo-feedback-result" role="alert">{error}</p> : null}
        <button className="demo-feedback-copy" type="submit">{consent === 'no' ? '참여하지 않고 끝내기' : '첫 설문 마치고 데모로 이어가기'}</button>
      </form> : null}
    </div>
  </main>
}
