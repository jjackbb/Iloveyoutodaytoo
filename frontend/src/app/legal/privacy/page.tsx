import type { Metadata } from 'next'

import {
  loadLegalDocument,
  renderLegalDocNav,
  renderLegalToc,
} from '@/lib/legal'

export const metadata: Metadata = { title: '개인정보 처리방침 · 오늘도 사랑해' }

/**
 * 문서는 요청마다 바뀌지 않는다. 빌드할 때 한 번 읽어 정적으로 굳힌다.
 * (이유는 terms/page.tsx 주석 참고 — 배포 번들에 src/가 없을 수 있다)
 */
export const dynamic = 'force-static'

/**
 * 개인정보 처리방침 전문.
 *
 * 가입 폼의 동의 체크 옆 링크가 여기를 가리킨다.
 *
 * 본문은 src/content/legal/privacy.md(초안 원본의 복사본)를 서버에서 읽어 그린다.
 * 표가 많은 문서라 표는 좌우로 밀 수 있는 상자에 담긴다(lib/legal.ts).
 */
export default async function PrivacyPage() {
  const doc = await loadLegalDocument('privacy')

  return (
    <article className="flex flex-col">
      <h1 className="mt-8 text-3xl leading-snug font-bold text-ink">
        {doc.title}
      </h1>

      {renderLegalToc(doc.toc)}

      {doc.body}

      {renderLegalDocNav('privacy')}
    </article>
  )
}
