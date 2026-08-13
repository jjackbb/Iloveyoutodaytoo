/**
 * 초대 "받는 사람" 다루기 — 순수 함수와 타입만.
 *
 * 여기 있는 값은 **브라우저 밖으로 절대 나가지 않는다.**
 * 전화번호는 문자 앱을 여는 sms: 주소를 만드는 데만 쓰고, 서버로 보내지 않는다.
 * (개인정보 처리방침 제2조 7항과 같은 약속이다 — 문서와 코드가 어긋나면 안 된다.)
 *
 * 서버 전용 모듈을 하나도 부르지 않는다. 그래서 클라이언트 부품이 그냥 가져다 쓴다.
 */

import { nameMatchesQuery } from '@/lib/hangul'

/** 초대장 한 장을 받을 한 사람. 화면이 살아 있는 동안에만 존재한다. */
export type Recipient = {
  /** 목록에서 구분하기 위한 임시 id. 서버와는 아무 상관이 없다. */
  id: string
  /** 초대장의 호칭(relationship_label)이 될 이름. 비어 있을 수 없다. */
  name: string
  /** 문자 보내기에 쓸 번호. 연락처가 이름만 준 경우 등에는 없다. */
  phone: string | null
}

/** 호칭은 서버(createInvitation)와 같은 20자 제한을 따른다. */
export const MAX_NAME_LENGTH = 20

/**
 * 한 번에 고를 수 있는 사람 수.
 *
 * 확정하면 이 수만큼 초대장을 하나씩 만든다(호출 하나당 초대장 하나).
 * 너무 크면 만드는 데 오래 걸리고 결과 화면이 끝없이 길어진다.
 */
export const MAX_RECIPIENTS = 10

/* ------------------------------------------------------------------ *
 * 전화번호
 * ------------------------------------------------------------------ */

/**
 * 사람이 적은 번호를 sms: 주소에 넣을 수 있는 모양으로 다듬는다.
 * 못 알아보면 null(= 번호 없음)로 본다. 반쪽짜리 번호로 문자 앱을 열면
 * 엉뚱한 사람에게 초대 링크가 갈 수 있다.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null

  const trimmed = raw.trim()
  // 국가번호 +는 맨 앞에 있을 때만 살린다. 나머지 기호(-, 공백, 괄호)는 버린다.
  const plus = trimmed.startsWith('+') ? '+' : ''
  const digits = trimmed.replace(/\D/g, '')

  // 국내 번호는 짧아도 9자리(02-123-4567)다. 그보다 짧으면 번호가 아니다.
  if (digits.length < 9 || digits.length > 15) return null

  return `${plus}${digits}`
}

/** "01012345678" → "010-1234-5678". 못 알아보는 모양이면 있는 그대로 둔다. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (phone.startsWith('+')) return phone
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10 && digits.startsWith('02')) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

/* ------------------------------------------------------------------ *
 * 초성 검색
 * ------------------------------------------------------------------ */

/**
 * 검색칸에 친 글자와 맞는 사람인지.
 *
 * 세 갈래로 본다 — 이름 그대로("민수"), 이름 초성("ㄱㅁㅅ"), 번호 숫자("1234").
 * 시니어 사용자가 아무렇게나 쳐도 걸리도록 넉넉하게 잡는다.
 *
 * 이름 쪽 규칙은 @/lib/hangul 한 곳에 있다 — 마음 보내기 화면의 검색과
 * 같은 규칙이어야 같은 이름이 두 화면에서 똑같이 걸린다.
 */
export function matchesQuery(recipient: Recipient, rawQuery: string): boolean {
  const query = rawQuery.trim()
  if (!query) return true

  if (nameMatchesQuery(recipient.name, query)) return true

  const queryDigits = query.replace(/\D/g, '')
  if (queryDigits && recipient.phone) {
    return recipient.phone.replace(/\D/g, '').includes(queryDigits)
  }

  return false
}

/* ------------------------------------------------------------------ *
 * 문자 앱 열기
 * ------------------------------------------------------------------ */

/**
 * 문자 앱을 여는 주소.
 *
 * 서버가 문자를 대신 보내지 않는다(문자 발송 연동이 아직 없다). 대신 사용자의
 * 문자 앱을 열어 본문까지 채워준다. 보내기를 누르는 것은 사용자다.
 *
 * 구분자가 기기마다 다르다 — 애플은 `&body=`, 안드로이드는 `?body=`를 읽는다.
 * 하나로 통일하면 한쪽에서 본문이 통째로 사라진다.
 */
export function smsHref(phone: string, body: string): string {
  const separator = isAppleDevice() ? '&' : '?'
  return `sms:${phone}${separator}body=${encodeURIComponent(body)}`
}

function isAppleDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS 13+는 자신을 Macintosh라고 말한다. 그래서 터치 여부까지 같이 본다.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** 문자에 담을 본문. 첫 마디 + 링크. */
export function smsBody(message: string, url: string): string {
  return `${message}\n\n${url}`
}

/* ------------------------------------------------------------------ *
 * 연락처 고르기 (Contact Picker API)
 * ------------------------------------------------------------------ */

/** 브라우저가 돌려주는 연락처 한 건. 이름도 번호도 없을 수 있다. */
type PickedContact = { name?: string[]; tel?: string[] }

type ContactsManagerLike = {
  select(
    properties: string[],
    options?: { multiple?: boolean },
  ): Promise<PickedContact[]>
}

type NavigatorWithContacts = Navigator & { contacts?: ContactsManagerLike }

/**
 * 이 브라우저에서 연락처를 고를 수 있는지.
 *
 * Contact Picker API는 지금 안드로이드 크롬 계열에서만 된다. iOS 사파리·데스크톱에는
 * 아예 없다. 그래서 이 값이 false면 화면은 **손으로 적는 길**만 보여준다.
 * 없는 기능을 버튼으로 남겨두면 눌러도 아무 일이 없어 "고장 났다"로 읽힌다.
 */
export function supportsContactPicker(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    typeof window !== 'undefined' &&
    'ContactsManager' in window
  )
}

/** 화면 안에서만 쓰는 임시 id. */
export function makeRecipientId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `r-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * 휴대폰 연락처 창을 열어 고른 사람들을 돌려준다.
 *
 * 고른 값은 **여기서 곧바로 화면 상태로만 들어간다.** 저장하지도, 서버로 보내지도 않는다.
 * 사용자가 창을 그냥 닫으면 빈 배열이다(오류가 아니다).
 */
export async function pickFromContacts(): Promise<Recipient[]> {
  const manager = (navigator as NavigatorWithContacts).contacts
  if (!manager) return []

  const picked = await manager.select(['name', 'tel'], { multiple: true })

  return picked
    .map((contact) => {
      const name = contact.name?.find((value) => value.trim())?.trim() ?? ''
      const phone = contact.tel
        ?.map((value) => normalizePhone(value))
        .find((value): value is string => Boolean(value)) ?? null

      return { name, phone }
    })
    // 이름도 번호도 없는 건 초대장을 만들 수 없다. 조용히 뺀다.
    .filter((contact) => contact.name || contact.phone)
    .map((contact) => ({
      id: makeRecipientId(),
      // 이름을 안 준 연락처는 번호 뒷자리로 부른다. 호칭이 비면 초대장을 만들 수 없고,
      // 받는 분 화면("○○님을 초대했어요")과 방 구성원 호칭이 통째로 빈칸이 된다.
      name: contact.name || fallbackNameFromPhone(contact.phone),
      phone: contact.phone,
    }))
}

/** "010-1234-5678" → "5678님". 이름을 모를 때만 쓴다. */
export function fallbackNameFromPhone(phone: string | null): string {
  const digits = phone?.replace(/\D/g, '') ?? ''
  return digits ? `${digits.slice(-4)}` : '이름 모를 분'
}

/** 같은 사람을 두 번 넣지 않는다. 번호가 있으면 번호로, 없으면 이름으로 본다. */
export function isSameRecipient(a: Recipient, b: Recipient): boolean {
  if (a.phone && b.phone) return a.phone === b.phone
  if (!a.phone && !b.phone) return a.name === b.name
  return false
}
