#!/usr/bin/env node
/**
 * 프로토타입(prototype-mingyu.html)에서 화면 하나를 뽑아 명세로 만든다.
 *
 * 왜 스크립트인가: 6,957줄짜리 파일을 매 화면마다 통째로 읽으면 컨텍스트가 남아나지 않고,
 * 사람이 눈으로 잘라내면 CSS 규칙을 빠뜨린다. 잘라내기는 기계가 하고,
 * 판단(무엇을 살리고 무엇을 버릴지)만 에이전트가 한다.
 *
 * 사용법:
 *   node extract-screen.mjs <screenId> [--out <경로>]
 *   node extract-screen.mjs --list
 *
 * 출력: 화면 마크업 + 그 화면이 쓰는 CSS 규칙 + (body가 비어있으면) JS 렌더 함수
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROTOTYPE = resolve(HERE, '../../../../../PRD/references/prototype-mingyu.html')

/** 어느 화면에나 깔려 있어 화면별 명세에 넣으면 중복만 되는 껍데기 클래스들. */
const CHROME_CLASSES = new Set([
  'device', 'screen', 'notch', 'statusbar', 'sig', 'side-btn', 'stage-cap', 'pages', 'page',
])

/**
 * 버림 판정된 기능의 흔적. 근거는 _workspace/03_capture_flow.md (2026-08-09 캡처 기준).
 *
 * 2026-08-09 사용자 지시로 구판의 버림 판정(댓글·좋아요·폰트토글·용량그래프)이 전부
 * 뒤집혀 **포함**됐다. 지금 빼는 것은 관계유형 UI뿐이다.
 *
 * 여기 걸린 규칙을 자동으로 지우지는 않는다 — 원본이 어떻게 생겼는지는 보여주되,
 * **명세로 옮길 때 빼야 한다는 사실을 잊지 않게** 머리말에 경고로 띄운다.
 */
const DROPPED_FEATURES = [
  [/relationship|어떤 사이/i, '관계유형 질문 — 2026-08-09 지시로 제거 (개방적으로)'],
]

function fail(msg) {
  console.error(`오류: ${msg}`)
  process.exit(1)
}

/** `<style>…</style>` 안쪽만 잘라낸다. */
function styleBlock(html) {
  const open = html.indexOf('<style>')
  const close = html.indexOf('</style>', open)
  if (open === -1 || close === -1) fail('<style> 블록을 찾지 못했다')
  return html.slice(open + '<style>'.length, close)
}

/**
 * CSS를 최상위 규칙 단위로 쪼갠다.
 *
 * 정규식 하나로 처리하지 않는 이유: `@media` 안에 규칙이 중첩돼 있어서
 * 중괄호 깊이를 세지 않으면 블록 경계를 잘못 잡는다.
 */
function splitRules(css) {
  const rules = []
  let depth = 0
  let start = 0
  for (let i = 0; i < css.length; i++) {
    const c = css[i]
    if (c === '{') {
      depth++
    } else if (c === '}') {
      depth--
      if (depth === 0) {
        const text = css.slice(start, i + 1).trim()
        if (text) rules.push(text)
        start = i + 1
      }
    }
  }
  return rules
}

/** 규칙 텍스트에서 셀렉터 부분(첫 `{` 앞)만. */
function selectorOf(rule) {
  return rule.slice(0, rule.indexOf('{'))
}

/** `<section … id="X">` 부터 짝이 맞는 `</section>` 까지. 중첩 section을 센다. */
function extractSection(html, id) {
  const openRe = new RegExp(`<section[^>]*\\bid="${id}"[^>]*>`)
  const m = openRe.exec(html)
  if (!m) fail(`화면 id="${id}" 를 찾지 못했다. --list 로 목록을 확인하라.`)

  let depth = 0
  let i = m.index
  const tagRe = /<\/?section\b/g
  tagRe.lastIndex = m.index
  let t
  while ((t = tagRe.exec(html)) !== null) {
    if (t[0] === '<section') depth++
    else depth--
    if (depth === 0) {
      i = html.indexOf('>', t.index) + 1
      return html.slice(m.index, i)
    }
  }
  fail(`화면 id="${id}" 의 닫는 태그를 찾지 못했다`)
}

/** 마크업에서 쓰인 클래스 이름을 모은다(껍데기 클래스 제외). */
function classesUsed(markup) {
  const found = new Set()
  for (const m of markup.matchAll(/class="([^"]+)"/g)) {
    for (const cls of m[1].trim().split(/\s+/)) {
      if (cls && !CHROME_CLASSES.has(cls)) found.add(cls)
    }
  }
  return found
}

/**
 * 화면이 쓰는 CSS 규칙만 고른다.
 *
 * 규칙: 셀렉터에 나오는 클래스가 **전부** 이 화면에 있어야 포함한다.
 *
 * "하나라도 걸치면 포함"으로 하면 안 되는 이유를 실제로 겪었다. `.ic`(아이콘)는
 * 거의 모든 화면이 쓰는데, 그렇게 뽑으면 `.post-foot .like-btn .ic`(좋아요),
 * `.comment-bar .snd .ic`(댓글), `body.senior-font-mode .btn-primary`(폰트 토글)가
 * 홈 명세에 딸려 들어온다. **전부 버리기로 판정된 기능들이다.**
 * 명세에 있으면 이식가가 만든다 — 그래서 여기서 막는다.
 *
 * `#home` 처럼 이 화면 자신을 가리키는 id는 통과시킨다.
 * 다른 화면의 id가 섞인 셀렉터(`#mailbox .body`)는 그 화면 몫이라 여기서 뺀다 —
 * 단, 셀렉터 목록(`,`로 나뉜 것) 중 하나라도 이 화면 것이면 규칙 자체는 살린다.
 */
function matchingRules(rules, classes, screenId) {
  const picked = []
  for (const rule of rules) {
    const selectorList = selectorOf(rule).split(',')
    const hit = selectorList.some((sel) => {
      const used = [...sel.matchAll(/\.([\w-]+)/g)].map((m) => m[1])
      if (used.length === 0) return false
      if (!used.every((cls) => classes.has(cls))) return false
      // id가 붙어 있으면 이 화면 것이어야 한다.
      const ids = [...sel.matchAll(/#([\w-]+)/g)].map((m) => m[1])
      return ids.every((id) => id === screenId)
    })
    if (hit) picked.push(rule)
  }
  return picked
}

/** `function 이름(` 부터 짝이 맞는 `}` 까지. */
function extractFunction(js, name) {
  const re = new RegExp(`function\\s+${name}\\s*\\(`)
  const m = re.exec(js)
  if (!m) return null
  const bodyStart = js.indexOf('{', m.index)
  if (bodyStart === -1) return null
  let depth = 0
  for (let i = bodyStart; i < js.length; i++) {
    if (js[i] === '{') depth++
    else if (js[i] === '}') {
      depth--
      if (depth === 0) return js.slice(m.index, i + 1)
    }
  }
  return null
}

function main() {
  const args = process.argv.slice(2)
  const html = readFileSync(PROTOTYPE, 'utf8')

  if (args.includes('--list')) {
    for (const m of html.matchAll(/<section[^>]*class="[^"]*\bpage\b[^"]*"[^>]*id="([^"]+)"/g)) {
      console.log(m[1])
    }
    return
  }

  const id = args[0]
  if (!id || id.startsWith('--')) fail('화면 id를 넘겨라. 예: node extract-screen.mjs home')

  const markup = extractSection(html, id)

  // body가 비어 있으면 JS가 채우는 화면이다. 이걸 놓치면 빈 화면을 이식하게 된다.
  const emptyBody = /<div class="body"[^>]*id="([a-zA-Z0-9_]+)"><\/div>/.exec(markup)
  let renderFn = null
  let renderName = null
  if (emptyBody) {
    const js = html.slice(html.indexOf('<script>'))
    renderName = 'render' + id.charAt(0).toUpperCase() + id.slice(1)
    renderFn = extractFunction(js, renderName)
    // renderMail 처럼 이름이 화면 id와 다른 경우가 있다.
    if (!renderFn) {
      for (const m of js.matchAll(/function\s+(render[A-Za-z]+)\s*\(/g)) {
        const candidate = extractFunction(js, m[1])
        if (candidate && candidate.includes(emptyBody[1])) {
          renderName = m[1]
          renderFn = candidate
          break
        }
      }
    }
  }

  /**
   * 클래스는 마크업과 렌더 함수 **양쪽**에서 모은다.
   *
   * 홈의 진짜 내용(`.album-card` `.chip-inv` `.fav`)은 정적 마크업에 없고
   * `renderHome()` 템플릿 문자열 안에만 있다. 마크업만 보면 그 CSS가 통째로 빠져서,
   * 카드가 어떻게 생겼는지 모르는 명세가 나온다.
   */
  const classes = classesUsed(markup + (renderFn ?? ''))
  const rules = matchingRules(splitRules(styleBlock(html)), classes, id)

  const out = []
  out.push(`# 프로토타입 화면 명세 — \`${id}\``)
  out.push('')
  out.push('> `extract-screen.mjs` 가 자동 생성했다. 손으로 고치지 말고 다시 뽑아라.')
  out.push('> **여기 있는 JS는 옮겨 쓰라고 넣은 게 아니다.** 마크업 모양을 알려주려고 넣었다.')
  out.push('')
  out.push(`- 클래스 ${classes.size}개 / 매칭된 CSS 규칙 ${rules.length}개`)
  out.push(`- body를 JS가 채우는가: ${emptyBody ? `**예 (${renderName})**` : '아니오'}`)
  out.push('')

  const source = markup + (renderFn ?? '')
  const dropped = DROPPED_FEATURES.filter(([re]) => re.test(source))
  if (dropped.length > 0) {
    out.push('## ⚠️ 이 화면에 버림 판정 기능이 섞여 있다 — 이식하지 마라')
    out.push('')
    out.push('아래는 원본에 있지만 **명세로 옮길 때 빼기로 판정된** 것들이다 (PRD/05_REDESIGN_PLAN.md §2).')
    out.push('')
    for (const [, label] of dropped) out.push(`- ${label}`)
    out.push('')
  }
  out.push('## 1. 마크업')
  out.push('')
  out.push('```html')
  out.push(markup)
  out.push('```')
  out.push('')

  if (renderFn) {
    out.push(`## 2. 본문을 그리는 JS — \`${renderName}\``)
    out.push('')
    out.push('이 화면은 마크업의 body가 비어 있다. 아래 함수가 만들어내는 **HTML 모양만** 가져오고,')
    out.push('상태 변수(`state.…`)와 DOM 조작은 서버에서 읽은 데이터로 대체한다.')
    out.push('')
    out.push('```js')
    out.push(renderFn)
    out.push('```')
    out.push('')
  }

  out.push(`## ${renderFn ? '3' : '2'}. 이 화면이 쓰는 CSS`)
  out.push('')
  out.push('```css')
  out.push(rules.join('\n\n'))
  out.push('```')
  out.push('')

  const text = out.join('\n')
  const outIdx = args.indexOf('--out')
  if (outIdx !== -1 && args[outIdx + 1]) {
    writeFileSync(args[outIdx + 1], text)
    console.log(`저장: ${args[outIdx + 1]} (${text.length.toLocaleString()}자)`)
  } else {
    console.log(text)
  }
}

main()
