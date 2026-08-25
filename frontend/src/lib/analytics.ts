/**
 * GA4 계측 — 이벤트 이름을 여기 한 곳에서만 정한다.
 *
 * 화면마다 `gtag('event', ...)`를 직접 부르면, 같은 뜻의 이벤트가
 * `upload_done` / `uploadComplete` / `upload_complete` 로 갈라져 쌓인다.
 * GA4는 **과거 데이터를 소급해서 고쳐주지 않으므로** 그렇게 갈라진 순간
 * 그 기간의 숫자는 영원히 못 쓴다. 그래서 이름과 파라미터를 타입으로 묶었다.
 *
 * 쓰는 법 — 클라이언트 컴포넌트에서만 부른다(서버에는 gtag가 없다).
 *
 *   import { track } from '@/lib/analytics'
 *   track('capture_confirm', { kind: 'voice' })
 *
 * 측정 ID(NEXT_PUBLIC_GA_ID)가 없으면 아무 일도 하지 않는다 —
 * 계측은 곁다리라, 설정을 깜빡했다고 진짜 기능이 멈추면 안 된다.
 */

import type { SignupField } from '@/lib/signup-done'

/** 무엇을 올리는 중인가. */
export type CaptureKind = 'voice' | 'photo' | 'video' | 'caption'

/**
 * 보낼 수 있는 이벤트 전부.
 *
 * 퍼널 4개로 묶여 있다:
 *   A 가입 · B 초대→첫답장 · C 작성 · D 재방문
 *
 * GA4 규칙상 이름은 소문자+밑줄, 40자 이하여야 한다.
 */
export type AnalyticsEvents = {
  // ── A. 가입 퍼널 — 어느 칸에서 막히는가 ────────────────────
  /** `/start` 화면을 봤다. */
  start_view: never
  /** 가입 폼에 들어왔다. */
  signup_begin: never
  /** 가입 폼이 되돌려보냈다. `field`가 병목 지점이다. */
  signup_field_error: { field: SignupField }
  /** 가입이 끝났다. `minor`는 만 14세 미만 여부. */
  signup_complete: { minor: boolean }

  // ── B. 초대 → 첫 답장 (이 서비스의 성장 퍼널) ───────────────
  /** 초대 링크·QR로 들어왔다. */
  invite_open: never
  /** 초대로 들어와 가입까지 마쳤다. */
  invite_signup_complete: never
  /** 초대받은 사람이 첫 답장을 남겼다. */
  first_reply_done: never

  // ── C. 작성 퍼널 (몽실이 검증의 본체) ──────────────────────
  /** 작성 화면에 들어왔다. `variant`로 몽실이/기존을 가른다. */
  compose_open: { variant: 'mongsil' | 'legacy' }
  /** 녹음·촬영·사진 고르기를 시작했다. */
  capture_start: { kind: CaptureKind }
  /** 몽실이에 담았다("담기"). */
  capture_confirm: { kind: CaptureKind }
  /** 위로 던졌다(업로드 시작). */
  upload_throw: { kind: CaptureKind }
  /** 업로드가 끝났다. */
  upload_complete: { kind: CaptureKind }
  /** 업로드가 실패했다. */
  upload_fail: { kind: CaptureKind; reason: 'size' | 'duration' | 'network' | 'unknown' }
  /**
   * 올리지 않고 나갔다. **이 서비스에서 가장 중요한 이벤트다.**
   * `step`이 "담기까지 갔는데 던지지 않은" 사람을 잡아낸다.
   */
  compose_abandon: { step: 'open' | 'capturing' | 'confirmed' }

  // ── D. 재방문 — 웹푸시가 실제로 불러오는가 ──────────────────
  push_permission: { result: 'granted' | 'denied' | 'dismissed' }
  push_opened: never
  room_view: never
}

type Params<K extends keyof AnalyticsEvents> =
  AnalyticsEvents[K] extends never ? [] : [params: AnalyticsEvents[K]]

type Gtag = (command: 'event', name: string, params?: Record<string, unknown>) => void

/**
 * 이벤트 하나를 보낸다.
 *
 * 실패해도 삼킨다 — 광고 차단기가 gtag를 통째로 막는 경우가 흔한데,
 * 그 사용자에게 앱이 깨져 보이면 안 된다. 계측 때문에 기능이 멈추는 일은 없다.
 */
export function track<K extends keyof AnalyticsEvents>(name: K, ...params: Params<K>): void {
  if (typeof window === 'undefined') return

  const gtag = (window as unknown as { gtag?: Gtag }).gtag
  if (typeof gtag !== 'function') return

  try {
    gtag('event', name, {
      ...(params[0] ?? {}),
      // 개발 중에는 GA4 관리화면의 DebugView에 실시간으로 뜬다.
      ...(process.env.NODE_ENV === 'development' ? { debug_mode: true } : {}),
    })
  } catch {
    // 계측은 곁다리다. 조용히 넘어간다.
  }
}

/** 측정 ID. 없으면 계측을 아예 붙이지 않는다. */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? ''
