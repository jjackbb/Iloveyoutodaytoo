'use server'

import { randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { toDataURL } from 'qrcode'

import { requireUser, getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * 초대 만들기 / 초대 받기.
 *
 * 규칙 두 가지를 지킨다(작업 지시).
 *  1. invitations 테이블을 토큰으로 직접 조회하지 않는다.
 *     초대장 미리보기는 DB 함수 preview_invitation(p_token),
 *     입장은 accept_invitation(p_token, p_label)만 쓴다.
 *  2. 차단 관계 확인은 accept_invitation 안에 이미 들어 있다. 여기서 또 하지 않는다.
 */

/** 초대장 유효 기간. 30일. */
const EXPIRES_IN_DAYS = 30

const MAX_LABEL_LENGTH = 20
const MAX_MESSAGE_LENGTH = 300

/** 화면에 초대장을 보여주는 데 필요한 값 한 묶음. */
export type InviteView = {
  /** 링크·QR에 들어가는 토큰 */
  token: string
  /** 상대가 열게 될 절대 주소. 예: https://... /invite/{token} */
  url: string
  /** QR 코드 이미지(data URL). <img src=...>에 그대로 넣는다. */
  qrDataUrl: string
  /** 초대할 사람과의 호칭. 예: "엄마" */
  relationshipLabel: string
  /** 초대자가 남긴 첫 메시지 */
  inviteMessage: string
  /** 만료 시각(UTC ISO). 없으면 만료 없음. */
  expiresAt: string | null
  createdAt: string
}

export type CreateInviteState =
  { ok: true; invitation: InviteView } | { ok: false; error: string } | null

export type AcceptInviteState = { error: string } | null

/**
 * 지금 요청이 들어온 주소의 origin. 예: "https://oneuldo.app"
 *
 * 초대 링크는 문자·카카오톡으로 밖에 나가므로 반드시 절대 주소여야 한다.
 * 로컬(localhost)·미리보기·운영 도메인이 모두 달라서 환경변수로 못 박지 않고
 * 요청 헤더에서 그때그때 읽는다.
 */
async function requestOrigin(): Promise<string> {
  const headerList = await headers()

  // 프록시를 거치면 원래 주소가 x-forwarded-* 에 담긴다. 값이 여러 개면 맨 앞이 원본이다.
  const first = (value: string | null) => value?.split(',')[0]?.trim() || null

  const host =
    first(headerList.get('x-forwarded-host')) ?? first(headerList.get('host'))

  if (!host) {
    // 헤더가 없는 예외 상황. 배포 환경 변수라도 있으면 그걸 쓴다.
    const fallbackHost =
      process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
    return fallbackHost ? `https://${fallbackHost}` : ''
  }

  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const protocol =
    first(headerList.get('x-forwarded-proto')) ?? (isLocal ? 'http' : 'https')

  return `${protocol}://${host}`
}

/**
 * QR 코드 이미지(data URL). 서버에서 만들어 <img>로 바로 보여준다.
 *
 * residue-scan-allow: hardcoded-color — QR은 디자인 요소가 아니라 기계가 읽는 그림이다.
 * 대비가 높을수록 인식률이 좋아서 토큰 색을 쓰지 않는다.
 */
async function toQrDataUrl(url: string): Promise<string> {
  return toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    // 대비를 위해 거의 검정으로. 인쇄하거나 화면을 찍어도 잘 읽힌다.
    color: { dark: '#111111', light: '#ffffff' },
  })
}

type InvitationRow = {
  invite_token: string
  relationship_label: string
  invite_message: string
  expires_at: string | null
  created_at: string
}

async function toInviteView(
  row: InvitationRow,
  origin: string,
): Promise<InviteView> {
  const url = `${origin}/invite/${row.invite_token}`

  return {
    token: row.invite_token,
    url,
    qrDataUrl: await toQrDataUrl(url),
    relationshipLabel: row.relationship_label,
    inviteMessage: row.invite_message,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  const time = Date.parse(expiresAt)
  return Number.isNaN(time) ? false : time < Date.now()
}

/**
 * 한 화면에 링크·QR까지 펼쳐 보여줄 초대장 수.
 *
 * 여러 분을 한 번에 부르면 초대장도 그만큼 생긴다. 이보다 많아지면 화면이 끝없이
 * 길어져 시니어 사용자가 자기 것을 못 찾는다. 넘치는 것은 아래 "만들어 둔 초대장"
 * 목록에서 확인·취소할 수 있다.
 */
const ALIVE_LIMIT = 12

/**
 * 이 방에 내가 만들어 둔 초대장 중 **아직 살아 있는** 것들. 최근 것이 먼저 온다.
 *
 * 화면이 이 값 하나만 보고 결과를 그린다. 그래서 두 가지가 저절로 맞는다.
 *  - 새로고침해도 방금 만든 링크·QR이 그대로 남는다.
 *  - 아래 목록에서 초대장을 취소하면 위 결과 줄도 함께 사라진다.
 *    (예전에는 "방금 만든 것"을 화면이 따로 들고 있어서, 취소한 뒤에도 죽은 링크가
 *     남아 있었다. 사용자는 이미 닫힌 링크를 복사해 보내게 된다.)
 *
 * "살아 있다"에는 used_at이 비어 있다는 조건도 들어간다. 초대 링크는 1회용이라
 * 한 번 쓰이면 accept_invitation이 used_at을 채우고, 그 뒤로는 다른 사람이
 * 아무리 눌러도 "이미 사용된 초대입니다" 예외만 돌아온다.
 */
export async function loadMyAliveInvitations(
  roomId: string,
): Promise<InviteView[]> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invitations')
    .select(
      'invite_token, relationship_label, invite_message, expires_at, created_at, used_at',
    )
    .eq('room_id', roomId)
    .eq('inviter_id', user.id)
    // 이미 쓰인 링크는 아예 빼고 가져온다. 가져온 뒤에 걸러내면, 방금 쓰인 초대장
    // 때문에 아직 멀쩡한 예전 링크까지 화면에서 밀려난다.
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(ALIVE_LIMIT)

  if (error) {
    // 화면은 "초대장 만들기"부터 보여주면 되지만, 원인은 로그에 남겨야 고칠 수 있다.
    console.error('[초대장 불러오기] invitations select 실패:', error.message)
    return []
  }

  if (!data || data.length === 0) return []

  const origin = await requestOrigin()

  // 주소를 못 만들면 링크·QR이 엉뚱하게 나온다. 차라리 안 보여주고 다시 만들게 한다.
  if (!origin) {
    console.error('[초대장 불러오기] 요청 주소(origin)를 알 수 없음')
    return []
  }

  const alive = data.filter((row) => !row.used_at && !isExpired(row.expires_at))

  return Promise.all(alive.map((row) => toInviteView(row, origin)))
}

/**
 * 초대장 만들기.
 *
 * invite_token은 서버에서만 만든다. 브라우저에서 넘어온 값은 절대 쓰지 않는다.
 * crypto.randomUUID()는 예측할 수 없는 난수라 링크를 찍어서 맞히는 게 사실상 불가능하다.
 */
export async function createInvitation(
  _prev: CreateInviteState,
  formData: FormData,
): Promise<CreateInviteState> {
  const roomId = String(formData.get('room_id') ?? '').trim()
  const label = String(formData.get('relationship_label') ?? '').trim()
  const message = String(formData.get('invite_message') ?? '').trim()

  if (!roomId) {
    return {
      ok: false,
      error: '어느 방으로 초대할지 알 수 없어요. 화면을 새로고침해 주세요.',
    }
  }
  if (!label) {
    return {
      ok: false,
      error: '초대할 분을 어떻게 부를지 적어주세요. 예) 엄마',
    }
  }
  if (label.length > MAX_LABEL_LENGTH) {
    return {
      ok: false,
      error: `호칭은 ${MAX_LABEL_LENGTH}자까지 쓸 수 있어요.`,
    }
  }
  if (!message) {
    return { ok: false, error: '초대장에 담을 첫 마디를 한 줄만 적어주세요.' }
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `첫 마디는 ${MAX_MESSAGE_LENGTH}자까지 쓸 수 있어요.`,
    }
  }

  const user = await requireUser()

  // 링크 주소를 못 만들 상황이면 초대장을 만들기 전에 멈춘다.
  // 행을 넣은 뒤에 알아채면 "/invite/토큰" 같은 반쪽짜리 주소가 QR에 박혀
  // 사용자가 깨진 링크인 줄도 모르고 보내게 된다.
  const origin = await requestOrigin()
  if (!origin) {
    console.error(
      '[초대장 만들기] 요청 주소(origin)를 알 수 없어 링크를 만들 수 없음',
    )
    return {
      ok: false,
      error: '초대 링크 주소를 만들지 못했어요. 잠시 후 다시 눌러주세요.',
    }
  }

  const supabase = await createClient()

  const expiresAt = new Date(
    Date.now() + EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()

  const { data, error } = await supabase
    .from('invitations')
    .insert({
      room_id: roomId,
      inviter_id: user.id,
      relationship_label: label,
      invite_message: message,
      invite_token: randomUUID(),
      expires_at: expiresAt,
    })
    .select(
      'invite_token, relationship_label, invite_message, expires_at, created_at',
    )
    .single()

  if (error || !data) {
    // 사용자에게는 부드럽게 안내하되, 원인은 서버 로그에 남긴다. 조용히 삼키면 고칠 수가 없다.
    console.error(
      '[초대장 만들기] invitations insert 실패:',
      error?.message ?? '반환된 초대장이 없음',
    )
    return {
      ok: false,
      error: '초대장을 만들지 못했어요. 잠시 후 다시 눌러주세요.',
    }
  }

  // 이 화면은 초대장을 두 곳에서 보여준다 — 위쪽 QR 패널과 아래쪽 대기 목록.
  // 무효화하지 않으면 방금 만든 초대장이 목록에 나타나지 않아
  // "만들었는데 목록에 없다 → 실패했나?" 하고 한 번 더 만들게 된다.
  // 패널이 서버가 아는 최신 초대장과 어긋났는지 판단하려면 이 갱신이 선행돼야 한다.
  revalidatePath(`/rooms/${roomId}/invite`)

  return { ok: true, invitation: await toInviteView(data, origin) }
}

/** DB 함수가 던지는 메시지를 사용자에게 보여줄 문장으로 바꾼다. */
function friendlyAcceptError(message: string): string {
  if (message.includes('로그인')) {
    return '로그인이 풀렸어요. 다시 로그인한 뒤에 들어와 주세요.'
  }
  if (message.includes('만료')) {
    return '이 초대장은 쓸 수 있는 기간이 지났어요. 초대해 주신 분께 새 링크를 부탁해 보세요.'
  }
  if (message.includes('유효하지')) {
    return '초대장을 찾지 못했어요. 링크가 온전히 복사됐는지 확인해 주세요.'
  }
  // '이미 사용된 초대입니다…'가 아래 '사용할 수 없' 분기에 걸리지 않도록 먼저 본다.
  // 1회용 링크라 다시 눌러도 영영 열리지 않는다 — "잠시 후 다시"라고 하면 거짓말이 된다.
  if (message.includes('이미 사용')) {
    return '이 초대장은 이미 사용됐어요. 초대해 주신 분께 새 링크를 부탁해 보세요.'
  }
  if (message.includes('사용할 수 없')) {
    return '지금은 이 초대장으로 들어갈 수 없어요. 초대해 주신 분께 확인을 부탁드려요.'
  }
  return '들어가는 중에 문제가 생겼어요. 잠시 후 다시 눌러주세요.'
}

/**
 * 초대 수락.
 *
 * 방 구성원 등록, 만료 확인, 차단 관계 확인은 전부 accept_invitation 안에서 한다.
 * 여기서는 로그인 여부만 미리 보고, 결과에 따라 방으로 보낸다.
 */
export async function acceptInvitation(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const token = String(formData.get('token') ?? '').trim()
  const rawLabel = String(formData.get('label') ?? '').trim()

  if (!token) {
    return { error: '초대장 정보를 읽지 못했어요. 링크를 다시 열어주세요.' }
  }
  if (rawLabel.length > MAX_LABEL_LENGTH) {
    return { error: `호칭은 ${MAX_LABEL_LENGTH}자까지 쓸 수 있어요.` }
  }

  const user = await getCurrentUser()
  if (!user) {
    // 로그인 화면을 거친 뒤 이 초대장으로 다시 돌아오게 한다.
    redirect(`/login?next=/invite/${encodeURIComponent(token)}`)
  }

  const supabase = await createClient()

  const { data: roomMemberId, error } = await supabase.rpc(
    'accept_invitation',
    {
      p_token: token,
      // 비워두면 DB가 초대자가 정한 호칭을 그대로 쓴다.
      ...(rawLabel ? { p_label: rawLabel } : {}),
    },
  )

  if (error) {
    // 토큰은 남기지 않는다(로그에 초대 링크가 새어 나가면 안 된다).
    console.error('[초대 수락] accept_invitation 실패:', error.message)
    return { error: friendlyAcceptError(error.message ?? '') }
  }
  if (!roomMemberId) {
    console.error('[초대 수락] accept_invitation이 구성원 id를 돌려주지 않음')
    return { error: '들어가는 중에 문제가 생겼어요. 잠시 후 다시 눌러주세요.' }
  }

  // 어느 방에 들어갔는지 알아내서 그 방으로 보낸다.
  const { data: member } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('id', roomMemberId)
    .maybeSingle()

  // 홈의 관계방 목록이 새 방을 바로 보여주도록 캐시를 비운다.
  revalidatePath('/', 'layout')

  redirect(member?.room_id ? `/rooms/${member.room_id}` : '/')
}
