import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { DemoProvider } from './demo-context'
import './demo.css'

export const metadata: Metadata = {
  title: '오늘도 사랑해 · 체험',
  robots: { index: false, follow: false },
}

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <DemoProvider>{children}</DemoProvider>
}
