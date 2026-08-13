/**
 * 법적 고지 문서(이용약관·개인정보 처리방침)를 읽어 화면에 그리는 도구.
 *
 * 왜 직접 만들었나:
 * 새 npm 패키지를 설치할 수 없다. 그래서 초안이 실제로 쓰는 문법만 지원하는
 * 작은 마크다운 파서를 여기 뒀다. 지원 범위는 아래 parseBlocks 주석에 적어뒀다.
 *
 * 왜 dangerouslySetInnerHTML을 안 쓰나:
 * HTML 문자열을 만들면 이스케이프를 한 군데라도 빠뜨리는 순간 XSS가 열린다.
 * 여기서는 마크다운을 블록 트리로 파싱한 뒤 React 엘리먼트로 만든다.
 * React가 텍스트를 알아서 이스케이프하므로 실수할 여지가 없다.
 *
 * 문서 내용은 절대 손대지 않는다.
 * src/content/legal/*.md 는 PRD/legal/ 초안의 바이트 단위 복사본이다.
 * `[ ]` 빈칸도 그대로 보여준다 — 채워지지 않았다는 사실 자체를 사용자에게 알려야 한다.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import Link from 'next/link'
import { createElement, type ReactNode } from 'react'

/* ============================================================
   문서 목록
   ============================================================ */

export type LegalSlug = 'terms' | 'privacy'

/** 화면 상단 문서 전환 링크에서 쓴다. */
export const LEGAL_DOCS: Record<
  LegalSlug,
  { readonly label: string; readonly href: string }
> = {
  terms: { label: '이용약관', href: '/legal/terms' },
  privacy: { label: '개인정보 처리방침', href: '/legal/privacy' },
}

/**
 * 마크다운 원본이 들어 있는 폴더.
 * 파일명과 따로 두는 이유는 아래 LEGAL_FILE_NAMES 설명을 보라.
 * 이 값은 반드시 글자 그대로(정적으로) 적어 둔다.
 */
const LEGAL_DIR = 'src/content/legal'

/**
 * 슬러그별 파일 이름.
 *
 * 폴더와 파일명을 왜 나눠 뒀나:
 * 예전에는 'src/content/legal/terms.md' 전체 경로를 여기 담고
 * path.join(process.cwd(), LEGAL_FILES[slug]) 로 읽었다. 이러면 빌드 도구가
 * "어느 파일을 읽는지" 정적으로 알 수 없어 프로젝트 전체를 배포 산출물에 끌어넣었다
 * (빌드 경고: "Dynamic filesystem access causes tracing of the whole project").
 * public 폴더와 모든 소스가 서버 번들에 실려 배포가 느려지거나 용량 제한에 걸린다.
 * 폴더를 글자 그대로 고정하면 추적 범위가 이 폴더 안으로 좁혀진다.
 */
const LEGAL_FILE_NAMES: Record<LegalSlug, string> = {
  terms: 'terms.md',
  privacy: 'privacy.md',
}

/**
 * 문서 맨 끝의 "개발자를 위한 체크리스트"는 약관·방침 본문이 아니다.
 * 초안을 쓴 사람이 개발자에게 남긴 내부 메모다. 두 문서 모두
 * "⚠️ 현재 PRD에는 신고 기능이 없습니다" 같은 문장이 그대로 들어 있어서,
 * 그대로 내보내면 같은 화면 안에서 약관 제9조 3항(신고 가능)과 서로 어긋난다.
 *
 * 원본 md 파일은 손대지 않는다(PRD 초안과 바이트 단위로 같아야 한다).
 * 화면에 그릴 때만 이 절부터 잘라낸다.
 * 다시 보여주려면 이 상수를 null로 바꾸면 된다 — 그것 말고 고칠 곳은 없다.
 */
const INTERNAL_SECTION_HEADING: string | null = '개발자를 위한 체크리스트'

/* ============================================================
   블록 파서
   ============================================================ */

type Block =
  | { kind: 'heading'; level: number; text: string; id?: string }
  /** 원본의 줄바꿈을 그대로 살린다. 초안 고지처럼 한 줄 한 줄이 따로 읽혀야 하는 곳이 있다. */
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'rule' }
  | { kind: 'quote'; blocks: Block[] }
  | { kind: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { kind: 'table'; header: string[]; rows: string[][] }

const HEADING_RE = /^(#{1,6})\s+(.*)$/
const RULE_RE = /^(-{3,}|\*{3,}|_{3,})$/
const QUOTE_RE = /^>\s?(.*)$/
const BULLET_RE = /^([-*+])\s+(.*)$/
const ORDERED_RE = /^(\d{1,9})[.)]\s+(.*)$/
const TABLE_DIVIDER_RE = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/

/** 줄 앞 공백 개수. 목록 안에 딸린 줄인지 판단할 때 쓴다. */
function indentOf(line: string): number {
  return line.length - line.trimStart().length
}

/** 줄 묶음에서 공통 들여쓰기를 걷어낸다. 목록 항목 속 표·하위 목록을 다시 파싱하기 위함. */
function dedent(lines: string[]): string[] {
  const indents = lines.filter((l) => l.trim() !== '').map(indentOf)
  if (indents.length === 0) return lines.map(() => '')
  const min = Math.min(...indents)
  return lines.map((l) => (l.trim() === '' ? '' : l.slice(min)))
}

/** `| 가 | 나 |` 한 줄을 칸 배열로 자른다. */
function splitTableRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((cell) => cell.trim())
}

function isTableStart(lines: string[], i: number): boolean {
  const current = lines[i].trim()
  const next = i + 1 < lines.length ? lines[i + 1].trim() : ''
  return (
    current.startsWith('|') &&
    current.includes('|', 1) &&
    next !== '' &&
    TABLE_DIVIDER_RE.test(next)
  )
}

/** 이 줄에서 새 블록이 시작되는가. 문단을 어디서 끊을지 판단한다. */
function startsNewBlock(lines: string[], i: number): boolean {
  const trimmed = lines[i].trim()
  if (trimmed === '') return true
  return (
    RULE_RE.test(trimmed) ||
    HEADING_RE.test(trimmed) ||
    QUOTE_RE.test(trimmed) ||
    BULLET_RE.test(trimmed) ||
    ORDERED_RE.test(trimmed) ||
    isTableStart(lines, i)
  )
}

/**
 * 지원 문법: 제목(# ## ###), 문단, 수평선(---), 인용(>),
 * 목록(-, 1.) 및 목록 안에 딸린 하위 목록·표, 표(|...|).
 * 인라인은 renderInline이 맡는다(굵게, 인라인 코드, 링크).
 *
 * 초안이 쓰지 않는 문법(코드 블록, 이미지, 기울임 등)은 일부러 다루지 않는다.
 * 지원하지 않는 표기는 글자 그대로 나온다 — 조용히 사라지는 것보다 낫다.
 */
function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '') {
      i += 1
      continue
    }

    // --- 수평선 ---
    if (RULE_RE.test(trimmed)) {
      blocks.push({ kind: 'rule' })
      i += 1
      continue
    }

    // --- 제목 ---
    const heading = HEADING_RE.exec(trimmed)
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1].length,
        text: heading[2].trim(),
      })
      i += 1
      continue
    }

    // --- 인용 ---
    if (QUOTE_RE.test(trimmed)) {
      const inner: string[] = []
      while (i < lines.length) {
        const quoted = QUOTE_RE.exec(lines[i].trim())
        if (!quoted) break
        inner.push(quoted[1])
        i += 1
      }
      blocks.push({ kind: 'quote', blocks: parseBlocks(inner) })
      continue
    }

    // --- 표 ---
    if (isTableStart(lines, i)) {
      const header = splitTableRow(trimmed)
      i += 2 // 머리글 줄과 구분선 줄을 건너뛴다
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitTableRow(lines[i]))
        i += 1
      }
      blocks.push({ kind: 'table', header, rows })
      continue
    }

    // --- 목록 ---
    const bullet = BULLET_RE.exec(trimmed)
    const ordered = ORDERED_RE.exec(trimmed)
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered)
      const baseIndent = indentOf(line)
      const start = ordered ? Number(ordered[1]) : 1
      const rawItems: string[][] = []
      let current: string[] | null = null

      while (i < lines.length) {
        const cur = lines[i]
        const curTrimmed = cur.trim()

        // 빈 줄: 뒤에 더 깊이 들여쓴 줄이 오면 같은 항목이 이어지는 것이다.
        if (curTrimmed === '') {
          let j = i + 1
          while (j < lines.length && lines[j].trim() === '') j += 1
          if (current && j < lines.length && indentOf(lines[j]) > baseIndent) {
            current.push('')
            i += 1
            continue
          }
          break
        }

        const indent = indentOf(cur)

        if (indent === baseIndent) {
          if (RULE_RE.test(curTrimmed)) break
          const nextBullet = BULLET_RE.exec(curTrimmed)
          const nextOrdered = ORDERED_RE.exec(curTrimmed)
          const marker = isOrdered ? nextOrdered : nextBullet
          if (!marker) break
          current = [marker[2]]
          rawItems.push(current)
          i += 1
          continue
        }

        if (indent > baseIndent && current) {
          current.push(cur)
          i += 1
          continue
        }

        break
      }

      blocks.push({
        kind: 'list',
        ordered: isOrdered,
        start,
        items: rawItems.map(([first, ...rest]) =>
          parseBlocks([first, ...dedent(rest)]),
        ),
      })
      continue
    }

    // --- 문단 ---
    const paragraph = [trimmed]
    i += 1
    while (i < lines.length && !startsNewBlock(lines, i)) {
      paragraph.push(lines[i].trim())
      i += 1
    }
    blocks.push({ kind: 'paragraph', lines: paragraph })
  }

  return blocks
}

/* ============================================================
   화면 표시
   ============================================================ */

/**
 * 본문은 시니어 사용자 기준으로 text-base(17px) 이상, 줄간격은 넉넉하게.
 * (04_PROJECT_SPEC.md "시니어 사용자가 쓸 화면에 작은 폰트를 쓰지 마")
 */
const BODY_TEXT = 'text-base leading-relaxed text-ink'

/**
 * 인라인 코드는 이 문서에서 전부 `[ 사업자명 ]` 같은 빈칸 자리표시자다.
 * 아직 채워지지 않았다는 걸 한눈에 알 수 있게 배경 + 테두리로 감싼다.
 *
 * 글자색을 분홍(text-primary)이 아니라 먹색(text-ink)으로 둔 이유:
 * 처음 판단은 bg-primary-soft 가 #fdebf3 이던 때 나왔다 — 그 위의 #d50e68 은
 * 4.49:1 로 본문 크기(17px) 기준 WCAG AA(4.5:1) 미달이었다. 토큰이 #fef0f6 으로
 * 밝아진 지금은 4.65:1 이지만 기준선 바로 위라 여유가 없어 먹색을 유지한다.
 * 테두리와 대괄호가 있으니 색을 빼도 "아직 안 채워진 칸"이라는 정보는 그대로 전달된다.
 */
const CODE_CLASS =
  'mx-0.5 rounded-[6px] border border-primary bg-primary-soft px-1.5 py-0.5 font-medium text-ink'

const LINK_CLASS = 'text-primary underline underline-offset-2'

/** 굵게 / 인라인 코드 / 링크. 왼쪽부터 먼저 나오는 것을 먼저 처리한다. */
const INLINE_RE = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)/

/** javascript: 같은 스킴이 링크로 들어오지 못하게 막는다. */
function safeHref(href: string): string | null {
  // `//evil.com` 같은 프로토콜 상대 주소는 `/`로 시작하지만 실제로는 바깥 사이트다.
  // 법적 고지 문서에서 바깥으로 나가는 링크는 https:// 로 또렷하게 적어야 한다.
  if (href.startsWith('//')) return null
  return /^(https?:\/\/|mailto:|\/|#)/i.test(href) ? href : null
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let rest = text
  let n = 0

  while (rest.length > 0) {
    const match = INLINE_RE.exec(rest)
    if (!match) {
      nodes.push(rest)
      break
    }

    if (match.index > 0) nodes.push(rest.slice(0, match.index))
    const key = `${keyPrefix}-t${n}`
    n += 1

    if (match[1] !== undefined) {
      nodes.push(
        createElement('code', { key, className: CODE_CLASS }, match[1]),
      )
    } else if (match[2] !== undefined) {
      nodes.push(
        createElement(
          'strong',
          { key, className: 'font-bold' },
          renderInline(match[2], key),
        ),
      )
    } else {
      const href = safeHref(match[4])
      nodes.push(
        href
          ? createElement(
              'a',
              { key, href, className: LINK_CLASS, rel: 'noreferrer' },
              renderInline(match[3], key),
            )
          : match[0],
      )
    }

    rest = rest.slice(match.index + match[0].length)
  }

  return nodes
}

/** 여러 줄짜리 문단. 원본의 줄바꿈 자리에 <br>를 넣어 읽는 호흡을 그대로 유지한다. */
function renderSoftLines(lines: string[], keyPrefix: string): ReactNode[] {
  return lines.flatMap((line, index) =>
    index === 0
      ? renderInline(line, `${keyPrefix}-l${index}`)
      : [
          createElement('br', { key: `${keyPrefix}-br${index}` }),
          ...renderInline(line, `${keyPrefix}-l${index}`),
        ],
  )
}

function renderTable(block: Extract<Block, { kind: 'table' }>, key: string) {
  const cellBase = 'min-w-[7rem] border-b border-hairline px-4 py-3 align-top'

  const head = createElement(
    'thead',
    null,
    createElement(
      'tr',
      null,
      block.header.map((cell, c) =>
        createElement(
          'th',
          {
            key: `${key}-h${c}`,
            scope: 'col',
            className: `${cellBase} bg-surface-soft text-left text-base font-bold text-ink`,
          },
          renderInline(cell, `${key}-h${c}`),
        ),
      ),
    ),
  )

  const body = createElement(
    'tbody',
    null,
    block.rows.map((row, r) =>
      createElement(
        'tr',
        { key: `${key}-r${r}` },
        row.map((cell, c) =>
          createElement(
            'td',
            { key: `${key}-r${r}c${c}`, className: `${cellBase} ${BODY_TEXT}` },
            renderInline(cell, `${key}-r${r}c${c}`),
          ),
        ),
      ),
    ),
  )

  // 칸이 많은 표는 좁은 화면에서 가로로 넘친다.
  // 감싼 상자만 좌우로 밀리게 하고(본문은 안 밀린다), 키보드로도 밀 수 있게 tabIndex를 준다.
  return createElement(
    'div',
    {
      key,
      role: 'region',
      tabIndex: 0,
      // 넘치지 않는 표에도 같은 안내가 붙으므로 "화면이 좁으면"이라고 조건을 밝힌다.
      'aria-label': '표 — 화면이 좁으면 좌우로 밀어서 볼 수 있어요',
      className: 'mt-5 overflow-x-auto rounded-[14px] border border-hairline',
    },
    createElement('table', { className: 'w-full border-collapse' }, head, body),
  )
}

function renderBlock(block: Block, key: string): ReactNode {
  switch (block.kind) {
    case 'heading': {
      // 화면낭독기가 목차를 올바로 읽도록 문서의 단계를 그대로 지킨다.
      const tag = `h${Math.min(block.level, 6)}`
      const size =
        block.level <= 2
          ? 'mt-10 text-2xl font-bold'
          : block.level === 3
            ? 'mt-7 text-xl font-bold'
            : 'mt-6 text-lg font-bold'
      return createElement(
        tag,
        {
          key,
          id: block.id,
          className: `${size} scroll-mt-6 text-ink`,
        },
        renderInline(block.text, key),
      )
    }

    case 'paragraph':
      return createElement(
        'p',
        { key, className: `mt-4 ${BODY_TEXT}` },
        renderSoftLines(block.lines, key),
      )

    case 'rule':
      return createElement('hr', {
        key,
        className: 'mt-8 border-0 border-t border-hairline',
      })

    case 'quote':
      return createElement(
        'blockquote',
        {
          key,
          className:
            'mt-5 rounded-[14px] border-l-4 border-primary bg-surface-soft px-5 py-4',
        },
        renderBlocks(block.blocks, key),
      )

    case 'list': {
      const items = block.items.map((itemBlocks, index) => {
        const itemKey = `${key}-li${index}`
        // 한 문단짜리 항목은 <p> 없이 그대로 넣는다. 불필요한 여백이 생기지 않게.
        const content =
          itemBlocks.length === 1 && itemBlocks[0].kind === 'paragraph'
            ? renderSoftLines(itemBlocks[0].lines, itemKey)
            : renderBlocks(itemBlocks, itemKey)
        return createElement('li', { key: itemKey, className: 'pl-1' }, content)
      })

      return createElement(
        block.ordered ? 'ol' : 'ul',
        {
          key,
          start: block.ordered && block.start !== 1 ? block.start : undefined,
          className: [
            'mt-4 space-y-2 pl-6',
            block.ordered ? 'list-decimal' : 'list-disc',
            BODY_TEXT,
          ].join(' '),
        },
        items,
      )
    }

    case 'table':
      return renderTable(block, key)
  }
}

function renderBlocks(blocks: Block[], keyPrefix: string): ReactNode[] {
  return blocks.map((block, index) =>
    renderBlock(block, `${keyPrefix}-${index}`),
  )
}

/* ============================================================
   문서 읽기
   ============================================================ */

export interface LegalTocEntry {
  id: string
  text: string
}

export interface LegalDocument {
  /** 문서 맨 위 제목(마크다운의 h1). 화면에서는 페이지의 h1이 된다. */
  title: string
  /** 조항 목록. 긴 문서라 상단에 차례를 놓는다. */
  toc: LegalTocEntry[]
  /** 본문(제목 제외)을 그린 결과. */
  body: ReactNode
}

/**
 * 마크다운 원본을 읽어 화면에 그릴 수 있는 형태로 돌려준다.
 * 서버 컴포넌트에서만 부른다(node:fs를 쓴다).
 */
export async function loadLegalDocument(
  slug: LegalSlug,
): Promise<LegalDocument> {
  const filePath = path.join(process.cwd(), LEGAL_DIR, LEGAL_FILE_NAMES[slug])
  const markdown = await readFile(filePath, 'utf8')

  const blocks = parseBlocks(markdown.split(/\r?\n/))

  // 맨 앞 h1은 페이지 제목으로 올려 쓴다. 같은 제목이 두 번 나오지 않게.
  let title = LEGAL_DOCS[slug].label
  if (blocks[0]?.kind === 'heading' && blocks[0].level === 1) {
    title = blocks[0].text
    blocks.shift()
  }

  // 내부 메모 절부터 잘라낸다(INTERNAL_SECTION_HEADING 설명 참고).
  // 바로 앞에 남는 구분선(---)도 함께 걷어내야 문서가 선으로 끝나지 않는다.
  if (INTERNAL_SECTION_HEADING !== null) {
    const cutAt = blocks.findIndex(
      (block) =>
        block.kind === 'heading' &&
        block.text.trim() === INTERNAL_SECTION_HEADING,
    )
    if (cutAt !== -1) {
      let end = cutAt
      while (end > 0 && blocks[end - 1].kind === 'rule') end -= 1
      blocks.length = end
    }
  }

  // 조항(h2)에 앵커 id를 붙인다. 한글 제목을 그대로 id로 쓰면 주소가 지저분해지므로 번호로 만든다.
  const toc: LegalTocEntry[] = []
  for (const block of blocks) {
    if (block.kind === 'heading' && block.level === 2) {
      const id = `section-${toc.length + 1}`
      block.id = id
      toc.push({ id, text: block.text })
    }
  }

  return { title, toc, body: renderBlocks(blocks, 'body') }
}

/**
 * 문서 아래쪽의 "다른 문서 보기".
 *
 * 지금 보고 있는 문서는 빼고 보여준다.
 * (예전에는 layout에 있었는데, layout은 어느 문서인지 몰라서 이용약관을 보는
 *  중에도 "이용약관 보기"가 같이 떴다. 눌러도 아무 일이 없어 고장으로 보인다)
 */
export function renderLegalDocNav(current: LegalSlug): ReactNode {
  const others = (Object.keys(LEGAL_DOCS) as LegalSlug[]).filter(
    (slug) => slug !== current,
  )
  if (others.length === 0) return null

  return createElement(
    'nav',
    {
      'aria-label': '다른 문서 보기',
      className: 'mt-12 flex flex-col gap-2 border-t border-hairline pt-6',
    },
    others.map((slug) =>
      createElement(
        Link,
        {
          key: slug,
          href: LEGAL_DOCS[slug].href,
          className:
            'flex min-h-[52px] items-center rounded-[8px] px-2 text-base text-primary underline underline-offset-2 active:bg-primary-soft',
        },
        `${LEGAL_DOCS[slug].label} 보기`,
      ),
    ),
  )
}

/**
 * 문서 차례. 두 화면이 똑같이 쓰므로 여기서 만든다.
 * (이 파일은 .ts라 JSX를 쓸 수 없어 createElement로 짰다)
 */
export function renderLegalToc(toc: LegalTocEntry[]): ReactNode {
  if (toc.length === 0) return null

  return createElement(
    'nav',
    {
      'aria-labelledby': 'legal-toc-heading',
      className:
        'mt-8 rounded-[14px] border border-hairline bg-surface-soft p-5',
    },
    createElement(
      'h2',
      { id: 'legal-toc-heading', className: 'text-xl font-bold text-ink' },
      '문서 차례',
    ),
    createElement(
      'ol',
      { className: 'mt-3 grid gap-1 sm:grid-cols-2' },
      toc.map((entry) =>
        createElement(
          'li',
          { key: entry.id },
          createElement(
            'a',
            {
              href: `#${entry.id}`,
              className:
                'flex min-h-[44px] items-center rounded-[8px] px-2 text-base leading-relaxed text-primary underline underline-offset-2 active:bg-primary-soft',
            },
            entry.text,
          ),
        ),
      ),
    ),
  )
}
