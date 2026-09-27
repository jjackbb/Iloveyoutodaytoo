/* 로컬 앱 화면 검사용 시험 데이터(2026-09-28). 로컬 Supabase에만 넣는다. 키는 출력하지 않는다.
   실행(frontend에서, supabase db reset 직후): SUPABASE_BIN=<supabase 경로> ONEULDO_APP_TEST_DIR=<임시 폴더> node supabase/tests/local-app-seed.mjs
   엄마(uimom)가 혼자일 때 나만 보기 추억 3개 → 지우(uijiwoo) 입장 → 공유 추억 2개(엄마 1·지우 1). */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import zlib from 'node:zlib'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(execFileSync(process.env.SUPABASE_BIN, ['status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(env.API_URL ?? '')) { console.error('로컬 아님'); process.exit(2) }
const SP = process.env.ONEULDO_APP_TEST_DIR || '/tmp/oneuldo-app-test'
fs.mkdirSync(SP, { recursive: true })
// 4:3 단색 PNG 두 장(사진 자리 채우기용).
function png(w, h, rgb, file) {
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())])
  const raw = Buffer.concat(Array.from({ length: h }, () => row))
  const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2
  fs.writeFileSync(`${SP}/${file}`, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
}
png(400, 300, [214, 196, 170], 'p-warm.png')
png(400, 300, [170, 190, 205], 'p-cool.png')
async function signUp(username) {
  const client = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signUp({ email: `${username}@id.oneuldo.local`, password: 'test-password-1234', options: { data: { name: username === 'uimom' ? '엄마' : '지우', username, birth_date: '1970-05-01', auth_provider: 'email' } } })
  if (error) throw error
  return { client, id: data.user.id }
}
const A = await signUp('uimom')
const B = await signUp('uijiwoo')
const { data: room, error: re } = await A.client.from('rooms').insert({ name: '우리 앨범방', owner_id: A.id }).select('id').single()
if (re) throw re
const R = room.id
async function photo(client, name, file) {
  const path = `${R}/${name}.png`
  const { error } = await client.storage.from('media').upload(path, fs.readFileSync(`${SP}/${file}`), { contentType: 'image/png' })
  if (error) throw error
  return path
}
const p1 = await photo(A.client, 'alone1', 'p-warm.png')
await A.client.rpc('create_memory', { p_room_id: R, p_caption: '혼자 적어 둔 첫 기록. 언젠가 보여주고 싶어.', p_photo_paths: [p1] })
const p1b = await photo(A.client, 'alone2', 'p-warm.png')
await A.client.rpc('create_memory', { p_room_id: R, p_caption: '오늘은 그냥 고마웠다는 말을 남겨 둔다.', p_photo_paths: [p1b] })
const p1c = await photo(A.client, 'alone3', 'p-cool.png')
await A.client.rpc('create_memory', { p_room_id: R, p_caption: '세 번째 혼자 기록.', p_photo_paths: [p1c] })
const token = `ui-${Date.now()}`
await A.client.from('invitations').insert({ room_id: R, inviter_id: A.id, relationship_label: '딸', invite_token: token, invite_message: '들어와' })
const { error: ae } = await B.client.rpc('accept_invitation', { p_token: token })
if (ae) throw ae
const p2 = await photo(A.client, 'shared1', 'p-cool.png')
await A.client.rpc('create_memory', { p_room_id: R, p_caption: '같이 본 바다, 또 가자.', p_photo_paths: [p2] })
const pb = await photo(B.client, 'fromb', 'p-warm.png')
await B.client.rpc('create_memory', { p_room_id: R, p_caption: '엄마 오늘도 고마워요.', p_photo_paths: [pb] })
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: rows } = await admin.from('memories').select('description, visibility').eq('room_id', R).order('created_at')
console.log(JSON.stringify({ room: R, rows }))
fs.writeFileSync(`${SP}/seed-room.txt`, R)
