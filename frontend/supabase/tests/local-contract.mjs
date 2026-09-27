// 로컬 Supabase(격리 DB)에서 새 DB 계약을 합성 계정으로 검사한다.
//
//   실행: (frontend/) supabase db reset && node supabase/tests/local-contract.mjs
//
// - 로컬 주소(127.0.0.1 / localhost)가 아니면 바로 멈춘다. 원격 프로젝트에는 절대 돌리지 않는다.
// - 키는 `supabase status -o env`에서 읽고 출력하지 않는다.
// - 이 검사는 "합성 검사"다. 실제 브라우저 작성·재생 검사와는 다른 근거다.

import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_BIN = process.env.SUPABASE_BIN ?? 'supabase'
const env = Object.fromEntries(
  execFileSync(SUPABASE_BIN, ['status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '')]
    }),
)

const URL_ = env.API_URL
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL_ ?? '')) {
  console.error('로컬 Supabase 주소가 아니라 멈춥니다:', URL_)
  process.exit(2)
}
const ANON = env.ANON_KEY
const SERVICE = env.SERVICE_ROLE_KEY

const results = []
function record(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}
async function expectOk(name, promise) {
  const { data, error } = await promise
  record(name, !error, error ? `${error.code ?? ''} ${error.message}` : '')
  return data
}
async function expectError(name, promise, code) {
  const { error } = await promise
  const pass = Boolean(error) && (!code || error.code === code || String(error.statusCode) === code)
  record(name, pass, error ? `${error.code ?? error.statusCode ?? ''} ${error.message}` : '오류 없이 통과함')
}
function expectEqual(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  record(name, pass, pass ? '' : `받음 ${JSON.stringify(actual)} / 기대 ${JSON.stringify(expected)}`)
}

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })
const anon = createClient(URL_, ANON, { auth: { persistSession: false } })
const stamp = Date.now().toString(36)

async function signUp(username, birthDate, extra = {}) {
  const client = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signUp({
    email: `${username}@id.oneuldo.local`,
    password: 'test-password-1234',
    options: { data: { name: username.toUpperCase(), username, birth_date: birthDate, auth_provider: 'email', ...extra } },
  })
  return { client, user: data?.user ?? null, error }
}

const bytes = (n, fill = 1) => new Uint8Array(n).fill(fill)
async function put(client, bucket, path, contentType, size = 64) {
  return client.storage.from(bucket).upload(path, bytes(size), { contentType })
}
async function canSign(client, bucket, path) {
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, 60)
  return Boolean(data?.signedUrl) && !error
}
async function canDownload(client, bucket, path) {
  const { data, error } = await client.storage.from(bucket).download(path)
  return Boolean(data) && !error
}
async function exists(bucket, path) {
  const folder = path.split('/').slice(0, -1).join('/')
  const name = path.split('/').pop()
  const { data } = await admin.storage.from(bucket).list(folder, { search: name })
  return (data ?? []).some((item) => item.name === name)
}

// ── 1. 가입과 개인 정보 ─────────────────────────────────────────
const A = await signUp(`a${stamp}`.slice(0, 16), '1990-05-01')
const B = await signUp(`b${stamp}`.slice(0, 16), '1988-02-02')
const C = await signUp(`c${stamp}`.slice(0, 16), '1995-07-07')
record('가입: 성인 A·B·C', !A.error && !B.error && !C.error && A.user && B.user && C.user,
  [A.error, B.error, C.error].filter(Boolean).map((e) => e.message).join(' / '))

const minor = await signUp(`m${stamp}`.slice(0, 16), '2015-03-03', {
  guardian_name: '보호자', guardian_phone: '01012345678', guardian_consented: true,
})
record('가입: 만 14세 미만은 보호자 동의 체크·전화번호가 있어도 거절', Boolean(minor.error), minor.error?.message ?? '가입됨')
const noBirth = createClient(URL_, ANON, { auth: { persistSession: false } })
const { error: noBirthErr } = await noBirth.auth.signUp({ email: `n${stamp}@id.oneuldo.local`, password: 'test-password-1234', options: { data: { name: 'N', username: `n${stamp}`.slice(0, 16) } } })
record('가입: 생년월일 없으면 거절', Boolean(noBirthErr), noBirthErr?.message ?? '가입됨')

const a = A.client, b = B.client, c = C.client
const aid = A.user.id, bid = B.user.id, cid = C.user.id

const ownPrivate = await expectOk('개인정보: 본인은 user_private 읽기', a.from('user_private').select('id, birth_date, username').eq('id', aid).single())
expectEqual('개인정보: 본인 생년월일', ownPrivate?.birth_date, '1990-05-01')
await expectError('개인정보: 생년월일 직접 변경 금지(열 권한)', a.from('user_private').update({ birth_date: '2000-01-01' }).eq('id', aid))
await expectError('개인정보: 보호자 확인 시각 직접 기록 금지', a.from('user_private').update({ guardian_consented_at: new Date().toISOString() }).eq('id', aid))
await expectOk('개인정보: 큰 글자 설정은 본인이 변경', a.from('user_private').update({ large_text: true }).eq('id', aid))
await expectOk('프로필: 이름 변경', a.from('users').update({ name: 'A엄마' }).eq('id', aid))
{
  const { data } = await b.from('users').select('id').eq('id', aid)
  expectEqual('프로필: 방을 함께 쓰기 전 B는 A 프로필을 못 봄', data?.length ?? 0, 0)
}

// ── 2. 방 만들기와 초대 전 비공개 추억 ───────────────────────────
const room = await expectOk('방: A가 앨범방 생성', a.from('rooms').insert({ name: '우리집', owner_id: aid }).select('id').single())
const R = room.id
const f = (name) => `${R}/${name}-${stamp}`

await expectOk('파일: A 사진 업로드(media)', put(a, 'media', f('p1.jpg'), 'image/jpeg'))
await expectOk('파일: A 영상 업로드(video)', put(a, 'video', f('v1.mp4'), 'video/mp4'))
await expectOk('파일: A 목소리 업로드(voice)', put(a, 'voice', f('s1.webm'), 'audio/webm'))
const m1 = await expectOk('추억: A 혼자일 때 사진+영상+목소리 저장', a.rpc('create_memory', {
  p_room_id: R, p_caption: '혼자 쓴 추억', p_photo_paths: [f('p1.jpg')],
  p_voice_path: f('s1.webm'), p_voice_duration_sec: 0, p_video_path: f('v1.mp4'), p_video_duration_ms: 30000,
}))
{
  const { data } = await admin.from('memories').select('visibility').eq('id', m1).single()
  expectEqual('공개 범위: 혼자일 때 = private', data?.visibility, 'private')
}
await expectOk('파일: 영상만 담을 파일 업로드', put(a, 'video', f('v-only.webm'), 'video/webm'))
const mVideoOnly = await expectOk('추억: 영상 하나만으로 저장 가능', a.rpc('create_memory', {
  p_room_id: R, p_caption: '', p_photo_paths: [], p_video_path: f('v-only.webm'), p_video_duration_ms: 0,
}))

// 길이·쌍 제약
await expectOk('파일: 초과 영상 파일 업로드', put(a, 'video', f('v-long.mp4'), 'video/mp4'))
await expectError('제약: 영상 30.001초 거절', a.rpc('create_memory', {
  p_room_id: R, p_caption: '', p_photo_paths: [], p_video_path: f('v-long.mp4'), p_video_duration_ms: 30001,
}), '23514')
await expectOk('파일: 초과 음성 파일 업로드', put(a, 'voice', f('s-long.webm'), 'audio/webm'))
await expectError('제약: 추억 음성 61초 거절', a.rpc('create_memory', {
  p_room_id: R, p_caption: '', p_photo_paths: [], p_voice_path: f('s-long.webm'), p_voice_duration_sec: 61,
}), '23514')
await expectOk('제약: 추억 음성 60초 허용', a.rpc('create_memory', {
  p_room_id: R, p_caption: '', p_photo_paths: [], p_voice_path: f('s-long.webm'), p_voice_duration_sec: 60,
}))
await expectError('제약: 아무것도 없는 추억 거절', a.rpc('create_memory', { p_room_id: R, p_caption: '글만', p_photo_paths: [] }), '23514')
await expectError('Storage: 50MB 초과 영상 업로드 거절', put(a, 'video', f('big.mp4'), 'video/mp4', 50 * 1024 * 1024 + 1))
await expectError('Storage: 영상 버킷에 허용하지 않은 형식 거절', put(a, 'video', f('x.avi'), 'video/x-msvideo'))
{
  // 트리거가 입력값을 무시하는지 — 혼자인데 room 으로 넣어도 private
  await put(a, 'media', f('p-force.jpg'), 'image/jpeg')
  const { data } = await a.from('memories').insert({ room_id: R, author_id: aid, visibility: 'room', description: '강제' }).select('id, visibility').single()
  expectEqual('공개 범위: 입력한 room 을 무시하고 private', data?.visibility, 'private')
  const { data: upd } = await a.from('memories').update({ visibility: 'room' }).eq('id', data.id).select('visibility').single()
  // 2026-09-28 사용자 결정으로 바뀐 규칙: 작성자는 저장 뒤 나만 보기를 공개로 열 수 있다(되돌리기는 6-2에서 막힘을 확인).
  expectEqual('공개 범위: 저장 뒤 작성자가 room 으로 여는 것은 허용(2026-09-28 결정)', upd?.visibility, 'room')
}

// ── 3. B 초대 → 공동 작성 ───────────────────────────────────────
const tokenB = `tok-b-${stamp}`
await expectOk('초대: A가 초대장 생성(자유 입력 호칭)', a.from('invitations').insert({ room_id: R, inviter_id: aid, relationship_label: '딸', invite_token: tokenB, invite_message: '들어와' }))
{
  const { data } = await anon.rpc('preview_invitation', { p_token: tokenB })
  expectEqual('초대: 로그인 전 미리보기(방 이름·호칭)', [data?.[0]?.room_name, data?.[0]?.relationship_label], ['우리집', '딸'])
}
await expectOk('초대: B가 초대 수락', b.rpc('accept_invitation', { p_token: tokenB }))
{
  const { data } = await b.from('memories').select('id').eq('id', m1)
  expectEqual('초대 전 비공개: B는 A의 혼자 쓴 추억 행을 못 봄', data?.length ?? 0, 0)
  const { data: ph } = await b.from('memory_photos').select('id').eq('memory_id', m1)
  expectEqual('초대 전 비공개: B는 그 사진 줄도 못 봄', ph?.length ?? 0, 0)
  expectEqual('초대 전 비공개: B는 그 영상 서명 불가', await canSign(b, 'video', f('v1.mp4')), false)
  expectEqual('초대 전 비공개: B는 그 사진 경로 직접 다운로드 불가', await canDownload(b, 'media', f('p1.jpg')), false)
  expectEqual('초대 전 비공개: B는 그 목소리 서명 불가', await canSign(b, 'voice', f('s1.webm')), false)
  expectEqual('초대 전 비공개: A 본인은 영상 서명 가능', await canSign(a, 'video', f('v1.mp4')), true)
}
{
  const { data } = await b.from('users').select('id, name').eq('id', aid)
  expectEqual('프로필: 같은 방이 된 B는 A 이름을 봄', data?.[0]?.name, 'A엄마')
  const { data: priv } = await b.from('user_private').select('id').eq('id', aid)
  expectEqual('개인정보: 같은 방이어도 B는 A의 user_private 못 봄', priv?.length ?? 0, 0)
}

await put(a, 'media', f('p2.jpg'), 'image/jpeg')
await put(a, 'video', f('v2.mp4'), 'video/mp4')
const m2 = await expectOk('추억: 둘일 때 A가 사진+영상 저장', a.rpc('create_memory', {
  p_room_id: R, p_caption: '함께 쓴 추억', p_photo_paths: [f('p2.jpg')], p_video_path: f('v2.mp4'), p_video_duration_ms: 12000,
}))
{
  const { data } = await admin.from('memories').select('visibility').eq('id', m2).single()
  expectEqual('공개 범위: 둘일 때 = room', data?.visibility, 'room')
  const { data: rows } = await b.from('memories').select('id, video_path').eq('id', m2)
  expectEqual('공동 작성: B가 공유 추억을 읽음', rows?.length ?? 0, 1)
  expectEqual('공동 작성: B가 공유 영상 서명', await canSign(b, 'video', f('v2.mp4')), true)
  expectEqual('공동 작성: B가 공유 사진 다운로드', await canDownload(b, 'media', f('p2.jpg')), true)
}
await put(b, 'media', f('pb.jpg'), 'image/jpeg')
const mB = await expectOk('공동 작성: B도 추억 저장(room)', b.rpc('create_memory', { p_room_id: R, p_caption: 'B의 글', p_photo_paths: [f('pb.jpg')] }))
await expectError('소유 검사: B가 A의 비공개 사진 경로를 자기 추억에 붙이기 거절', b.rpc('create_memory', { p_room_id: R, p_caption: '', p_photo_paths: [f('p1.jpg')] }), '23514')
await expectError('소유 검사: B가 A의 비공개 영상 경로 붙이기 거절', b.rpc('create_memory', { p_room_id: R, p_caption: '', p_photo_paths: [], p_video_path: f('v1.mp4'), p_video_duration_ms: 1000 }), '23514')

// 댓글·반응·알림
await expectOk('댓글: B 텍스트 댓글', b.from('memory_comments').insert({ memory_id: m2, author_id: bid, body: '좋아요' }))
await expectOk('파일: B 댓글 음성 업로드', put(b, 'voice', f('cb.webm'), 'audio/webm'))
await expectOk('댓글: B 음성 댓글 0초 허용', b.from('memory_comments').insert({ memory_id: m2, author_id: bid, voice_path: f('cb.webm'), voice_duration_sec: 0 }))
await put(b, 'voice', f('cb-long.webm'), 'audio/webm')
await expectError('제약: 댓글 음성 61초 거절', b.from('memory_comments').insert({ memory_id: m2, author_id: bid, voice_path: f('cb-long.webm'), voice_duration_sec: 61 }), '23514')
await expectError('댓글: B는 A 비공개 추억에 댓글 불가', b.from('memory_comments').insert({ memory_id: m1, author_id: bid, body: '몰래' }))
await expectOk('반응: B가 공유 추억에 좋아요', b.from('memory_likes').insert({ memory_id: m2, user_id: bid }))
await expectOk('반응: A가 자기 추억에 좋아요(자기 반응 허용)', a.from('memory_likes').insert({ memory_id: m2, user_id: aid }))
await expectOk('반응: A가 자기 비공개 추억에 좋아요', a.from('memory_likes').insert({ memory_id: m1, user_id: aid }))
await expectError('반응: B는 A 비공개 추억에 좋아요 불가', b.from('memory_likes').insert({ memory_id: m1, user_id: bid }))
{
  const { data } = await b.from('memory_likes').select('id').eq('memory_id', m1)
  expectEqual('반응: B는 비공개 추억의 반응 목록도 못 봄', data?.length ?? 0, 0)
  const { data: nb } = await b.from('notifications').select('type, memory_id')
  const types = (nb ?? []).map((n) => `${n.type}:${n.memory_id === m2 ? 'm2' : n.memory_id === m1 ? 'm1' : n.memory_id ?? '-'}`).sort()
  record('알림: B는 공유 추억 알림만 받고 비공개 추억 알림은 없음', types.includes('memory_created:m2') && !types.some((t) => t.endsWith(':m1')), types.join(', '))
  const { data: na } = await a.from('notifications').select('type')
  record('알림: A는 댓글 알림을 받음', (na ?? []).some((n) => n.type === 'comment_created'), (na ?? []).map((n) => n.type).join(', '))
}
{
  const { error } = await b.rpc('pin_memory', { p_memory_id: m1, p_pinned: true })
  record('고정: B는 A 비공개 추억을 고정 불가', Boolean(error), error?.message ?? '고정됨')
}

// ── 4. 사서함 ────────────────────────────────────────────────
await expectOk('사서함: A 목소리 업로드', put(a, 'voice', f('h1.webm'), 'audio/webm'))
const heart = await expectOk('사서함: A→B 목소리 0초 허용', a.from('heart_messages').insert({ room_id: R, sender_id: aid, receiver_id: bid, type: 'voice', content: f('h1.webm'), duration_sec: 0 }).select('id').single())
await put(a, 'voice', f('h2.webm'), 'audio/webm')
await expectError('사서함: 음성 61초 거절', a.from('heart_messages').insert({ room_id: R, sender_id: aid, receiver_id: bid, type: 'voice', content: f('h2.webm'), duration_sec: 61 }), '23514')
await expectError('사서함: 영상 메시지 작성 거절(범위 밖)', a.from('heart_messages').insert({ room_id: R, sender_id: aid, receiver_id: bid, type: 'video', content: f('v2.mp4'), duration_sec: 3 }), '23514')
await expectOk('사서함: A→B 문자', a.from('heart_messages').insert({ room_id: R, sender_id: aid, receiver_id: bid, type: 'text', content: '사랑해' }))
await expectError('사서함: 받는 사람이 못 읽는 비공개 추억을 붙이기 거절', a.from('heart_messages').insert({ room_id: R, sender_id: aid, receiver_id: bid, type: 'text', content: '이거 봐', memory_id: m1 }))
expectEqual('사서함: B가 받은 목소리 서명', await canSign(b, 'voice', f('h1.webm')), true)
{
  const { data } = await b.rpc('mark_heart_read', { p_id: heart.id })
  expectEqual('사서함: 들음 표시(답장 잠금 없음)', data, true)
}

// ── 5. C는 나중에 들어온다 ─────────────────────────────────────
expectEqual('비참여자: C는 공유 영상 서명 불가', await canSign(c, 'video', f('v2.mp4')), false)
expectEqual('비참여자: C는 사서함 목소리 서명 불가', await canSign(c, 'voice', f('h1.webm')), false)
expectEqual('익명: 공유 영상 서명 불가', await canSign(anon, 'video', f('v2.mp4')), false)
expectEqual('익명: 공유 사진 직접 다운로드 불가', await canDownload(anon, 'media', f('p2.jpg')), false)
{
  const { data } = await anon.from('memories').select('id')
  expectEqual('익명: 추억 행 0개', data?.length ?? 0, 0)
  const { data: u } = await anon.from('users').select('id')
  expectEqual('익명: 프로필 0개', u?.length ?? 0, 0)
}
const tokenC = `tok-c-${stamp}`
await a.from('invitations').insert({ room_id: R, inviter_id: aid, relationship_label: '아들', invite_token: tokenC, invite_message: '어서' })
await expectOk('초대: C 수락', c.rpc('accept_invitation', { p_token: tokenC }))
{
  const { data } = await c.from('memories').select('id').in('id', [m1, m2, mB, mVideoOnly])
  const ids = (data ?? []).map((r) => r.id)
  record('새 참여자: C는 공유 시기 추억(m2·B의 글)을 읽음', ids.includes(m2) && ids.includes(mB), `${ids.length}개`)
  record('새 참여자: C는 A 혼자 시기 추억(m1·영상만)을 못 읽음', !ids.includes(m1) && !ids.includes(mVideoOnly))
  expectEqual('새 참여자: C는 공유 영상 서명', await canSign(c, 'video', f('v2.mp4')), true)
  expectEqual('새 참여자: C는 비공개 영상 서명 불가', await canSign(c, 'video', f('v-only.webm')), false)
  expectEqual('사서함: C는 A→B 목소리 서명 불가', await canSign(c, 'voice', f('h1.webm')), false)
}

// ── 6. 떠난 참여자와 다시 혼자 ─────────────────────────────────
await expectOk('나가기: B 떠남', b.from('room_members').update({ status: 'left', left_at: new Date().toISOString() }).eq('room_id', R).eq('user_id', bid))
{
  const { data } = await b.from('memories').select('id').eq('id', m2)
  expectEqual('떠난 참여자: B는 공유 추억도 못 읽음', data?.length ?? 0, 0)
  expectEqual('떠난 참여자: B는 공유 영상 새 서명 불가', await canSign(b, 'video', f('v2.mp4')), false)
  expectEqual('떠난 참여자: B는 자기가 올린 사진은 여전히 읽음(본인 파일)', await canSign(b, 'media', f('pb.jpg')), true)
}
await expectOk('나가기: C 떠남', c.from('room_members').update({ status: 'left', left_at: new Date().toISOString() }).eq('room_id', R).eq('user_id', cid))
await put(a, 'video', f('v3.mp4'), 'video/mp4')
const m3 = await expectOk('다시 혼자: A가 추억 저장', a.rpc('create_memory', { p_room_id: R, p_caption: '다시 혼자', p_photo_paths: [], p_video_path: f('v3.mp4'), p_video_duration_ms: 5000 }))
{
  const { data } = await admin.from('memories').select('visibility').eq('id', m3).single()
  expectEqual('공개 범위: 다시 혼자일 때 = private', data?.visibility, 'private')
}
const tokenB2 = `tok-b2-${stamp}`
await a.from('invitations').insert({ room_id: R, inviter_id: aid, relationship_label: '딸', invite_token: tokenB2, invite_message: '다시' })
await expectOk('재입장: B 다시 수락', b.rpc('accept_invitation', { p_token: tokenB2 }))
{
  const { data } = await b.from('memories').select('id').in('id', [m2, m3])
  const ids = (data ?? []).map((r) => r.id)
  record('재입장: B는 공유 추억 m2 읽음', ids.includes(m2))
  record('재입장: B는 다시 혼자 시기 추억 m3 못 읽음', !ids.includes(m3))
  expectEqual('재입장: B는 m3 영상 서명 불가', await canSign(b, 'video', f('v3.mp4')), false)
}

// 위젯: 남의 글은 방 공유 추억만 뜬다. 지금 방에는 A의 비공개 추억(m1·m3·영상만)과 공유 추억(m2·B의 글)이 있다.
{
  const { data: tokenA } = await a.rpc('issue_widget_token')
  const { data: latest } = await anon.rpc('widget_latest', { p_token: tokenA })
  record('위젯: A의 위젯에는 B의 공유 추억이 뜸(남의 글 우선)', latest?.[0]?.memory_id === mB, latest?.[0]?.memory_id ?? '없음')
  const { data: tokenB } = await b.rpc('issue_widget_token')
  const { data: latestB } = await anon.rpc('widget_latest', { p_token: tokenB })
  const got = latestB?.[0]?.memory_id
  // A의 글 중 B가 읽을 수 있는 최신 글은 공유 추억 m2 뿐이다(나머지 A의 글은 모두 private).
  record('위젯: B의 위젯에는 A의 비공개 추억이 아니라 공유 추억 m2가 뜸', got === m2, got ?? '없음')
  await expectError('위젯: 무효 토큰은 28000', anon.rpc('widget_latest', { p_token: 'nope' }), '28000')
}

// ── 6-2. 나만 보기 → 공개 (2026-09-28 사용자 결정) ───────────────
// 지금 A의 비공개 추억: m1(첫 혼자)·mVideoOnly·m3(다시 혼자). B는 재입장한 활성 참여자.
await expectError('공개로: B는 A의 비공개 추억을 공개로 못 바꿈(읽지도 못함)', b.rpc('publish_memories', { p_memory_ids: [m3] }), '42501')
await expectError('공개로: 남의 글이 하나라도 섞이면 전부 거절', a.rpc('publish_memories', { p_memory_ids: [m3, mB] }), '42501')
{
  const { data } = await admin.from('memories').select('visibility').eq('id', m3).single()
  expectEqual('공개로: 거절되면 아무것도 바뀌지 않음(m3 그대로 private)', data?.visibility, 'private')
}
{
  const r = await b.from('memories').update({ visibility: 'room' }).eq('id', m3).select('id')
  expectEqual('공개로: B가 직접 UPDATE 해도 0행(RLS)', (r.data ?? []).length, 0)
}
{
  const n = await expectOk('공개로: A가 m3·mVideoOnly 두 개를 한꺼번에 공개', a.rpc('publish_memories', { p_memory_ids: [m3, mVideoOnly] }))
  expectEqual('공개로: 바꾼 개수 2', n, 2)
  const { data } = await b.from('memories').select('id').in('id', [m3, mVideoOnly])
  expectEqual('공개로: 이제 B가 두 추억을 읽음', (data ?? []).length, 2)
  expectEqual('공개로: B가 m3 영상 서명 가능', await canSign(b, 'video', f('v3.mp4')), true)
  const again = await expectOk('공개로: 이미 공개인 글을 다시 보내면 0개(건너뜀)', a.rpc('publish_memories', { p_memory_ids: [m3] }))
  expectEqual('공개로: 다시 보낸 결과 0', again, 0)
}
{
  await a.from('memories').update({ visibility: 'private' }).eq('id', m3)
  const { data } = await admin.from('memories').select('visibility').eq('id', m3).single()
  expectEqual('공개로: 공개 → 나만 보기 되돌리기는 막힘(room 유지)', data?.visibility, 'room')
  const { data: n } = await admin.from('notifications').select('id').eq('memory_id', m3)
  expectEqual('공개로: 공개로 바꿔도 알림은 만들지 않음', n?.length ?? 0, 0)
}
{
  const { data } = await admin.from('memories').select('visibility').eq('id', m1).single()
  expectEqual('공개로: 고르지 않은 m1은 그대로 private', data?.visibility, 'private')
}

// ── 7. 삭제 ───────────────────────────────────────────────────
await expectError('삭제: B는 A의 추억 삭제 불가', b.rpc('delete_memory', { p_memory_id: m2 }), '42501')
await expectError('삭제: 직접 DELETE 는 정책이 없어 0행(=막힘)', (async () => {
  const r = await a.from('memories').delete().eq('id', m2).select('id')
  return { error: (r.data ?? []).length === 0 ? { code: 'blocked', message: '0행' } : null }
})())
const jobs = await expectOk('삭제: A가 공유 추억 m2 삭제(DB)', a.rpc('delete_memory', { p_memory_id: m2 }))
{
  const names = (jobs ?? []).map((j) => `${j.bucket_id}:${j.object_name.split('/').pop()}`)
  record('삭제: 정리 목록에 사진·영상·B의 댓글 음성까지 포함',
    names.some((n) => n.startsWith('media:p2')) && names.some((n) => n.startsWith('video:v2')) && names.some((n) => n.startsWith('voice:cb')),
    names.join(', '))
  const { data: left } = await admin.from('memories').select('id').eq('id', m2)
  const { data: cm } = await admin.from('memory_comments').select('id').eq('memory_id', m2)
  const { data: lk } = await admin.from('memory_likes').select('id').eq('memory_id', m2)
  const { data: nt } = await admin.from('notifications').select('id').eq('memory_id', m2)
  expectEqual('삭제: 추억·댓글·반응·알림 행 모두 사라짐', [left?.length, cm?.length, lk?.length, nt?.length], [0, 0, 0, 0])
  expectEqual('삭제 직후(파일 정리 전): B는 영상 서명 불가', await canSign(b, 'video', f('v2.mp4')), false)
  expectEqual('삭제 직후(파일 정리 전): 올린 A도 영상 서명 불가', await canSign(a, 'video', f('v2.mp4')), false)
}
// 파일 정리 실패를 흉내낸다 — Storage 삭제를 하지 않고 확인만 부른다.
{
  const { data: leftCount } = await a.rpc('finish_storage_deletions', { p_error: '시험: Storage 삭제 실패 흉내' })
  record('삭제 실패: 파일이 남아 있으면 남은 개수를 돌려줌(성공 아님)', (leftCount ?? 0) > 0, `남은 파일 ${leftCount}`)
  expectEqual('삭제 실패 상태: 올린 A도 남은 영상 서명 불가', await canSign(a, 'video', f('v2.mp4')), false)
  expectEqual('삭제 실패 상태: B는 자기가 올린 댓글 음성도 서명 불가', await canSign(b, 'voice', f('cb.webm')), false)
  const { data: pending } = await a.rpc('pending_storage_deletions')
  record('삭제 실패: 정리 목록이 DB에 남아 재시도 가능', (pending ?? []).length > 0, `${(pending ?? []).length}개`)
  expectEqual('삭제 실패 상태: 파일은 아직 Storage에 있음', await exists('video', f('v2.mp4')), true)
}
// 재시도 — 실제 앱(settleStorageDeletions)과 같은 순서로 지운다.
{
  const { data: pending } = await a.rpc('pending_storage_deletions')
  const byBucket = new Map()
  for (const row of pending ?? []) byBucket.set(row.bucket_id, [...(byBucket.get(row.bucket_id) ?? []), row.object_name])
  for (const [bucket, paths] of byBucket) await a.storage.from(bucket).remove(paths)
  const { data: leftCount } = await a.rpc('finish_storage_deletions', {})
  expectEqual('삭제 재시도: 남은 파일 0', leftCount, 0)
  expectEqual('삭제 재시도: A의 영상 파일 사라짐', await exists('video', f('v2.mp4')), false)
  expectEqual('삭제 재시도: B가 올린 댓글 음성도 사라짐', await exists('voice', f('cb.webm')), false)
}
// 고치기: 영상 바꾸면 옛 영상은 정리 목록 → 삭제
{
  await put(a, 'video', f('v3b.mp4'), 'video/mp4')
  await expectOk('고치기: A가 m3 영상을 새 파일로 교체', a.rpc('update_memory', { p_memory_id: m3, p_caption: '바꿈', p_photo_paths: [], p_video_path: f('v3b.mp4'), p_video_duration_ms: 3000 }))
  const { data: pending } = await a.rpc('pending_storage_deletions')
  record('고치기: 옛 영상이 정리 목록에 오름', (pending ?? []).some((j) => j.object_name === f('v3.mp4')))
  await expectError('고치기: B는 A 추억 고치기 불가', b.rpc('update_memory', { p_memory_id: mB === null ? m3 : m3, p_caption: 'x', p_photo_paths: [], p_video_path: f('v3b.mp4'), p_video_duration_ms: 1 }), '42501')
}

// ── 8. 탈퇴 ───────────────────────────────────────────────────
{
  const { error } = await c.rpc('withdraw_account', { p_reason: '시험', p_detail: null })
  record('탈퇴: C 탈퇴', !error, error?.message ?? '')
  const { data } = await admin.from('user_private').select('id').eq('id', cid)
  expectEqual('탈퇴: C 개인정보 행 삭제', data?.length ?? 0, 0)
}

const failed = results.filter((r) => !r.pass)
console.log(`\n합계: ${results.length}건 중 PASS ${results.length - failed.length}, FAIL ${failed.length}`)
process.exit(failed.length > 0 ? 1 : 0)
