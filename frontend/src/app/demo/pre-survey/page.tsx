import type { Metadata } from 'next'
import { PreSurveyForm } from './pre-survey-form'

export const metadata: Metadata = {
  title: '첫 설문 · 오늘도 사랑해',
  robots: { index: false, follow: false },
}

export default function PreSurveyPage() {
  return <PreSurveyForm />
}
