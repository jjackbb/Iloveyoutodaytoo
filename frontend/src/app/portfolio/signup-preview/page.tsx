import type { Metadata } from 'next'

import { SignupPreview } from './signup-preview'

export const metadata: Metadata = {
  title: '가입 화면 시안 · 오늘도 사랑해',
  robots: { index: false, follow: false },
}

export default function SignupPreviewPage() {
  return <SignupPreview />
}
