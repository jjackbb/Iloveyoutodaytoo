import type { Metadata } from 'next'
import { FeedbackForm } from './feedback-form'

export const metadata: Metadata = {
  title: '데모 후기 설문 · 오늘도 사랑해',
  robots: { index: false, follow: false },
}

export default function FeedbackPage() {
  return <FeedbackForm />
}
