/* 실행: ONEULDO_PLAYWRIGHT_PATH=<설치된 playwright 경로> node scripts/check-demo.mjs
   격리된 브라우저 저장소만 사용한다. 실제 계정·DB·사용자 Chrome은 건드리지 않는다. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const { chromium } = await import(process.env.ONEULDO_PLAYWRIGHT_PATH
  ? pathToFileURL(path.join(process.env.ONEULDO_PLAYWRIGHT_PATH, 'index.mjs')).href
  : 'playwright')

const BASE = process.env.ONEULDO_DEMO_URL || 'http://127.0.0.1:4317'
const OUTPUT = process.env.ONEULDO_EVIDENCE_DIR || '/tmp/oneuldo-demo-evidence'
if (!['localhost', '127.0.0.1'].includes(new URL(BASE).hostname)) throw new Error('이 검사는 로컬 데모에서만 실행합니다.')
const ROOM = `${BASE}/demo/rooms/family`
const passes = []
const errors = []
const externalRequests = []
const serverActions = []
const record = (name) => { passes.push(name); console.log(`PASS ${name}`) }

async function readSnapshot(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('oneuldo-portfolio-demo-v1', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('snapshot', 'readonly')
      const get = tx.objectStore('snapshot').get('current')
      get.onsuccess = () => resolve(get.result)
      tx.oncomplete = () => db.close()
    }
  }))
}

async function poll(check, label) {
  for (let i = 0; i < 80; i++) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`시간 초과: ${label}`)
}

async function draw(page) {
  const canvas = page.getByRole('img', { name: '손글씨 쓰는 판' })
  await canvas.scrollIntoViewIfNeeded()
  const box = await canvas.boundingBox()
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .35)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .7, { steps: 12 })
  await page.mouse.move(box.x + box.width * .8, box.y + box.height * .3, { steps: 12 })
  await page.mouse.up()
}

function observe(page) {
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    const url = request.url()
    if (/^https?:/.test(url) && new URL(url).origin !== new URL(BASE).origin) externalRequests.push(url)
    if (request.headers()['next-action']) serverActions.push(url)
  })
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true })
  const browser = await chromium.launch({
    executablePath: process.env.ONEULDO_BROWSER_EXECUTABLE || undefined,
    headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  })
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] })
    const page = await context.newPage()
    observe(page)
    page.on('dialog', (dialog) => dialog.accept())

    const response = await page.goto(`${BASE}/demo`, { waitUntil: 'networkidle' })
    assert.equal(response.status(), 200)
    await page.getByRole('heading', { name: '우리 사이에 쌓인 마음' }).waitFor()
    assert.equal((await readSnapshot(page)).memories.length, 1)
    record('비로그인 데모 진입과 가상 예시 로드')

    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.screenshot({ path: path.join(OUTPUT, `home-${width}.png`), fullPage: true })
    }
    record('홈 320·390·1440px 가로 넘침 없음')
    await page.setViewportSize({ width: 390, height: 844 })

    await page.getByRole('button', { name: '우리 가족 앨범방 즐겨찾기' }).click()
    await poll(async () => (await readSnapshot(page)).favorite.child, '즐겨찾기 저장')
    await page.getByLabel('체험 인물').selectOption('parent')
    await poll(async () => (await readSnapshot(page)).actor === 'parent', '부모 전환')
    assert.equal(await page.getByRole('button', { name: '우리 가족 앨범방 즐겨찾기' }).getAttribute('aria-pressed'), 'false')
    await page.getByLabel('체험 인물').selectOption('child')
    await poll(async () => (await readSnapshot(page)).actor === 'child', '자녀 전환')
    record('인물별 즐겨찾기 분리')

    await page.getByRole('link', { name: '마음 남기기', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: '마음 남기기', exact: true }).isDisabled(), true)
    await page.getByRole('button', { name: /^손글씨/ }).click()
    await page.getByLabel('함께 남길 한마디').fill('검증용 기록: 오늘도 고마워요.')
    assert.equal(await page.getByRole('button', { name: '마음 남기기', exact: true }).isDisabled(), true)
    record('빈 입력·문구만으로 저장 불가')

    await draw(page)
    assert.equal(await page.getByRole('button', { name: '마음 남기기', exact: true }).isEnabled(), true)
    await page.getByRole('button', { name: /^사진/ }).click()
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 60; canvas.height = 60
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#d7c3a9'; ctx.fillRect(0, 0, 60, 60)
      return canvas.toDataURL('image/png').split(',')[1]
    })
    await page.locator('input[type=file]').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
    await page.getByAltText('선택한 사진 1').waitFor()
    await page.getByRole('button', { name: /^손글씨/ }).click()
    await page.getByText('1획', { exact: true }).waitFor()
    record('수단 전환 시 손글씨·사진·문구 유지')

    await page.getByRole('link', { name: '가족방으로 돌아가기' }).click()
    await page.getByRole('link', { name: '마음 남기기', exact: true }).click()
    assert.equal(await page.getByLabel('함께 남길 한마디').inputValue(), '검증용 기록: 오늘도 고마워요.')
    await page.getByText('1획', { exact: true }).waitFor()
    record('작성 중 화면 왕복 시 초안 유지')

    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      const bounds = await page.evaluate(() => {
        const fields = document.querySelector('.demo-compose-fields').getBoundingClientRect()
        const action = document.querySelector('.demo-compose-action').getBoundingClientRect()
        return { contentBottom: fields.bottom, actionTop: action.top, actionBottom: action.bottom, height: innerHeight }
      })
      assert.ok(bounds.contentBottom <= bounds.actionTop + 1, JSON.stringify(bounds))
      assert.ok(bounds.actionBottom <= bounds.height + 2, JSON.stringify(bounds))
      await page.screenshot({ path: path.join(OUTPUT, `compose-${width}.png`), fullPage: true })
    }
    record('작성 3개 화면 폭에서 저장 버튼과 입력 영역 분리')
    await page.setViewportSize({ width: 390, height: 844 })

    // 실제 저장 실패를 주입해, 실패 상태와 입력 보존을 확인한다.
    await page.evaluate(() => {
      window.__demoOriginalPut = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function () { throw new DOMException('test quota', 'QuotaExceededError') }
    })
    await page.getByRole('button', { name: '마음 남기기', exact: true }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByLabel('함께 남길 한마디').inputValue(), '검증용 기록: 오늘도 고마워요.')
    assert.equal((await readSnapshot(page)).memories.length, 1)
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.__demoOriginalPut })
    record('저장 실패 시 입력·기존 데이터 보존')

    await page.getByRole('button', { name: '마음 남기기', exact: true }).click()
    await page.waitForURL('**/memories/**')
    await page.getByText('검증용 기록: 오늘도 고마워요.', { exact: true }).waitFor()
    const savedUrl = page.url()
    let snapshot = await readSnapshot(page)
    assert.equal(snapshot.memories.length, 2)
    assert.equal(snapshot.memories[0].handwriting.strokes.length, 1)
    assert.equal(snapshot.memories[0].photos.length, 1)
    record('손글씨·사진·문구 저장 후 상세 이동')

    await page.reload({ waitUntil: 'networkidle' })
    await page.getByText('검증용 기록: 오늘도 고마워요.', { exact: true }).waitFor()
    await page.getByRole('button', { name: '지우님의 손글씨 다시 재생' }).waitFor()
    await page.getByRole('button', { name: '지우님의 손글씨 다시 재생' }).click()
    await page.getByRole('button', { name: '지우님의 손글씨 다시 재생' }).waitFor()
    assert.ok(await page.getByAltText('남긴 추억의 사진 1').evaluate((img) => img.complete && img.naturalWidth > 0))
    record('새로고침 후 미디어 복원·손글씨 재생')

    await page.getByLabel('체험 인물').selectOption('parent')
    await poll(async () => (await readSnapshot(page)).actor === 'parent', '반응 역할 전환')
    await page.getByRole('button', { name: /마음 전하기/ }).click()
    await page.getByRole('button', { name: /마음이 닿았어요/ }).waitFor()
    await page.reload({ waitUntil: 'networkidle' })
    assert.equal(await page.getByRole('button', { name: /마음이 닿았어요/ }).getAttribute('aria-pressed'), 'true')
    snapshot = await readSnapshot(page)
    assert.deepEqual(snapshot.memories[0].likedBy, ['parent'])
    record('부모 시점 반응·새로고침 유지')
    await page.screenshot({ path: path.join(OUTPUT, 'detail-mobile.png'), fullPage: true })

    await page.goto(`${ROOM}/compose`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /^목소리/ }).click()
    await page.getByRole('button', { name: /녹음 시작/ }).click()
    await page.getByRole('button', { name: /녹음 멈추기/ }).waitFor()
    assert.equal(await page.getByRole('button', { name: /^손글씨/ }).isDisabled(), true)
    await page.waitForTimeout(3300)
    await page.getByRole('button', { name: /녹음 멈추기/ }).click()
    await poll(async () => page.getByRole('button', { name: '마음 남기기', exact: true }).isEnabled(), '녹음 저장 가능')
    await page.getByRole('button', { name: '마음 남기기', exact: true }).click()
    await page.waitForURL('**/memories/**')
    await page.getByRole('button', { name: /엄마님의 목소리 듣기/ }).click()
    await poll(async () => page.locator('audio').evaluate((audio) => !audio.paused), '음성 재생')
    record('합성 마이크 녹음·저장·재생 및 녹음 중 전환 잠금')

    await page.getByRole('button', { name: '데모 초기화' }).click()
    await page.waitForURL(`${BASE}/demo`)
    await poll(async () => (await readSnapshot(page)).memories.length === 1, '초기화')
    snapshot = await readSnapshot(page)
    assert.equal(snapshot.actor, 'child')
    assert.equal(snapshot.memories[0].id, 'example-heart')
    await page.goto(savedUrl)
    await page.getByRole('heading', { name: '이 마음을 찾지 못했어요' }).waitFor()
    record('초기화 후 작성 미디어·반응 제거와 오래된 주소 복귀 안내')

    const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const denied = await deniedContext.newPage()
    observe(denied)
    await denied.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('test denial', 'NotAllowedError'))
    })
    await denied.goto(`${ROOM}/compose`)
    await denied.getByRole('button', { name: /^목소리/ }).click()
    await denied.getByRole('button', { name: /녹음 시작/ }).click()
    await denied.getByText(/마이크.*허용/).first().waitFor()
    await denied.getByRole('button', { name: /^손글씨/ }).click()
    await draw(denied)
    await denied.getByRole('button', { name: '마음 남기기', exact: true }).click()
    await denied.waitForURL('**/memories/**')
    record('마이크 권한 거부 후 손글씨로 완료')
    await deniedContext.close()

    assert.deepEqual(errors, [])
    assert.deepEqual(externalRequests, [])
    assert.deepEqual(serverActions, [])
    record('브라우저 실행 오류·외부 요청·실제 서버 액션 호출 0건')

    const result = { checkedAt: new Date().toISOString(), base: BASE, passes, errors, externalRequests, serverActions, notes: ['격리된 Chromium 자동화', '음성 입력은 합성 마이크', '실제 사용자 테스트·실기기·원격 DB 검증 아님'] }
    fs.writeFileSync(path.join(OUTPUT, 'result.json'), JSON.stringify(result, null, 2))
    console.log(`DEMO_CHECK_PASS ${passes.length}`)
  } finally { await browser.close() }
}

main().catch((error) => {
  fs.mkdirSync(OUTPUT, { recursive: true })
  fs.writeFileSync(path.join(OUTPUT, 'failure.json'), JSON.stringify({ passes, errors, error: error.stack }, null, 2))
  console.error(error)
  process.exitCode = 1
})
