/* 로컬 앱 + 로컬 Supabase에서 나만 보기 표시·공개로 바꾸기·⋯ 수정·앨범방 편집을 검사한다(2026-09-28).
   준비: supabase db reset → local-app-seed.mjs → 로컬 키로 앱을 127.0.0.1:4337에 띄운다(인수인계 참고).
   실행: ONEULDO_PLAYWRIGHT_PATH=... ONEULDO_BROWSER_EXECUTABLE=... ONEULDO_APP_TEST_DIR=<seed와 같은 폴더> node supabase/tests/local-app-private-edit.mjs <결과 폴더> */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.env.ONEULDO_PLAYWRIGHT_PATH ? pathToFileURL(path.join(process.env.ONEULDO_PLAYWRIGHT_PATH, 'index.mjs')).href : 'playwright')
const OUT = process.argv[2] || '/tmp/oneuldo-app-check'
fs.mkdirSync(OUT, { recursive: true })
const BASE = process.env.ONEULDO_APP_URL || 'http://127.0.0.1:4337'
if (!['127.0.0.1', 'localhost'].includes(new URL(BASE).hostname)) throw new Error('로컬 앱에서만 실행합니다.')
const R = fs.readFileSync(`${process.env.ONEULDO_APP_TEST_DIR || '/tmp/oneuldo-app-test'}/seed-room.txt`, 'utf8').trim()
const passes = []
const record = (name) => { passes.push(name); console.log('PASS', name) }
const browser = await chromium.launch({ executablePath: process.env.ONEULDO_BROWSER_EXECUTABLE || undefined })
const errors = []
async function login(user) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/140 Mobile OneuldoApp/1.0' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('#username', user)
  await page.fill('#password', 'test-password-1234')
  await page.getByRole('button', { name: /로그인/ }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 })
  return page
}
async function waitCount(locator, n, label) {
  for (let i = 0; i < 100; i++) { if (await locator.count() === n) return; await new Promise((r) => setTimeout(r, 100)) }
  throw new Error(`시간 초과: ${label} (${await locator.count()} != ${n})`)
}
const card = (page, text) => page.locator('li').filter({ hasText: text })
try {
  const mom = await login('uimom')
  await mom.goto(`${BASE}/rooms/${R}`, { waitUntil: 'networkidle' })
  await mom.getByText('혼자 적어 둔 첫 기록').waitFor()
  assert.equal(await mom.getByText('나만 보기', { exact: true }).count(), 3)
  assert.equal(await card(mom, '같이 본 바다').getByText('나만 보기', { exact: true }).count(), 0)
  record('작성자 화면: 나만 보기 3개에만 표시, 공유 추억에는 없음')

  const jiwoo = await login('uijiwoo')
  await jiwoo.goto(`${BASE}/rooms/${R}`, { waitUntil: 'networkidle' })
  await jiwoo.getByText('같이 본 바다').waitFor()
  assert.equal(await jiwoo.getByText('혼자 적어 둔 첫 기록').count(), 0)
  assert.equal(await jiwoo.getByRole('link', { name: '편집', exact: true }).count(), 1) // 지우도 자기 글이 있다
  record('상대 화면: 나만 보기 추억은 보이지 않음')

  // ⋯ 메뉴: 공유 글에는 '모두에게 공개'가 없고, 나만 보기 글에는 있다.
  await card(mom, '같이 본 바다').getByRole('button', { name: /더보기/ }).click()
  assert.equal(await mom.getByRole('menuitem', { name: '모두에게 공개' }).count(), 0)
  await mom.keyboard.press('Escape')
  await card(mom, '세 번째 혼자 기록').getByRole('button', { name: /더보기/ }).click()
  await mom.getByRole('menuitem', { name: '모두에게 공개' }).waitFor()
  assert.equal(await mom.getByRole('menuitem', { name: '수정', exact: true }).count(), 1)
  assert.equal(await mom.getByRole('menuitem', { name: /문구 고치기|사진·영상·목소리 고치기/ }).count(), 0)
  record('⋯ 메뉴: 고치기 두 항목이 "수정" 하나로 합쳐짐')
  await mom.screenshot({ path: path.join(OUT, '01_앱_나만보기_메뉴.png') })
  await mom.getByRole('menuitem', { name: '모두에게 공개' }).click()
  await mom.getByRole('heading', { name: '이 추억을 공개할까요?' }).waitFor()
  await mom.screenshot({ path: path.join(OUT, '02_앱_공개_확인창.png') })
  await mom.getByRole('button', { name: '그만두기' }).click()
  assert.equal(await card(mom, '세 번째 혼자 기록').getByText('나만 보기', { exact: true }).count(), 1)
  await card(mom, '세 번째 혼자 기록').getByRole('button', { name: /더보기/ }).click()
  await mom.getByRole('menuitem', { name: '모두에게 공개' }).click()
  await mom.getByRole('button', { name: '공개하기' }).click()
  await mom.getByRole('heading', { name: '이 추억을 공개할까요?' }).waitFor({ state: 'detached' })
  await mom.waitForFunction(() => document.querySelectorAll('li').length > 0)
  await card(mom, '세 번째 혼자 기록').getByText('나만 보기', { exact: true }).waitFor({ state: 'detached' })
  record('⋯ 메뉴: 그만두기는 그대로, 공개하기 후 표시 사라짐')

  await jiwoo.reload({ waitUntil: 'networkidle' })
  await jiwoo.getByText('세 번째 혼자 기록').waitFor()
  assert.equal(await jiwoo.getByText('혼자 적어 둔 첫 기록').count(), 0)
  record('상대 화면: 공개한 1개만 새로 보임')

  // 편집 모드
  await mom.getByRole('link', { name: '편집', exact: true }).click()
  await mom.waitForURL(/edit=1/)
  await mom.getByRole('heading', { name: '추억 고르기' }).waitFor()
  assert.equal(await mom.getByRole('button', { name: /지우님의 추억.*고르기/ }).count(), 0)
  record('편집: 남의 글은 고를 수 없음')
  await mom.getByRole('button', { name: '엄마님의 추억(나만 보기) 고르기' }).first().click()
  await mom.getByText('1개 골랐어요').waitFor()
  assert.equal(await mom.getByRole('button', { name: '공개로 바꾸기' }).isEnabled(), true)
  assert.equal(await mom.getByRole('link', { name: '수정', exact: true }).count(), 1)
  await mom.getByRole('button', { name: '엄마님의 추억 고르기' }).first().click() // 공유(또는 공개된) 내 글
  await mom.getByText('2개 골랐어요').waitFor()
  assert.equal(await mom.getByRole('link', { name: '수정', exact: true }).count(), 0)
  assert.equal(await mom.getByRole('button', { name: '수정', exact: true }).isDisabled(), true)
  await mom.screenshot({ path: path.join(OUT, '03_앱_편집모드_2개선택.png') })
  record('편집: 1개면 수정 가능, 2개면 수정 막힘, 나만 보기가 섞이면 공개 가능')

  await mom.getByRole('button', { name: '공개로 바꾸기' }).click()
  await mom.getByRole('heading', { name: '이 추억을 공개할까요?' }).waitFor()
  await mom.getByRole('button', { name: '공개하기' }).click()
  await mom.getByText('추억 1개를 공개했어요.').waitFor()
  await waitCount(mom.getByText('나만 보기', { exact: true }), 1, '공개 반영')
  record('편집: 섞어 골라도 나만 보기 1개만 공개, 남은 나만 보기 1개')

  // 여러 장 삭제: 공유 글 두 개(같이 본 바다, 세 번째 혼자 기록)
  await mom.getByRole('button', { name: '엄마님의 추억 고르기' }).nth(0).click()
  await mom.getByRole('button', { name: '엄마님의 추억 고르기' }).nth(1).click()
  await mom.getByText('2개 골랐어요').waitFor()
  await mom.getByRole('button', { name: '삭제', exact: true }).click()
  await mom.getByRole('heading', { name: '추억 2개를 삭제할까요?' }).waitFor()
  await mom.getByRole('button', { name: '삭제하기' }).click()
  await mom.getByText('추억 2개를 삭제했어요.').waitFor()
  await waitCount(mom.locator('ul[aria-label$="의 추억"] > li'), 3, '삭제 반영')
  record('편집: 두 개 한꺼번에 삭제 후 목록 3개')

  await mom.getByRole('link', { name: '완료' }).click()
  await mom.waitForURL((u) => !u.search.includes('edit'))
  await mom.getByRole('link', { name: '마음 표현하기' }).waitFor()
  record('완료: 편집이 끝나고 평소 화면으로')
  await mom.screenshot({ path: path.join(OUT, '04_앱_편집후.png') })

  // 상세에도 표시
  const privateLeft = card(mom, '나만 보기')
  await privateLeft.getByRole('link', { name: /자세히 보기/ }).first().click()
  await mom.waitForURL(/\/memories\/[^/]+$/)
  await mom.getByText('나만 보기', { exact: true }).waitFor()
  await mom.screenshot({ path: path.join(OUT, '05_앱_상세_나만보기.png') })
  record('상세: 나만 보기 표시')
  await mom.getByRole('button', { name: '엄마님의 추억 더보기' }).click()
  await mom.getByRole('menuitem', { name: '수정', exact: true }).click()
  await mom.waitForURL(/\/edit$/)
  await mom.getByText('혼자 적어 둔 첫 기록').or(mom.locator('textarea')).first().waitFor()
  record('⋯ 메뉴 수정: 수정 화면(사진·영상·목소리·문구)으로 이동')

  assert.deepEqual(errors, [])
  record('브라우저 실행 오류 0건')
  fs.writeFileSync(path.join(OUT, 'app-result.json'), JSON.stringify({ checkedAt: new Date().toISOString(), base: BASE, passes, notes: ['로컬 앱 + 로컬 Supabase', '격리 Chrome for Testing, 앱 UA'] }, null, 2))
  console.log(`APP_CHECK_PASS ${passes.length}`)
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally { await browser.close() }
