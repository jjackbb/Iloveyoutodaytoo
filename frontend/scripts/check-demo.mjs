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
// 키 없이 배포한 데모 전용 주소만 추가로 허용한다. 기존 앱 서버 주소는 검사하지 않는다.
const DEPLOYED_DEMO_HOSTS = ['oneuldo-demo.vercel.app']
if (!['localhost', '127.0.0.1'].includes(new URL(BASE).hostname) && !DEPLOYED_DEMO_HOSTS.includes(new URL(BASE).hostname)) throw new Error('이 검사는 로컬 데모나 데모 전용 배포에서만 실행합니다.')
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

/** 영상(2026-09-28 데모에 추가): 50MB 초과 거절, 짧은 영상 담기·저장·상세 재생·새로고침 유지. */
async function checkVideo(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  observe(page)
  await page.goto(`${ROOM}/compose`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^영상/ }).click()
  const videoInput = page.locator('input[type=file][accept*="video"]')

  // 50MB를 넘는 파일은 메모리로 넘길 수 없어 검사용 폴더에 잠시 만든다.
  const bigPath = path.join(OUTPUT, 'big.mp4')
  fs.writeFileSync(bigPath, Buffer.alloc(50 * 1024 * 1024 + 1, 1))
  await videoInput.setInputFiles(bigPath)
  fs.rmSync(bigPath)
  await page.getByText(/50MB 이하로 다시/).waitFor()
  assert.equal(await page.getByRole('button', { name: '마음 남기기', exact: true }).isDisabled(), true)
  record('영상 50MB 초과는 이유를 알리고 담지 않음')

  // 브라우저 안에서 1초짜리 webm을 만든다(실제 카메라가 아닌 캔버스 녹화).
  const webm = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 48
    const ctx = canvas.getContext('2d')
    const recorder = new MediaRecorder(canvas.captureStream(10), { mimeType: 'video/webm' })
    const chunks = []
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
    const stopped = new Promise((resolve) => { recorder.onstop = resolve })
    recorder.start(100)
    for (let i = 0; i < 12; i++) { ctx.fillStyle = `hsl(${i * 30} 60% 60%)`; ctx.fillRect(0, 0, 64, 48); await new Promise((r) => setTimeout(r, 100)) }
    recorder.stop(); await stopped
    const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer())
    let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  })
  await videoInput.setInputFiles({ name: 'short.webm', mimeType: 'video/webm', buffer: Buffer.from(webm, 'base64') })
  await page.getByLabel('담은 영상 미리보기').waitFor()
  await page.getByLabel('지금 담은 내용').getByText(/영상 0:0/).waitFor()
  // 다른 탭으로 옮겼다 돌아와도 영상이 남는다.
  await page.getByRole('button', { name: /^손글씨/ }).click()
  await page.getByRole('button', { name: /^영상/ }).click()
  await page.getByLabel('담은 영상 미리보기').waitFor()
  await page.getByRole('button', { name: '마음 남기기', exact: true }).click()
  await page.waitForURL('**/memories/**')
  await page.getByLabel('지우님이 남긴 영상').waitFor()
  // Blob은 브라우저 밖으로 꺼낼 수 없어 크기·형식은 페이지 안에서 잰다.
  const saved = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('oneuldo-portfolio-demo-v1', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const get = request.result.transaction('snapshot', 'readonly').objectStore('snapshot').get('current')
      get.onsuccess = () => { const video = get.result.memories[0].video; request.result.close(); resolve({ isBlob: video.blob instanceof Blob, size: video.blob.size, type: video.blob.type, durationMs: video.durationMs }) }
    }
  }))
  assert.ok(saved.isBlob && saved.size > 0 && saved.type.startsWith('video/'), JSON.stringify(saved))
  assert.ok(saved.durationMs > 0 && saved.durationMs <= 30000, JSON.stringify(saved))
  await page.reload({ waitUntil: 'networkidle' })
  const player = page.getByLabel('지우님이 남긴 영상')
  await player.waitFor()
  await poll(() => player.evaluate((video) => video.readyState >= 1), '영상 불러오기')
  await page.goto(ROOM, { waitUntil: 'networkidle' })
  await page.getByText(/영상 0:0/).first().waitFor()
  // 카드의 ▶: 상세로 가지 않고 그 자리에서 영상 재생(2026-09-28).
  await page.getByRole('button', { name: '지우님의 영상 재생' }).click()
  await page.getByLabel('지우님이 남긴 영상').waitFor()
  assert.equal(page.url(), ROOM)
  record('짧은 영상 담기·탭 왕복 유지·저장·상세 재생 준비·새로고침 유지·앨범방 미리보기')
  await page.screenshot({ path: path.join(OUTPUT, 'video-room.png'), fullPage: true })
  await context.close()
}

/** 카드의 좋아요·댓글 수·손글씨 제자리 재생, 상세의 인스타그램식 좋아요·댓글(2026-09-28). */
async function checkCardAndComments(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  observe(page)
  await page.goto(ROOM, { waitUntil: 'networkidle' })
  const card = page.locator('li').filter({ hasText: '바쁜 하루였지' })
  assert.equal(await card.getByRole('link', { name: /마음 열기/ }).count(), 1)
  await card.getByRole('button', { name: '엄마님의 손글씨 재생' }).click()
  await card.getByRole('button', { name: '엄마님의 손글씨 다시 재생' }).waitFor()
  assert.equal(page.url(), ROOM)
  record('카드: 손글씨 ▶를 누르면 상세로 가지 않고 그 자리에서 재생')
  await card.getByRole('button', { name: /^좋아요 0개/ }).click()
  await card.getByRole('button', { name: /^좋아요 1개/ }).waitFor()
  assert.equal(await card.getByRole('link', { name: '댓글 0개 보기' }).count(), 1)
  assert.equal(page.url(), ROOM)
  record('카드: 왼쪽 아래 하트로 바로 좋아요, 옆에 댓글 수')

  // 작성자 줄은 링크가 아니고, 문구를 눌러도 상세로 간다.
  assert.equal(await card.locator('.demo-author a').count(), 0)
  await card.getByRole('link', { name: /바쁜 하루였지/ }).click()
  await page.waitForURL('**/memories/**')
  record('카드: 작성자 옆 > 없음, 마음 표현·문구를 누르면 상세')
  assert.equal(await page.getByText('마음이 닿았어요').count(), 0)
  assert.equal(await page.getByText('답장을 서두르지 않아도').count(), 0)
  assert.equal(await page.getByText('함께 남긴 마음 더 보기').count(), 0)
  await page.getByText('아직 댓글이 없어요.').waitFor()
  await page.getByLabel('댓글', { exact: true }).fill('나도 보고 싶어요')
  await page.getByRole('button', { name: '게시' }).click()
  await page.getByText('나도 보고 싶어요').waitFor()
  assert.equal(await page.getByLabel('댓글', { exact: true }).inputValue(), '')
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('나도 보고 싶어요').waitFor()
  assert.equal(await page.getByRole('button', { name: /^좋아요 1개/ }).getAttribute('aria-pressed'), 'true')
  await page.screenshot({ path: path.join(OUTPUT, 'detail-like-comment.png') })
  await page.goto(ROOM, { waitUntil: 'networkidle' })
  await page.locator('li').filter({ hasText: '바쁜 하루였지' }).getByRole('link', { name: '댓글 1개 보기' }).waitFor()
  await page.screenshot({ path: path.join(OUTPUT, 'room-card-actions.png') })
  record('상세: 옛 문구 3개 없음, 댓글 달기·새로고침 유지, 카드 댓글 수 1')
  await context.close()
}

/** 내 마음 ⋯ 메뉴(수정·삭제)와 앨범방 편집(2026-09-28, 앱과 같은 동작). */
async function checkEditDelete(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  observe(page)
  await page.goto(ROOM, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: '함께 남긴 순간들' }).waitFor()
  assert.equal(await page.getByRole('link', { name: '편집', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: /더보기/ }).count(), 0)
  record('내 마음이 없으면 편집·⋯ 없음(남의 마음에는 ⋯ 없음)')

  for (const text of ['고칠 마음', '지울 마음']) {
    await page.goto(`${ROOM}/compose`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /^손글씨/ }).click()
    await draw(page)
    await page.getByLabel('함께 남길 한마디').fill(text)
    await page.getByRole('button', { name: '마음 남기기', exact: true }).click()
    await page.waitForURL('**/memories/**')
  }
  await page.goto(ROOM, { waitUntil: 'networkidle' })
  await page.locator('li').filter({ hasText: '고칠 마음' }).getByRole('link', { name: /마음 열기/ }).click()
  await page.waitForURL('**/memories/**')
  await page.getByRole('button', { name: /^좋아요/ }).click()
  await page.locator('button[aria-pressed="true"][aria-label^="좋아요"]').waitFor()
  await page.getByRole('button', { name: '지우님의 마음 더보기' }).click()
  await page.getByRole('menuitem', { name: '삭제' }).waitFor()
  await page.screenshot({ path: path.join(OUTPUT, 'detail-more-menu.png') })
  await page.getByRole('menuitem', { name: '수정' }).click()
  await page.waitForURL('**/edit')
  await page.getByRole('heading', { name: '마음 고치기' }).waitFor()
  assert.equal(await page.getByLabel('함께 남길 한마디').inputValue(), '고칠 마음')
  await page.getByText('1획', { exact: true }).waitFor()
  await page.getByLabel('함께 남길 한마디').fill('고친 마음')
  await page.getByRole('button', { name: '고친 내용 저장하기' }).click()
  await page.waitForURL((url) => /\/memories\/[^/]+$/.test(url.pathname))
  await page.getByText('고친 마음').waitFor()
  assert.equal(await page.getByRole('button', { name: /^좋아요/ }).getAttribute('aria-pressed'), 'true')
  record('⋯ 수정: 원래 내용으로 열리고, 고친 뒤 받은 반응은 그대로')

  await page.getByRole('button', { name: '지우님의 마음 더보기' }).click()
  await page.getByRole('menuitem', { name: '수정' }).click()
  await page.waitForURL('**/edit')
  await page.getByLabel('함께 남길 한마디').fill('저장하지 않을 글')
  await page.getByRole('link', { name: '마음으로 돌아가기' }).click()
  await page.getByText('고친 마음').waitFor()
  await page.getByRole('button', { name: '지우님의 마음 더보기' }).click()
  await page.getByRole('menuitem', { name: '수정' }).click()
  await page.waitForURL('**/edit')
  assert.equal(await page.getByLabel('함께 남길 한마디').inputValue(), '고친 마음')
  await page.getByRole('link', { name: '마음으로 돌아가기' }).click()
  record('고치다 떠나면 저장하지 않은 내용은 버려짐')

  await page.goto(ROOM, { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: '편집', exact: true }).click()
  await page.waitForURL(`${ROOM}/edit`)
  await page.getByRole('heading', { name: '추억 고르기' }).waitFor()
  assert.equal(await page.getByRole('button', { name: /엄마님의 마음 고르기/ }).count(), 0)
  const picks = page.getByRole('button', { name: /지우님의 마음 고르기/ })
  assert.equal(await picks.count(), 2)
  await picks.nth(0).click()
  await page.getByText('1개 골랐어요').waitFor()
  assert.equal(await page.getByRole('link', { name: '수정', exact: true }).count(), 1)
  await picks.nth(1).click()
  await page.getByText('2개 골랐어요').waitFor()
  assert.equal(await page.getByRole('button', { name: '수정', exact: true }).isDisabled(), true)
  await page.screenshot({ path: path.join(OUTPUT, 'room-edit.png') })
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await page.getByRole('heading', { name: '마음 2개를 삭제할까요?' }).waitFor()
  await page.getByRole('button', { name: '그만두기' }).click()
  assert.equal((await readSnapshot(page)).memories.length, 3)
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await page.getByRole('button', { name: '삭제하기' }).click()
  await poll(async () => (await readSnapshot(page)).memories.length === 1, '여러 개 삭제')
  record('앨범방 편집: 남의 마음은 못 고름, 1개면 수정·2개면 수정 막힘, 그만두기는 그대로, 여러 개 삭제')

  await page.getByRole('link', { name: '완료' }).click()
  await page.waitForURL(ROOM)
  assert.equal(await page.getByRole('link', { name: '편집', exact: true }).count(), 0)
  await page.getByLabel('체험 인물').selectOption('parent')
  await poll(async () => (await readSnapshot(page)).actor === 'parent', '부모 전환')
  await page.getByRole('button', { name: '엄마님의 마음 더보기' }).click()
  await page.getByRole('menuitem', { name: '삭제' }).click()
  await page.getByRole('button', { name: '삭제하기' }).click()
  await page.getByRole('heading', { name: '아직 남겨진 마음이 없어요' }).waitFor()
  const snapshot = await readSnapshot(page)
  assert.equal(snapshot.memories.length, 0)
  assert.ok(!snapshot.seen.parent.includes('example-heart'))
  record('⋯ 삭제: 예시까지 지우면 빈 앨범방 안내, 읽음 표시에서도 빠짐')
  await context.close()
}

/** 녹음 중 세 이탈 경로(상단 뒤로 가기·도구막대 데모 링크·브라우저 뒤로 가기)의 확인과 버리기. */
async function checkRecordingLeave(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] })
  const page = await context.newPage()
  observe(page)
  let answer = false
  const dialogs = []
  page.on('dialog', (dialog) => { dialogs.push(dialog.message()); void (answer ? dialog.accept() : dialog.dismiss()) })
  const HOME = `${BASE}/demo`
  const leaveMessage = (message) => message.startsWith('녹음하는 중이에요.')
  // 나간 뒤 마이크가 실제로 꺼졌는지 보려고 녹음기가 받은 마이크를 모아 둔다.
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    window.__demoStreams = []
    navigator.mediaDevices.getUserMedia = async (constraints) => { const stream = await original(constraints); window.__demoStreams.push(stream); return stream }
  })

  // 2026-09-28부터 홈에는 작성 버튼이 없다. 작성은 앨범방의 + 에서 시작한다.
  await page.goto(ROOM, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: '함께 남긴 순간들' }).waitFor()

  async function startRecording() {
    await page.getByRole('link', { name: '마음 남기기', exact: true }).click()
    await page.waitForURL(`${ROOM}/compose`)
    await page.getByRole('button', { name: /^목소리/ }).click()
    await page.getByRole('button', { name: '녹음 시작하기' }).click()
    await page.getByRole('button', { name: '녹음 멈추기' }).waitFor()
    await page.waitForTimeout(400)
  }
  async function expectStillRecording(before) {
    await poll(async () => dialogs.length === before + 1, '이탈 확인창')
    assert.ok(leaveMessage(dialogs.at(-1)))
    await page.waitForTimeout(300)
    assert.equal(page.url(), `${ROOM}/compose`)
    assert.ok(await page.getByRole('button', { name: '녹음 멈추기' }).isVisible())
  }
  async function expectLeftAndDiscarded(before, target = ROOM) {
    await page.waitForURL(target)
    assert.equal(dialogs.length, before + 1)
    await poll(() => page.evaluate(() => window.__demoStreams.length > 0 && window.__demoStreams.every((stream) => stream.getTracks().every((track) => track.readyState === 'ended'))), '마이크 해제')
    if (target === HOME) {
      await page.getByRole('link', { name: /우리 앨범방 열기/ }).click()
      await page.waitForURL(ROOM)
    }
    await page.getByRole('heading', { name: '함께 남긴 순간들' }).waitFor()
    // 다시 들어가면 녹음은 담기지 않았다.
    await page.getByRole('link', { name: '마음 남기기', exact: true }).click()
    await page.getByRole('button', { name: '녹음 시작하기' }).waitFor()
    assert.equal(await page.getByRole('button', { name: '다시 녹음하기' }).count(), 0)
    assert.equal(await page.getByLabel('지금 담은 내용').count(), 0)
    await page.getByRole('link', { name: '앨범방으로 돌아가기' }).click()
    await page.waitForURL(ROOM)
  }

  // 1) 상단 뒤로 가기
  await startRecording()
  answer = false
  let before = dialogs.length
  await page.getByRole('link', { name: '앨범방으로 돌아가기' }).click()
  await expectStillRecording(before)
  answer = true
  before = dialogs.length
  await page.getByRole('link', { name: '앨범방으로 돌아가기' }).click()
  await expectLeftAndDiscarded(before)
  record('녹음 중 상단 뒤로 가기: 계속하면 녹음 유지, 나가면 녹음 버리고 들어온 화면으로')

  // 2) 도구막대의 데모 링크
  await startRecording()
  answer = false
  before = dialogs.length
  await page.getByRole('link', { name: '포트폴리오 데모' }).click()
  await expectStillRecording(before)
  answer = true
  before = dialogs.length
  await page.getByRole('link', { name: '포트폴리오 데모' }).click()
  await expectLeftAndDiscarded(before, HOME)
  record('녹음 중 도구막대 데모 링크: 계속/나가기 확인과 녹음 버리기')

  // 3) 브라우저 뒤로 가기
  await startRecording()
  answer = false
  before = dialogs.length
  await page.goBack()
  await expectStillRecording(before)
  // 계속한 뒤에도 다시 뒤로 가기를 받는다.
  before = dialogs.length
  await page.goBack()
  await expectStillRecording(before)
  answer = true
  before = dialogs.length
  await page.goBack()
  await expectLeftAndDiscarded(before)
  record('녹음 중 브라우저 뒤로 가기: 계속하면 녹음 유지(반복 가능), 나가면 녹음 버리고 이전 화면으로')

  // 4) 녹음을 마친 뒤에는 묻지 않고, 뒤로 가기 한 번에 이전 화면으로 간다. 녹음은 초안에 남는다.
  await startRecording()
  await page.getByRole('button', { name: '녹음 멈추기' }).click()
  await page.getByRole('button', { name: '다시 녹음하기' }).waitFor()
  await page.waitForTimeout(300)
  before = dialogs.length
  await page.goBack()
  await page.waitForURL(ROOM)
  assert.equal(dialogs.length, before)
  await page.getByRole('link', { name: '마음 남기기', exact: true }).click()
  await page.getByRole('button', { name: '다시 녹음하기' }).waitFor()
  record('녹음을 마친 뒤 뒤로 가기는 확인 없이 한 번에 이동하고 녹음은 초안에 유지')

  await page.screenshot({ path: path.join(OUTPUT, 'compose-after-recording-leave.png'), fullPage: true })
  await context.close()
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
    const mainDialogs = []
    page.on('dialog', (dialog) => { mainDialogs.push(dialog.message()); void dialog.accept() })

    const response = await page.goto(`${BASE}/demo`, { waitUntil: 'networkidle' })
    assert.equal(response.status(), 200)
    await page.getByRole('link', { name: /우리 앨범방 열기/ }).waitFor()
    assert.equal((await readSnapshot(page)).memories.length, 1)
    // 홈은 앨범방 카드만(2026-09-28): 인사·안내·아래 버튼 없음, 가운데 제목, 새 앨범방 버튼, 체험 안내는 앱 화면 밖.
    assert.equal(await page.getByText('우리 사이에 쌓인 마음').count(), 0)
    assert.equal(await page.locator('.demo-phone').getByRole('link', { name: '마음 남기기' }).count(), 0)
    assert.equal(await page.locator('.demo-phone').getByText('가상의 앨범방이에요').count(), 0)
    assert.equal(await page.locator('.demo-toolbar').getByRole('link', { name: '서비스 소개' }).count(), 1)
    assert.ok((await page.getByRole('link', { name: /우리 앨범방 열기/ }).getAttribute('aria-label')).includes('엄마·지우'))
    await page.getByRole('button', { name: '새 앨범방 만들기' }).click()
    await page.getByText('체험에서는 앨범방을 하나만 둘 수 있어요').waitFor()
    record('홈: 앨범방 카드와 프로필만, 체험 안내는 화면 밖, 새 앨범방 버튼')
    record('비로그인 데모 진입과 가상 예시 로드')

    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.screenshot({ path: path.join(OUTPUT, `home-${width}.png`), fullPage: true })
    }
    record('홈 320·390·1440px 가로 넘침 없음')
    await page.setViewportSize({ width: 390, height: 844 })

    await page.getByRole('button', { name: '우리 앨범방 즐겨찾기' }).click()
    await poll(async () => (await readSnapshot(page)).favorite.child, '즐겨찾기 저장')
    await page.getByLabel('체험 인물').selectOption('parent')
    await poll(async () => (await readSnapshot(page)).actor === 'parent', '부모 전환')
    assert.equal(await page.getByRole('button', { name: '우리 앨범방 즐겨찾기' }).getAttribute('aria-pressed'), 'false')
    await page.getByLabel('체험 인물').selectOption('child')
    await poll(async () => (await readSnapshot(page)).actor === 'child', '자녀 전환')
    record('인물별 즐겨찾기 분리')

    await page.getByRole('link', { name: /우리 앨범방 열기/ }).click()
    await page.waitForURL(ROOM)
    await page.getByRole('heading', { name: '함께 남긴 순간들' }).waitFor()
    assert.equal(await page.getByText('엄마와 지우의 앨범방').count(), 0)
    // 스크롤해도 오른쪽 아래에 떠 있는 + (앱 화면 안).
    const fab = await page.getByRole('link', { name: '마음 남기기', exact: true }).evaluate((el) => { const r = el.getBoundingClientRect(); const phone = document.querySelector('.demo-phone').getBoundingClientRect(); return { right: phone.right - r.right, bottom: phone.bottom - r.bottom, visible: r.bottom <= innerHeight } })
    assert.ok(fab.visible && fab.right < 40 && fab.bottom < 40, JSON.stringify(fab))
    record('앨범방: 프로필 나열·"함께 남긴 순간들", 오른쪽 아래 + 버튼')
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
    await page.locator('input[type=file][accept^="image"]').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
    await page.getByAltText('선택한 사진 1').waitFor()
    await page.getByRole('button', { name: /^손글씨/ }).click()
    await page.getByText('1획', { exact: true }).waitFor()
    record('수단 전환 시 손글씨·사진·문구 유지')

    // 앨범방에서 들어왔으니 앨범방으로 돌아간다(홈에는 작성 버튼이 없다).
    await page.getByRole('link', { name: '앨범방으로 돌아가기' }).click()
    await page.waitForURL(ROOM)
    await page.getByRole('heading', { name: '함께 남긴 순간들' }).waitFor()
    record('작성 뒤로 가기가 들어온 화면(앨범방)으로 복귀')
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
    await page.getByText('검증용 기록: 오늘도 고마워요.').waitFor()
    const savedUrl = page.url()
    let snapshot = await readSnapshot(page)
    assert.equal(snapshot.memories.length, 2)
    assert.equal(snapshot.memories[0].handwriting.strokes.length, 1)
    assert.equal(snapshot.memories[0].photos.length, 1)
    record('손글씨·사진·문구 저장 후 상세 이동')

    await page.reload({ waitUntil: 'networkidle' })
    await page.getByText('검증용 기록: 오늘도 고마워요.').waitFor()
    await page.getByRole('button', { name: '지우님의 손글씨 다시 재생' }).waitFor()
    await page.getByRole('button', { name: '지우님의 손글씨 다시 재생' }).click()
    await page.getByRole('button', { name: '지우님의 손글씨 다시 재생' }).waitFor()
    assert.ok(await page.getByAltText('남긴 추억의 사진 1').evaluate((img) => img.complete && img.naturalWidth > 0))
    record('새로고침 후 미디어 복원·손글씨 재생')

    await page.getByLabel('체험 인물').selectOption('parent')
    await poll(async () => (await readSnapshot(page)).actor === 'parent', '반응 역할 전환')
    await page.getByRole('button', { name: /^좋아요/ }).click()
    await page.locator('button[aria-pressed="true"][aria-label^="좋아요"]').waitFor()
    await page.reload({ waitUntil: 'networkidle' })
    assert.equal(await page.getByRole('button', { name: /^좋아요/ }).getAttribute('aria-pressed'), 'true')
    snapshot = await readSnapshot(page)
    assert.deepEqual(snapshot.memories[0].likedBy, ['parent'])
    record('부모 시점 반응·새로고침 유지')
    await page.screenshot({ path: path.join(OUTPUT, 'detail-mobile.png'), fullPage: true })

    await page.goto(`${ROOM}/compose`, { waitUntil: 'networkidle' })
    assert.equal(await page.getByRole('link', { name: '앨범방으로 돌아가기' }).getAttribute('href'), '/demo/rooms/family')
    record('작성 주소로 바로 들어오면 뒤로 가기가 앨범방')
    await page.getByRole('button', { name: /^목소리/ }).click()
    await page.getByRole('button', { name: /녹음 시작/ }).click()
    await page.getByRole('button', { name: /녹음 멈추기/ }).waitFor()
    assert.equal(await page.getByRole('button', { name: /^손글씨/ }).isDisabled(), true)
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: /녹음 멈추기/ }).click()
    await poll(async () => page.getByRole('button', { name: '마음 남기기', exact: true }).isEnabled(), '녹음 저장 가능')
    await page.getByRole('button', { name: '마음 남기기', exact: true }).click()
    await page.waitForURL('**/memories/**')
    assert.ok((await readSnapshot(page)).memories[0].voice.durationSec < 3)
    await page.getByRole('button', { name: /엄마님의 목소리 듣기/ }).click()
    await poll(async () => page.locator('audio').evaluate((audio) => !audio.paused), '음성 재생')
    record('합성 마이크 3초 미만 녹음·저장·재생 및 녹음 중 전환 잠금')

    await page.getByRole('button', { name: '데모 초기화' }).click()
    await page.waitForURL(`${BASE}/demo`)
    await poll(async () => (await readSnapshot(page)).memories.length === 1, '초기화')
    snapshot = await readSnapshot(page)
    assert.equal(snapshot.actor, 'child')
    assert.equal(snapshot.memories[0].id, 'example-heart')
    await page.goto(savedUrl)
    await page.getByRole('heading', { name: '이 마음을 찾지 못했어요' }).waitFor()
    record('초기화 후 작성 미디어·반응 제거와 오래된 주소 복귀 안내')
    await page.goto(`${BASE}/demo/no-such-screen`)
    await page.getByRole('heading', { name: '이 화면을 찾지 못했어요' }).waitFor()
    record('알 수 없는 데모 주소는 화면을 찾지 못했다고 안내')
    // 녹음과 무관한 이동에서는 확인창이 뜨지 않았다(초기화 확인만).
    assert.deepEqual(mainDialogs.map((message) => message.startsWith('이 브라우저에서 체험하며')), [true])

    await checkRecordingLeave(browser)
    await checkVideo(browser)
    await checkCardAndComments(browser)
    await checkEditDelete(browser)

    // 저장 기록 손상: 초기화 안내가 맞고, 초기화로 복구된다.
    await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('oneuldo-portfolio-demo-v1', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const tx = request.result.transaction('snapshot', 'readwrite')
        tx.objectStore('snapshot').put({ broken: true }, 'current')
        tx.oncomplete = () => { request.result.close(); resolve() }
      }
    }))
    await page.goto(`${BASE}/demo`, { waitUntil: 'networkidle' })
    await page.getByText('위의 초기화로 다시 시도할 수 있어요.').waitFor()
    await page.getByRole('button', { name: '데모 초기화' }).click()
    await poll(async () => (await readSnapshot(page)).memories?.length === 1, '손상 기록 초기화')
    await page.getByText('위의 초기화로 다시 시도할 수 있어요.').waitFor({ state: 'detached' })
    record('저장 기록 손상 시 초기화 안내와 초기화 복구')

    // 저장소 자체를 못 여는 경우: 초기화로 된다고 안내하지 않는다.
    const blockedContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const blocked = await blockedContext.newPage()
    observe(blocked)
    await blocked.addInitScript(() => {
      indexedDB.open = () => { const request = {}; setTimeout(() => request.onerror?.()); return request }
    })
    await blocked.goto(`${BASE}/demo`)
    await blocked.getByText('브라우저 저장 공간을 열지 못했어요').waitFor()
    await blocked.getByText('저장소를 열 수 있을 때 다시 쓸 수 있어요').waitFor()
    assert.equal(await blocked.getByText('초기화로 다시 시도할 수 있어요').count(), 0)
    record('저장소 접근 불가 시 초기화로 된다고 안내하지 않음')
    await blockedContext.close()

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
