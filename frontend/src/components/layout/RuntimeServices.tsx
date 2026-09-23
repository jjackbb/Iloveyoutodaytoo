'use client'

import { usePathname } from 'next/navigation'
import { GoogleAnalytics } from '@next/third-parties/google'
import { SignupBeacon } from '@/app/signup-beacon'
import { NativeBridge } from '@/components/native/NativeBridge'
import { GA_ID } from '@/lib/analytics'
import { isDemoPresentationPath } from '@/lib/demo-route'

/** 데모 방문을 가입·위젯·운영 계측으로 처리하지 않는다. */
export function RuntimeServices() {
  const pathname = usePathname()
  if (isDemoPresentationPath(pathname ?? '')) return null

  return (
    <>
      <SignupBeacon />
      <NativeBridge />
      {GA_ID ? <GoogleAnalytics gaId={GA_ID} /> : null}
    </>
  )
}
