'use client'

import Link from 'next/link'
import { useState } from 'react'

import { BrandMark } from '@/components/brand/BrandMark'
import { Button } from '@/components/ui/Button'

type AgeExample = 'adult' | 'under14'
type Screen = 'age' | 'guardian' | 'next'

/** 참가자용 데모와 분리된 포트폴리오 화면 시안. 입력·계정·전송은 없다. */
export function SignupPreview() {
  const [ageExample, setAgeExample] = useState<AgeExample | null>(null)
  const [screen, setScreen] = useState<Screen>('age')

  function goNext() {
    if (!ageExample) return
    setScreen(ageExample === 'under14' ? 'guardian' : 'next')
  }

  function reset() {
    setAgeExample(null)
    setScreen('age')
  }

  const currentStep = screen === 'age' ? 1 : screen === 'guardian' ? 2 : 3

  return (
    <main className="min-h-[100dvh] bg-canvas px-5 pb-12 pt-6 text-ink">
      <div className="mx-auto max-w-[560px]">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-base font-bold">
            <BrandMark size={23} />
            <span>오늘도 사랑해</span>
          </div>
          <Link
            href="/demo"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
          >
            데모 체험하기
          </Link>
        </header>

        <div className="mt-8 rounded-inner border border-primary/20 bg-primary-soft px-4 py-3 text-sm leading-relaxed text-ink">
          <strong className="text-primary">포트폴리오 화면 시안</strong>
          <p className="mt-1">실제 가입·보호자 동의는 진행되지 않고, 이 화면의 선택은 저장되지 않아요.</p>
        </div>

        <div className="mt-8">
          <p className="text-sm font-bold text-primary">가입 흐름 미리보기</p>
          <h1 className="mt-2 text-[30px] font-bold leading-tight tracking-[-0.04em] break-keep">
            {screen === 'age'
              ? '나이에 맞는 시작을 보여드릴게요'
              : screen === 'guardian'
                ? '보호자와 함께 확인해요'
                : '다음 화면은 이렇게 이어져요'}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted break-keep">
            {screen === 'age'
              ? '실제 생년월일 대신 예시를 선택해 화면 흐름을 살펴보세요.'
              : screen === 'guardian'
                ? '14세 미만도 보호자 안내를 거쳐 다음 화면으로 이어지는 시안이에요.'
                : '연령에 맞는 안내를 지난 뒤 이름을 정하는 화면으로 이어지는 예시예요.'}
          </p>
        </div>

        <div className="mt-7 flex items-center gap-2" aria-label={`미리보기 ${currentStep}단계`}>
          {[1, 2, 3].map((step) => (
            <span
              key={step}
              className={`h-1.5 flex-1 rounded-full ${step <= currentStep ? 'bg-primary' : 'bg-hairline-strong'}`}
            />
          ))}
        </div>

        {screen === 'age' ? (
          <section className="mt-6 rounded-card border border-hairline bg-card p-5 shadow-card">
            <fieldset>
              <legend className="text-lg font-bold">연령 예시를 선택해 주세요</legend>
              <p className="mt-1 text-sm leading-relaxed text-muted">실제 나이와 생년월일은 묻지 않아요.</p>
              <div className="mt-5 grid gap-3">
                <label className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-inner border-2 px-4 py-3 ${ageExample === 'adult' ? 'border-primary bg-primary-soft' : 'border-hairline-strong'}`}>
                  <input
                    type="radio"
                    name="age-example"
                    value="adult"
                    checked={ageExample === 'adult'}
                    onChange={() => setAgeExample('adult')}
                    className="h-5 w-5 accent-primary"
                  />
                  <span className="font-semibold">14세 이상 예시</span>
                </label>
                <label className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-inner border-2 px-4 py-3 ${ageExample === 'under14' ? 'border-primary bg-primary-soft' : 'border-hairline-strong'}`}>
                  <input
                    type="radio"
                    name="age-example"
                    value="under14"
                    checked={ageExample === 'under14'}
                    onChange={() => setAgeExample('under14')}
                    className="h-5 w-5 accent-primary"
                  />
                  <span className="font-semibold">14세 미만 예시</span>
                </label>
              </div>
            </fieldset>
            <Button fullWidth className="mt-6" disabled={!ageExample} onClick={goNext}>
              다음 화면 보기
            </Button>
          </section>
        ) : null}

        {screen === 'guardian' ? (
          <section className="mt-6 rounded-card border border-hairline bg-card p-5 shadow-card">
            <p className="text-sm font-bold text-primary">14세 미만 예시 · 보호자 안내</p>
            <h2 className="mt-3 text-xl font-bold">보호자와 함께 읽고 결정해요</h2>
            <p className="mt-3 leading-relaxed text-muted break-keep">
              서비스를 어떻게 쓰는지와 어떤 정보를 다루는지 보호자에게 알려드리고,
              보호자가 직접 확인할 수 있는 절차를 마련하는 화면이에요.
            </p>
            <div className="mt-5 rounded-inner bg-surface-soft px-4 py-4 text-sm leading-relaxed break-keep">
              이 미리보기에서는 보호자 이름·연락처를 입력받거나 동의를 확인하지 않아요.
            </div>
            <div className="mt-6 grid gap-3">
              <Button fullWidth onClick={() => setScreen('next')}>
                다음 단계 미리보기
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setScreen('age')}>
                연령 예시 다시 고르기
              </Button>
            </div>
          </section>
        ) : null}

        {screen === 'next' ? (
          <section className="mt-6 rounded-card border border-hairline bg-card p-5 shadow-card">
            <p className="text-sm font-bold text-primary">다음 화면 예시</p>
            <h2 className="mt-3 text-xl font-bold">어떻게 불러드릴까요?</h2>
            <p className="mt-3 leading-relaxed text-muted break-keep">
              {ageExample === 'under14'
                ? '14세 미만 예시도 보호자 안내 다음에 이 화면으로 이어져요.'
                : '14세 이상 예시는 이 화면으로 바로 이어져요.'}
            </p>
            <div className="mt-5 rounded-inner border border-hairline-strong bg-surface-soft px-4 py-4">
              <p className="text-xs font-semibold text-muted">화면에 보일 이름 예시</p>
              <p className="mt-1 text-lg font-semibold">다정</p>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-muted break-keep">
              화면 흐름만 보여드렸어요. 계정은 만들어지지 않았고 선택한 예시도 저장되지 않았어요.
            </p>
            <Button fullWidth className="mt-6" onClick={reset}>
              처음부터 다시 보기
            </Button>
          </section>
        ) : null}
      </div>
    </main>
  )
}
