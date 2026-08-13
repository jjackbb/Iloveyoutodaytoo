import type { Metadata } from 'next'

import {
  loadLegalDocument,
  renderLegalDocNav,
  renderLegalToc,
} from '@/lib/legal'

export const metadata: Metadata = { title: '이용약관 · 오늘도 사랑해' }

/**
 * 문서는 요청마다 바뀌지 않는다. 빌드할 때 한 번 읽어 정적으로 굳힌다.
 * 이게 중요한 이유: 본문을 node:fs로 읽는데, 배포 환경에서는 src/ 폴더가
 * 서버 번들에 함께 실리지 않을 수 있다. 요청 시점에 읽으면 그때 500이 난다.
 */
export const dynamic = 'force-static'

/**
 * 이용약관 전문.
 *
 * 가입 폼의 동의 체크 옆 링크가 여기를 가리킨다. 이 화면이 없던 동안에는
 * 존재하지 않는 문서에 동의를 받고 있었다.
 *
 * 본문은 src/content/legal/terms.md(초안 원본의 복사본)를 서버에서 읽어 그린다.
 * 문구를 코드에 옮겨 적지 않는다 — 옮겨 적는 순간 원본과 어긋난다.
 */
export default async function TermsPage() {
  const doc = await loadLegalDocument('terms')

  return (
    <article className="flex flex-col">
      <h1 className="mt-8 text-3xl leading-snug font-bold text-ink">
        {doc.title}
      </h1>

      {renderLegalToc(doc.toc)}

      {doc.body}

      {renderLegalDocNav('terms')}
    </article>
  )
}
