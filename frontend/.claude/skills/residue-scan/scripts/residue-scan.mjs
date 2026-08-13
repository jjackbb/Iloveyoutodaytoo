#!/usr/bin/env node
/**
 * 이식한 코드에 프로토타입의 나쁜 습관이 딸려 왔는지 검사한다.
 *
 * 프로토타입이 폐기된 이유는 디자인이 아니라 **잔여데이터**였다. 19개 화면이 한 DOM에 다 살아 있고
 * JS가 보이기/숨기기만 해서, 화면을 나가도 입력값과 목록이 남아 다음에 튀어나왔다.
 * 그 구조가 다시 들어오는 걸 기계가 막는다 — 사람 눈은 이런 걸 놓친다.
 *
 * 사용법:
 *   node residue-scan.mjs [경로...]        # 기본값 src/
 *   node residue-scan.mjs --json           # 기계가 읽을 형태로
 *
 * 종료 코드: BLOCK이 하나라도 있으면 1, 아니면 0.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, relative, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

/** globals.css에 토큰으로 등록된 색. 이 밖의 hex가 화면 코드에 박히면 토큰을 우회한 것이다. */
const ALLOWED_HEX = new Set([
  '#fbf7f8', '#ffffff', '#fff6f8', '#d50e68', '#b00b56', '#df1670', '#fef0f6',
  '#222222', '#6a6a6a', '#f0eaec', '#ebe2e5', '#fb2e39', '#ed1074', '#9a11c5',
  '#fff', '#000',
])

const RULES = [
  {
    id: 'dom-state-machine',
    level: 'BLOCK',
    why: '프로토타입의 화면 전환 방식이다. 화면이 DOM에 남아 있어 이전 데이터가 다음에 튀어나온다. 라우팅은 Next.js가 한다.',
    re: /\b(document\.getElementById|document\.querySelector|\.innerHTML\s*=|classList\.(add|remove|toggle)\(\s*['"]active['"])/,
  },
  {
    id: 'inline-handler',
    level: 'BLOCK',
    why: 'HTML 속성에 직접 붙인 핸들러다. 프로토타입 마크업을 그대로 붙여넣었다는 신호 — React는 이 방식을 쓰지 않는다.',
    re: /\bon(click|input|change|submit)\s*=\s*"/,
  },
  {
    id: 'module-level-mutable',
    level: 'BLOCK',
    why: '모듈 최상단의 바뀌는 변수는 서버에서 요청 사이에 값이 남는다. 한 사용자의 데이터가 다른 사용자에게 보일 수 있다.',
    // 진짜 0번 칸에서 시작하는 것만 모듈 스코프다. 들여쓴 `let`은 함수 안이라 안전하다 —
    // 이걸 구분하지 않으면 정상 코드가 전부 걸려서 검사기를 아무도 안 믿게 된다.
    re: /^(let|var)\s+\w+\s*=/,
  },
  {
    id: 'mock-data',
    level: 'BLOCK',
    why: 'PRD "절대 하지 마" — 목업/하드코딩 데이터로 완성이라고 하지 않는다. 화면 데이터는 서버가 DB에서 읽는다.',
    re: /\b(dummy|mockData|sampleData|fakeData|더미|샘플데이터|테스트데이터)\b/i,
  },
  {
    id: 'seeded-list-state',
    level: 'WARN',
    why: '목록을 클라이언트 상태의 초기값으로 넣으면 서버가 준 최신 데이터와 어긋난다. 목록은 서버에서 내려받아 props로 받는다.',
    re: /useState\s*(<[^>]*>)?\s*\(\s*\[\s*\{/,
  },
  {
    // 2026-08-09 사용자 지시로 구판 제외 목록(좋아요·댓글·용량그래프·폰트토글)이 전부
    // 포함으로 뒤집혔다. 지금 빼는 것은 관계유형 UI뿐 — 기준: _workspace/03_capture_flow.md
    id: 'prd-excluded-feature',
    level: 'BLOCK',
    why: '관계유형("어떤 사이인가요?") UI는 2026-08-09 지시로 제거됐다. 새 코드에 다시 들어오면 안 된다.',
    re: /어떤 사이인가요|relationshipTypePicker/i,
  },
  {
    id: 'server-client-mix',
    level: 'BLOCK',
    why: "'use client' 파일이 서버 전용 모듈을 부르면 빌드가 깨지거나 비밀키가 브라우저로 샌다.",
    custom: (text) =>
      /^\s*['"]use client['"]/m.test(text) &&
      /@\/lib\/supabase\/server|next\/headers|node:crypto/.test(text),
    message: "'use client' 파일에서 서버 전용 모듈(supabase/server, next/headers 등)을 import 했다",
  },
  {
    id: 'service-role-key',
    level: 'BLOCK',
    why: 'PRD 결정 — 이 키는 비워 두고 관리자 작업은 SECURITY DEFINER 함수로 한다.',
    re: /SUPABASE_SERVICE_ROLE_KEY/,
  },
  {
    id: 'physical-delete',
    level: 'WARN',
    why: 'PRD "절대 하지 마" — 방 나가기/차단은 상태값만 바꾼다. 사서함 기록이 사라지면 안 된다. (탈퇴 처리는 예외이니 확인만 하라.)',
    re: /\.delete\(\s*\)/,
  },
  {
    id: 'hardcoded-color',
    level: 'WARN',
    why: '색은 globals.css 토큰으로만 쓴다. 직접 박은 색은 WCAG AA 검증을 거치지 않았다.',
    custom: (text, file) => {
      if (file.endsWith('globals.css')) return false
      // 주석에 적힌 색은 쓰인 게 아니라 설명된 것이다. 판단의 근거를 남긴 주석을
      // 위반으로 잡으면, 근거를 적을수록 경고가 늘어나는 이상한 일이 벌어진다.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      const hits = [...code.matchAll(/#[0-9a-fA-F]{3,8}\b/g)]
        .map((m) => m[0].toLowerCase())
        .filter((h) => !ALLOWED_HEX.has(h))
      return hits.length > 0 ? `토큰에 없는 색: ${[...new Set(hits)].join(', ')}` : false
    },
  },
]

/** 검사에서 뺄 경로 — 빌드 산출물과 의존성은 우리가 쓴 코드가 아니다. */
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '_workspace', '.claude'])
const SCAN_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.css'])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = resolve(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (SCAN_EXT.has(extname(entry))) out.push(full)
  }
  return out
}

/** 주석과 문자열 안의 우연한 일치를 줄인다 — 주석에 "댓글"이라 써둔 걸로 막히면 안 된다. */
function isComment(line) {
  return /^\s*(\/\/|\/\*|\*|#)/.test(line)
}

/**
 * 파일 안의 면제 선언을 읽는다: `residue-scan-allow: <규칙id> — <이유>`
 *
 * 면제를 두는 이유: 규칙은 대부분 옳지만 항상 옳지는 않다(예: `covers.ts`의 커버 색 팔레트는
 * 토큰이 아니라 의도된 자산이다). 면제 수단이 없으면 사람들이 검사기 자체를 꺼버린다.
 * 대신 **이유를 반드시 적게** 해서, 나중에 읽는 사람이 판단을 되짚을 수 있게 한다.
 */
function suppressions(text) {
  const allowed = new Map()
  for (const m of text.matchAll(/residue-scan-allow:\s*([\w-]+)\s*[—\-:]\s*(.+)/g)) {
    allowed.set(m[1], m[2].trim())
  }
  return allowed
}

function scanFile(file) {
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  const allowed = suppressions(text)
  const findings = []

  for (const rule of RULES) {
    if (allowed.has(rule.id)) continue
    if (rule.custom) {
      const result = rule.custom(text, file)
      if (result) {
        findings.push({
          rule: rule.id,
          level: rule.level,
          line: 0,
          code: typeof result === 'string' ? result : rule.message || rule.id,
          why: rule.why,
        })
      }
      continue
    }
    lines.forEach((line, i) => {
      if (isComment(line)) return
      if (rule.re.test(line)) {
        findings.push({
          rule: rule.id,
          level: rule.level,
          line: i + 1,
          code: line.trim().slice(0, 120),
          why: rule.why,
        })
      }
    })
  }
  return findings
}

function main() {
  const args = process.argv.slice(2)
  const asJson = args.includes('--json')
  const targets = args.filter((a) => !a.startsWith('--'))
  const roots = targets.length ? targets.map((t) => resolve(t)) : [resolve(PROJECT, 'src')]

  const files = roots.flatMap((r) => (statSync(r).isDirectory() ? walk(r) : [r]))
  const results = []
  for (const f of files) {
    for (const finding of scanFile(f)) {
      results.push({ file: relative(PROJECT, f), ...finding })
    }
  }

  if (asJson) {
    console.log(JSON.stringify(results, null, 2))
  } else {
    const blocks = results.filter((r) => r.level === 'BLOCK')
    const warns = results.filter((r) => r.level === 'WARN')
    console.log(`검사한 파일 ${files.length}개 — 막음 ${blocks.length}건, 확인필요 ${warns.length}건\n`)
    for (const group of [blocks, warns]) {
      for (const r of group) {
        console.log(`[${r.level}] ${r.file}${r.line ? `:${r.line}` : ''}  (${r.rule})`)
        console.log(`    ${r.code}`)
        console.log(`    왜: ${r.why}\n`)
      }
    }
    if (!results.length) console.log('깨끗하다.')
  }

  process.exit(results.some((r) => r.level === 'BLOCK') ? 1 : 0)
}

main()
