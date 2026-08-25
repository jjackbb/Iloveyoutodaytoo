'use client'

import { useEffect, useState, useSyncExternalStore, useTransition } from 'react'

import { subscribeToPush, unsubscribeFromPush } from '@/lib/actions/push'

/**
 * 마이 화면의 "알림 받기" 스위치 (또는 그 자리에 대신 오는 안내).
 *
 * `LargeTextRow`와 같은 스위치 모양을 쓰지만 구조가 다르다 — 저긴 서버 값을
 * 낙관적으로 뒤집기만 하면 끝나지만, 여기는 브라우저 권한 팝업(성공/거절)이라는
 * **실제로 실패할 수 있는 단계**가 중간에 있다. 그래서 눌러본 뒤 결과가 확인되기
 * 전에는 켜진 것처럼 보여주지 않는다 — 잘못 낙관하면 "껐다 켰다"로 깜빡여
 * 오히려 고장처럼 보인다.
 *
 * 이 스위치는 **이 기기(브라우저) 하나**에 대한 것이다. 그래서 서버가 내려준 값이
 * 아니라 `registration.pushManager.getSubscription()`으로 이 브라우저가 실제로
 * 구독 중인지를 직접 물어 상태를 정한다 — 다른 기기에서 켰다고 여기서도 켜진 것처럼
 * 보이면, 여기서 끄려 해도 지울 구독이 없어 아무 일도 안 일어나는 죽은 스위치가 된다.
 *
 * 지원 판별은 마운트 후에만 한다(navigator는 서버에 없다). 판별 전에는 아무것도
 * 그리지 않는다 — 스위치를 먼저 보여줬다 안내문으로 바뀌면 그사이 깜빡임이 생긴다.
 */

type Category = 'checking' | 'ios-needs-install' | 'unsupported' | 'ready'

/** VAPID 공개키(base64url) → 브라우저 Push API가 요구하는 바이트 배열. */
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

/*
  지원 여부·설치 여부는 브라우저(navigator/window)만 안다 — 서버는 모른다.
  useEffect + setState로 하면 "판별 전 렌더"가 한 번 더 끼어 린트가 막는다
  (react-hooks/set-state-in-effect: 이펙트 안에서 곧바로 setState 하지 말라는 규칙).
  useSyncExternalStore를 쓰면 서버 스냅샷('checking')과 클라이언트 스냅샷이 각자
  자기 환경에 맞게 한 번에 정해져, 여분의 렌더 없이 같은 결과를 얻는다.
  구독 자체는 값이 바뀌지 않으므로(새로고침 전엔 안 바뀐다) subscribe는 아무것도 안 한다.
*/
function subscribeNever(): () => void {
  return () => {}
}

function getCategorySnapshot(): Category {
  const nav = window.navigator as Navigator & { standalone?: boolean }
  const isIOS =
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  const supportsPush =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window

  if (isIOS && !isStandalone) return 'ios-needs-install'
  if (!supportsPush) return 'unsupported'
  return 'ready'
}

function getCategoryServerSnapshot(): Category {
  return 'checking'
}

export function PushNotificationRow() {
  const category = useSyncExternalStore(
    subscribeNever,
    getCategorySnapshot,
    getCategoryServerSnapshot,
  )
  const [subscribed, setSubscribed] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (category !== 'ready') return

    // 이전에 이 브라우저에서 이미 켰는지 확인한다. 여기서는 새로 등록하지 않는다
    // — 권한을 물은 적 없는 사람에게 서비스 워커를 조용히 심어두지 않기 위해서다.
    navigator.serviceWorker
      .getRegistration('/sw.js')
      .then(async (registration) => {
        if (!registration) return
        const existing = await registration.pushManager.getSubscription()
        setSubscribed(!!existing)
      })
      .catch(() => {})
  }, [category])

  async function enable() {
    setMessage(null)

    // 권한 팝업은 반드시 이 클릭 안에서, 다른 비동기 작업보다 먼저 물어야 한다.
    // 미뤘다 물으면 브라우저가 "사용자 조작 없이 요청함"으로 보고 자동 차단하거나,
    // 다음부터 아예 다시 묻지 않게 될 수 있다.
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setMessage('알림 권한이 꺼져 있어요. 브라우저 설정에서 허용해주세요.')
      return
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) {
      console.error('[알림] NEXT_PUBLIC_VAPID_PUBLIC_KEY가 없다.')
      setMessage('알림을 설정하지 못했어요. 잠시 후 다시 시도해주세요.')
      return
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const json = subscription.toJSON()
      const result = await subscribeToPush({
        endpoint: json.endpoint ?? '',
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
      })

      if (!result.ok) {
        await subscription.unsubscribe()
        setMessage(result.error)
        return
      }

      setSubscribed(true)
    } catch (err) {
      console.error('[알림] 켜기 실패:', err)
      setMessage('알림을 켜지 못했어요. 잠시 후 다시 시도해주세요.')
    }
  }

  async function disable() {
    setMessage(null)
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()

      if (subscription) {
        const endpoint = subscription.endpoint
        await subscription.unsubscribe()
        await unsubscribeFromPush(endpoint)
      }

      setSubscribed(false)
    } catch (err) {
      console.error('[알림] 끄기 실패:', err)
      setMessage('알림을 끄지 못했어요. 잠시 후 다시 시도해주세요.')
    }
  }

  function toggle(next: boolean) {
    startTransition(async () => {
      if (next) {
        await enable()
      } else {
        await disable()
      }
    })
  }

  // 판별 전에는 아무것도 그리지 않는다 (위 설명 참고).
  if (category === 'checking') return null

  if (category === 'ios-needs-install') {
    return (
      <li className="flex flex-col px-5 py-4">
        <span className="text-lg text-ink">알림 받기</span>
        <span className="mt-1 text-base break-keep text-muted">
          홈 화면에 추가하면 알림을 받을 수 있어요. 공유 버튼을 누르고
          &apos;홈 화면에 추가&apos;를 선택해주세요.
        </span>
      </li>
    )
  }

  if (category === 'unsupported') {
    return (
      <li className="flex flex-col px-5 py-4">
        <span className="text-lg text-ink">알림 받기</span>
        <span className="mt-1 text-base break-keep text-muted">
          이 브라우저에서는 알림을 지원하지 않아요.
        </span>
      </li>
    )
  }

  return (
    <li className="flex flex-col">
      <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 px-5 py-4">
        <span className="text-lg text-ink">알림 받기</span>

        <input
          type="checkbox"
          className="sr-only"
          checked={subscribed}
          disabled={pending}
          onChange={(e) => toggle(e.target.checked)}
        />

        <span
          aria-hidden
          className={`relative h-[31px] w-[51px] shrink-0 rounded-chip transition-colors ${
            subscribed ? 'bg-primary' : 'bg-hairline-strong'
          } ${pending ? 'opacity-60' : ''}`}
        >
          <span
            className={`absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-chip bg-card shadow-pill transition-transform ${
              subscribed ? 'translate-x-[20px]' : ''
            }`}
          />
        </span>
      </label>

      {message ? (
        <p role="alert" className="px-5 pb-4 text-base break-keep text-primary">
          {message}
        </p>
      ) : null}
    </li>
  )
}
