'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'

import {
  VoiceRecorder,
  type VoiceRecording,
} from '@/components/message/VoiceRecorder'
import { Button } from '@/components/ui/Button'
import { controlClassName } from '@/components/ui/Field'
import { createMemory, updateMemory } from '@/lib/actions/memories'
import { track } from '@/lib/analytics'
import { resizePhoto } from '@/lib/image'
import { CAPTION_MAX_LENGTH, PHOTO_MAX_COUNT } from '@/lib/limits'
import { createClient } from '@/lib/supabase/client'

/**
 * 마음 표현하기 — 작성 화면 (캡처 12~21).
 *
 * 사진 타일 줄 / "함께 담을 목소리" 카드 / "문구 선택" / 아래 고정 [♥ 표현하기].
 * **사진 1장 이상 + 음성 3초 이상**을 모두 담아야 버튼이 켜진다(캡처 12의 안내문).
 *
 * 잔여데이터가 남지 않는 이유:
 * 담아둔 사진·녹음·문구는 전부 이 컴포넌트의 상태다. 화면을 떠나면 함께 사라진다.
 * 모듈 최상단에 값을 쌓아두지 않으므로 다시 들어오면 언제나 빈 화면에서 시작한다.
 * **Storage도 마찬가지다.** 저장까지 가지 못한 업로드는 화면을 떠날 때 지운다
 * (`discardUploads`). 안 지우면 화면의 잔여는 사라져도 버킷에 파일만 남는다.
 *
 * 가장 중요한 약속(04_PROJECT_SPEC.md "항상 해"):
 * **업로드가 실패해도 사용자에게 다시 고르게 하지 않는다.**
 * 파일은 이 컴포넌트가 계속 쥐고 있고, 실패하면 지수 백오프로 자동 재시도한다.
 * 끝내 안 되면 "다시 표현하기" 버튼만 보여준다 — 다시 찍거나 녹음하라고 하지 않는다.
 *
 * 사진·음성 경로는 반드시 `{room_id}/파일명` 으로 시작해야 한다.
 * Storage RLS가 경로의 첫 조각을 room_id로 읽어 방 멤버인지 확인하기 때문이다.
 */

/** 최초 시도 뒤 기다렸다 다시 보내는 간격. 총 3번 시도한다. */
const RETRY_DELAYS_MS = [1500, 4000]

const PHOTO_BUCKET = 'media'
const VOICE_BUCKET = 'voice'

/** 고를 수 있는 사진 형식. media 버킷 설정과 같은 값이다. */
const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/heic'

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 사용자에게 그대로 보여줘도 되는(이미 한국어로 다듬어진) 오류.
 *
 * 이걸 구분하지 않으면 서버 액션 호출이 통째로 끊겼을 때 나오는
 * "Failed to fetch" 같은 영어 기술 문구가 시니어 사용자 화면에 그대로 뜬다.
 */
class FriendlyError extends Error {}

/** 파일 이름. crypto.randomUUID를 못 쓰는 환경도 있어 대비해 둔다. */
function randomFileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 어디에도 연결되지 않은 채 남은 업로드를 지운다.
 *
 * 왜 필요한가: 파일은 `createMemory`보다 **먼저** 올라간다. 저장이 실패한 뒤 사용자가
 * 화면을 떠나면 그 파일들은 어떤 `memories`·`memory_photos` 행에도 걸리지 않은 채
 * 버킷에 영영 남는다. 실제로 그렇게 남아 사흘 동안 아무도 못 찾은 파일이 있었다.
 *
 * Storage 삭제 정책은 `owner_id = auth.uid()`라 **올린 본인만** 지울 수 있다.
 * 지금 이 브라우저가 바로 그 본인이므로, 이 자리를 놓치면 지울 수 있는 사람이 없어진다.
 *
 * 실패해도 사용자를 막지 않는다 — 이미 떠난 화면의 뒷정리다.
 * 대신 **반드시 로그를 남긴다.** 못 지웠더라도 경로가 남아 있어야 나중에 찾아 지울 수 있다.
 */
async function discardUploads(
  photoPaths: string[],
  voicePath: string | null,
): Promise<void> {
  if (photoPaths.length === 0 && !voicePath) return

  // 지우기 요청이 화면 전환에 잘릴 수 있으므로 먼저 적어둔다.
  console.warn('[마음 표현하기] 저장되지 못한 파일을 정리합니다:', {
    photos: photoPaths,
    voice: voicePath,
  })

  const supabase = createClient()

  const jobs: Promise<void>[] = []
  if (photoPaths.length > 0) {
    jobs.push(removeFrom(supabase, PHOTO_BUCKET, photoPaths))
  }
  if (voicePath) {
    jobs.push(removeFrom(supabase, VOICE_BUCKET, [voicePath]))
  }
  await Promise.all(jobs)
}

async function removeFrom(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  paths: string[],
): Promise<void> {
  try {
    const { error: removeError } = await supabase.storage
      .from(bucket)
      .remove(paths)
    if (removeError) {
      console.error(
        `[마음 표현하기] ${bucket} 정리 실패 — 남은 파일:`,
        paths,
        removeError.message,
      )
    }
  } catch (unexpected) {
    console.error(
      `[마음 표현하기] ${bucket} 정리 실패 — 남은 파일:`,
      paths,
      unexpected,
    )
  }
}

/** 화면에 놓인 사진 한 장. id는 지우기 버튼이 어느 장인지 가리키는 데 쓴다. */
type PickedPhoto = {
  id: string
  /**
   * 방금 고른 사진. 이미 올라가 있는 사진(고치기로 들어온 것)은 파일이 없다 —
   * 그때는 아래 `path`가 채워져 있고, 올리는 단계를 건너뛴다.
   */
  file: File | null
  preview: string
  /** 이미 Storage에 있는 사진의 경로. 고치기로 들어온 사진만 갖는다. */
  path?: string
}

type Phase = 'editing' | 'sending' | 'retrying' | 'failed'

/* ------------------------------------------------------------------
   사진 순서 바꾸기 (끌어서 놓기)

   왜 라이브러리를 안 쓰나: 끌 대상이 한 줄에 최대 10칸뿐이고, 필요한 동작은
   "끌면 배열 순서를 바꾼다" 하나다. 이걸 위해 의존성을 늘리지 않는다.

   왜 HTML5 Drag and Drop이 아니라 포인터 이벤트인가:
   **이 서비스는 손가락으로 쓰는 화면이다.** HTML5 dragstart는 모바일 브라우저에서
   아예 일어나지 않아서, 그걸로 만들면 마우스 쓰는 사람만 쓸 수 있는 기능이 된다.

   손가락은 **꾹 눌러야** 끌기가 시작된다. 이 줄은 옆으로 미는 줄이기도 해서,
   누르자마자 끌기로 잡으면 옆으로 못 민다. 마우스는 밀 일이 없으니 바로 시작한다.

   버그였던 지점: 타일에 브라우저 기본 스크롤을 막아두지 않으면(touch-action 기본값),
   손가락을 대기 시간 동안 완전히 가만히 두지 못해 아주 살짝만 움직여도 브라우저가 먼저
   "이건 스크롤이다"라고 판단해 pointercancel을 보내 끌기 시도 자체가 통째로 끊겼다.
   그래서 타일에 touch-action: none을 주고, 대신 옆으로 미는 동작은 우리가 손수
   scrollLeft를 옮겨 흉내낸다.
   ------------------------------------------------------------------ */

/** 손가락으로 이만큼 누르고 있으면 끌기가 시작된다. */
const DRAG_HOLD_MS = 150
/** 이만큼 움직이면 "가만히 누른 것"이 아니다 — 손가락은 옆으로 미는 것으로 본다. */
const DRAG_MOVE_TOLERANCE_PX = 10
/** 줄의 이 안쪽까지 끌고 가면 줄이 저절로 따라 움직인다(가려진 자리로 옮기려고). */
const DRAG_EDGE_PX = 52
const DRAG_EDGE_SPEED_PX = 12

type PhotoDrag = {
  pointerId: number
  photoId: string
  startX: number
  startY: number
  lastX: number
  mode: 'pending' | 'scrolling' | 'dragging'
  scrollStartX: number
  holdTimer: ReturnType<typeof setTimeout> | null
  frame: number | null
  stop: () => void
}

/**
 * 사진 타일을 끌어서 순서를 바꾸게 한다.
 *
 * **배열 순서가 곧 대표 사진 판정 기준이다**(0번이 대표). 그래서 이 훅은
 * 배지를 직접 건드리지 않는다 — 배열만 바꾸면 배지는 저절로 따라간다.
 *
 * 끌고 있는 동안 배열을 바로바로 바꾼다. 그래야 놓을 자리에 유령 칸을 따로
 * 그리지 않아도 되고, 대표 사진 배지가 손가락을 따라 움직여 결과가 미리 보인다.
 */
function usePhotoReorder(
  photos: PickedPhoto[],
  setPhotos: React.Dispatch<React.SetStateAction<PickedPhoto[]>>,
  enabled: boolean,
) {
  const listRef = useRef<HTMLUListElement>(null)
  const dragRef = useRef<PhotoDrag | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  // 끌고 있는 중에 화면을 떠나도 창에 붙인 이벤트가 남지 않게 한다.
  useEffect(() => () => dragRef.current?.stop(), [])

  /*
   * 타일의 "애니메이션이 섞이지 않은" 제자리 위치를 잰다.
   *
   * getBoundingClientRect()를 쓰면 안 된다 — 아래 FLIP이 걸어둔 transform이 그 값에
   * 섞여 들어와서, 미끄러지는 중인 어긋난 위치를 기준으로 자리를 다시 계산하게 된다.
   * 그러면 순서 변경 → 애니메이션 → 잘못된 위치 → 또 순서 변경으로 되먹임이 생겨
   * 타일들이 정신없이 흔들린다. offsetLeft는 transform의 영향을 받지 않는다.
   * (그래서 줄에 `relative`가 필요하다 — offsetLeft의 기준을 줄로 못박는다.)
   */
  const measureTiles = useCallback((list: HTMLUListElement) => {
    const listLeft = list.getBoundingClientRect().left - list.scrollLeft
    return Array.from(
      list.querySelectorAll<HTMLElement>('[data-photo-id]'),
    ).map((el) => ({
      el,
      id: el.dataset.photoId ?? '',
      left: listLeft + el.offsetLeft,
      width: el.offsetWidth,
    }))
  }, [])

  /*
   * 자리가 바뀐 타일이 순간이동하지 않고 스르륵 미끄러지게 한다(FLIP).
   * 순서가 바뀌기 전 위치를 기억해 뒀다가, 리렌더 뒤 새 위치와 비교해서 그 차이만큼
   * 반대로 밀어둔 다음 0으로 되돌리며 transition을 건다 — 흔한 "레이아웃 애니메이션" 기법.
   * 손가락 아래 있는 타일(draggingId)은 손가락을 그대로 따라가야 하니 건너뛴다.
   */
  const prevLeftsRef = useRef<Map<string, number>>(new Map())
  useLayoutEffect(() => {
    const list = listRef.current
    const prevLefts = prevLeftsRef.current
    const nextLefts = new Map<string, number>()

    if (list) {
      for (const tile of measureTiles(list)) {
        if (!tile.id) continue
        nextLefts.set(tile.id, tile.left)

        const prev = prevLefts.get(tile.id)
        if (prev === undefined || tile.id === draggingId) continue
        const dx = prev - tile.left
        if (dx === 0) continue

        tile.el.style.transition = 'none'
        tile.el.style.transform = `translateX(${dx}px)`
        // 강제로 한 프레임 그리게 한 다음에 원래 자리로 애니메이션한다.
        tile.el.getBoundingClientRect()
        requestAnimationFrame(() => {
          tile.el.style.transition =
            'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)'
          tile.el.style.transform = ''
        })
      }
    }

    prevLeftsRef.current = nextLefts
  }, [photos, draggingId, measureTiles])

  const onTilePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>, photoId: string) => {
      if (!enabled || dragRef.current) return
      // ×(빼기)를 누른 것은 끌기가 아니다.
      if ((event.target as HTMLElement).closest('button')) return
      if (event.pointerType === 'mouse' && event.button !== 0) return

      const touch = event.pointerType !== 'mouse'
      const drag: PhotoDrag = {
        pointerId: event.pointerId,
        photoId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        mode: 'pending',
        scrollStartX: 0,
        holdTimer: null,
        frame: null,
        stop: () => {},
      }
      dragRef.current = drag

      /**
       * 손가락이 **바로 옆 칸의 중간선**을 넘었을 때만 한 칸씩 옮긴다.
       *
       * 손가락 위치로 목표 칸을 통째로 계산하면, 옮긴 직후 손가락이 새 자리의
       * 반대편 절반에 놓여 곧바로 되돌아가는 일이 생긴다(왔다 갔다 떨림).
       * 한 번에 한 칸씩만, 그것도 이웃을 확실히 지났을 때만 움직여야 차분하다.
       */
      const moveTo = (clientX: number) => {
        const list = listRef.current
        if (!list) return
        const tiles = measureTiles(list)
        if (tiles.length < 2) return

        const from = tiles.findIndex((tile) => tile.id === drag.photoId)
        if (from === -1) return

        let target = from
        const right = tiles[from + 1]
        const left = tiles[from - 1]
        if (right && clientX > right.left + right.width / 2) {
          target = from + 1
        } else if (left && clientX < left.left + left.width / 2) {
          target = from - 1
        }
        if (target === from) return

        setPhotos((current) => {
          const at = current.findIndex((photo) => photo.id === drag.photoId)
          if (at === -1 || target >= current.length || at === target) {
            return current
          }
          const next = [...current]
          const [moved] = next.splice(at, 1)
          next.splice(target, 0, moved)
          return next
        })
      }

      /** 줄 끝까지 끌고 가면 줄을 따라 밀어준다. 안 그러면 가려진 칸으로 못 옮긴다. */
      const step = () => {
        drag.frame = requestAnimationFrame(step)
        const list = listRef.current
        if (!list || drag.mode !== 'dragging') return

        const rect = list.getBoundingClientRect()
        let delta = 0
        if (drag.lastX < rect.left + DRAG_EDGE_PX) delta = -DRAG_EDGE_SPEED_PX
        else if (drag.lastX > rect.right - DRAG_EDGE_PX) delta = DRAG_EDGE_SPEED_PX
        if (delta === 0) return

        const before = list.scrollLeft
        list.scrollLeft = before + delta
        if (list.scrollLeft !== before) moveTo(drag.lastX)
      }

      const activate = () => {
        if (drag.mode === 'dragging') return
        drag.mode = 'dragging'
        drag.holdTimer = null
        setDraggingId(drag.photoId)
        drag.frame = requestAnimationFrame(step)
      }

      const onMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== drag.pointerId) return
        drag.lastX = moveEvent.clientX

        if (drag.mode === 'dragging') {
          moveTo(moveEvent.clientX)
          return
        }

        if (drag.mode === 'scrolling') {
          const list = listRef.current
          if (list) {
            list.scrollLeft = drag.scrollStartX - (moveEvent.clientX - drag.startX)
          }
          return
        }

        const far =
          Math.abs(moveEvent.clientX - drag.startX) > DRAG_MOVE_TOLERANCE_PX ||
          Math.abs(moveEvent.clientY - drag.startY) > DRAG_MOVE_TOLERANCE_PX
        if (!far) return

        if (touch) {
          // 꾹 누르기 전에 옆으로 밀었다 — 스크롤하려는 것으로 보고 끌기 대기를 그만둔다.
          // 타일이 touch-action: none이라 네이티브 스크롤이 안 먹으니 손수 흉내낸다.
          if (drag.holdTimer) {
            clearTimeout(drag.holdTimer)
            drag.holdTimer = null
          }
          drag.mode = 'scrolling'
          const list = listRef.current
          drag.scrollStartX = list ? list.scrollLeft : 0
          if (list) {
            list.scrollLeft = drag.scrollStartX - (moveEvent.clientX - drag.startX)
          }
        } else {
          // 마우스는 움직인 순간이 곧 끌기다.
          activate()
        }
      }

      /**
       * 끌고 있는 동안에는 화면이 따라 움직이지 않게 막는다.
       * pointermove를 막아서는 안 막힌다 — touchmove를 passive 아닌 채로 잡아야 한다.
       */
      const blockScroll = (touchEvent: TouchEvent) => {
        if (drag.mode === 'dragging') touchEvent.preventDefault()
      }

      function stop() {
        if (dragRef.current !== drag) return
        dragRef.current = null
        if (drag.holdTimer) clearTimeout(drag.holdTimer)
        if (drag.frame !== null) cancelAnimationFrame(drag.frame)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', stop)
        window.removeEventListener('pointercancel', stop)
        document.removeEventListener('touchmove', blockScroll)
        setDraggingId(null)
      }

      drag.stop = stop

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', stop)
      window.addEventListener('pointercancel', stop)
      document.addEventListener('touchmove', blockScroll, { passive: false })

      if (touch) drag.holdTimer = setTimeout(activate, DRAG_HOLD_MS)
    },
    [enabled, setPhotos, measureTiles],
  )

  return { listRef, draggingId, onTilePointerDown }
}

/**
 * 고치기로 들어올 때 서버가 넘겨주는 지금 상태 (노션 IA 3.8).
 * 없으면 새로 남기는 화면이다 — 이 파일의 기본 동작은 그대로다.
 */
export type ComposeInitial = {
  memoryId: string
  /** 지금 붙어 있는 사진들. 순서 그대로다. */
  photos: { path: string; url: string }[]
  /** 지금 붙어 있는 목소리. 서명된 주소로 브라우저가 파일을 받아 온다. */
  voice: { path: string; url: string; durationSec: number; levels: number[] | null }
  caption: string
}

export function ComposeForm({
  roomId,
  initial,
}: {
  roomId: string
  initial?: ComposeInitial
}) {
  const router = useRouter()
  const editing = initial !== undefined

  const [photos, setPhotos] = useState<PickedPhoto[]>(() =>
    (initial?.photos ?? []).map((photo) => ({
      id: photo.path,
      file: null,
      preview: photo.url,
      path: photo.path,
    })),
  )
  const [recording, setRecording] = useState<VoiceRecording | null>(null)
  const [caption, setCaption] = useState(initial?.caption ?? '')
  const [phase, setPhase] = useState<Phase>('editing')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  /**
   * 이미 올라간 파일의 경로를 기억해 둔다(사진은 화면 id별로).
   * 재시도할 때 같은 파일을 또 올리지 않는다.
   */
  const uploadedPhotoPathsRef = useRef(new Map<string, string>())
  const uploadedVoicePathRef = useRef<string | null>(null)

  /**
   * 고치기로 들어왔을 때, 지금 화면의 목소리가 **원래 그 게시물의 것**인가.
   *
   * 원래 것이면 다시 올리지 않고 그 경로를 그대로 쓴다. 다시 녹음하면 false가 되고
   * 새 파일이 올라간다. **원래 파일은 여기서 절대 지우지 않는다** —
   * 저장하지 않고 나가면 그 게시물의 목소리가 통째로 사라지기 때문이다.
   * 쓰이지 않게 된 옛 파일은 저장이 끝난 뒤 서버(updateMemory)가 지운다.
   */
  const [voiceIsOriginal, setVoiceIsOriginal] = useState(editing)

  /** 원래 목소리를 아직 받아오는 중인가(고치기 화면에서 잠깐). */
  const [loadingVoice, setLoadingVoice] = useState(editing)

  /** 저장이 끝났는지. 끝났으면 올라간 파일은 게시물의 것이라 건드리면 안 된다. */
  const committedRef = useRef(false)

  const busy = phase === 'sending' || phase === 'retrying'

  /*
    작성 퍼널 계측 — 몽실이를 붙이기 "전"의 숫자를 여기서 확보한다.

    GA4는 소급 집계가 안 되므로, 기존 화면에서 같은 모양의 이벤트를 지금 쌓아두지
    않으면 나중에 "몽실이가 나아졌다"를 증명할 방법이 없다.

    stageRef 는 떠나는 순간 "어디까지 갔다가 나갔는지"를 알려준다.
    가장 중요한 숫자는 confirmed(올릴 준비가 끝났는데 안 올림)의 비율이다.
  */
  const stageRef = useRef<'open' | 'capturing' | 'confirmed'>('open')

  useEffect(() => {
    track('compose_open', { variant: 'legacy' })
    return () => {
      if (!committedRef.current) {
        track('compose_abandon', { step: stageRef.current })
      }
    }
  }, [])

  // 사진이 2장 이상일 때만, 그리고 담는 중이 아닐 때만 순서를 바꿀 수 있다.
  const {
    listRef: photoListRef,
    draggingId,
    onTilePointerDown,
  } = usePhotoReorder(photos, setPhotos, photos.length > 1 && !busy)

  /**
   * 화면을 떠날 때, 아직 게시물로 저장되지 못한 업로드를 지운다.
   *
   * 실패한 채 남아 있는 동안에는 지우지 않는다 — [다시 표현하기]가 그 파일들을
   * 그대로 다시 쓰기 때문이다("업로드가 실패해도 다시 고르게 하지 않는다").
   * 사용자가 정말 떠날 때가 되어서야 정리한다.
   */
  useEffect(() => {
    // ref 상자 자체를 붙잡아 둔다(안의 값이 아니라). 상자는 바뀌지 않으므로
    // 정리할 때 읽으면 **떠나는 순간의 최신 값**이 나온다.
    const photoPaths = uploadedPhotoPathsRef.current
    const voicePath = uploadedVoicePathRef
    const committed = committedRef

    return () => {
      if (committed.current) return
      void discardUploads([...photoPaths.values()], voicePath.current)
      photoPaths.clear()
      voicePath.current = null
    }
  }, [])

  /**
   * 녹음이 바뀌면 앞서 올려 둔 경로는 반드시 버린다.
   * 안 버리면 "다시 녹음하기" 후 표현했을 때 **예전 녹음이 그대로 저장된다.**
   *
   * 경로만 버리면 파일은 버킷에 남으므로, 이미 올라간 것은 여기서 지운다.
   * 이 녹음은 방금 사용자가 "이건 아니다"라고 물린 것이라 다시 쓸 일이 없다.
   */
  const handleRecordingChange = useCallback((next: VoiceRecording | null) => {
    const stale = uploadedVoicePathRef.current
    uploadedVoicePathRef.current = null
    if (stale) void discardUploads([], stale)
    // 다시 녹음했으면 더 이상 원래 목소리가 아니다. 원래 파일은 건드리지 않는다.
    setVoiceIsOriginal(false)
    setRecording(next)

    if (next) {
      if (stageRef.current === 'open') stageRef.current = 'capturing'
      track('capture_start', { kind: 'voice' })
    }
  }, [])

  /*
    고치기로 들어왔으면 원래 목소리를 받아와 화면에 올려둔다.

    왜 파일까지 받아오나: 녹음 부품은 "지금 녹음해 둔 것"을 파일(Blob)로 들고 있어야
    재생을 보여줄 수 있다. 주소만 넘기면 들어보지도 못한 채 다시 녹음할지 정해야 한다.
    60초짜리라 크지 않다.
  */
  useEffect(() => {
    if (!initial) return
    let cancelled = false

    void (async () => {
      try {
        const response = await fetch(initial.voice.url)
        if (!response.ok) throw new Error(`voice-fetch-${response.status}`)
        const blob = await response.blob()
        if (cancelled) return

        const mimeType = blob.type || 'audio/webm'
        setRecording({
          blob,
          durationSec: initial.voice.durationSec,
          mimeType,
          extension: mimeType.split('/')[1]?.split(';')[0] || 'webm',
          levels: initial.voice.levels,
        })
      } catch (loadError) {
        // 못 받아왔으면 새로 녹음하는 수밖에 없다. 화면을 막지는 않는다.
        console.error('[추억 고치기] 원래 목소리 불러오기 실패:', loadError)
        if (!cancelled) setVoiceIsOriginal(false)
      } finally {
        if (!cancelled) setLoadingVoice(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [initial])

  const canSubmit =
    photos.length > 0 &&
    recording !== null &&
    caption.trim().length <= CAPTION_MAX_LENGTH

  /*
    올릴 준비가 처음 끝난 순간. 몽실이의 "담기"에 해당한다.
    한 번만 보낸다 — 글자를 지웠다 썼다 하면 여러 번 오갈 수 있어서다.
  */
  useEffect(() => {
    if (canSubmit && stageRef.current !== 'confirmed') {
      stageRef.current = 'confirmed'
      track('capture_confirm', { kind: 'photo' })
    }
  }, [canSubmit])

  /** 고른 사진을 올릴 수 있는 크기로 줄여서 타일 줄에 붙인다. */
  async function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? [])
    // 같은 사진을 다시 골라도 change가 일어나야 하므로 값을 비운다.
    event.target.value = ''
    if (chosen.length === 0) return

    if (stageRef.current === 'open') stageRef.current = 'capturing'
    track('capture_start', { kind: 'photo' })

    setError(null)
    setPicking(true)

    // 남은 자리만큼만 받는다. 넘게 고른 건 조용히 버리지 않고 아래에서 알려준다.
    const room = PHOTO_MAX_COUNT - photos.length
    const accepted = chosen.slice(0, room)

    const added: PickedPhoto[] = []
    let failed = 0

    for (const file of accepted) {
      try {
        const { file: resized, preview } = await resizePhoto(file)
        added.push({ id: randomFileId(), file: resized, preview })
      } catch (resizeError) {
        console.error('[마음 표현하기] 사진을 줄이지 못했습니다:', resizeError)
        failed += 1
      }
    }

    if (added.length > 0) setPhotos((current) => [...current, ...added])
    setPicking(false)

    if (failed > 0) {
      setError(`사진 ${failed}장은 열지 못했어요. 다른 사진으로 담아주세요.`)
    } else if (chosen.length > room) {
      setError(`사진은 ${PHOTO_MAX_COUNT}장까지 담을 수 있어요.`)
    }
  }

  function removePhoto(id: string) {
    // ×로 뺀 사진이 이미 올라가 있었다면(앞선 시도가 실패한 경우) 파일도 함께 지운다.
    // 경로만 지우면 아무도 참조하지 않는 파일이 버킷에 남는다.
    const stale = uploadedPhotoPathsRef.current.get(id)
    uploadedPhotoPathsRef.current.delete(id)
    if (stale) void discardUploads([stale], null)

    setPhotos((current) => current.filter((photo) => photo.id !== id))
    setError(null)
  }

  /** Storage에 한 파일 올리기. 실패하면 잠시 기다렸다 자동으로 다시 시도한다. */
  const upload = useCallback(
    async (
      bucket: string,
      path: string,
      blob: Blob,
      contentType: string,
    ): Promise<void> => {
      const supabase = createClient()

      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, blob, { contentType, upsert: true })

        if (!uploadError) return

        if (attempt === RETRY_DELAYS_MS.length) {
          throw new Error(`upload-failed: ${uploadError.message}`)
        }

        setPhase('retrying')
        setNotice('연결이 잠시 불안정해요. 잠시 후 자동으로 다시 담을게요.')
        await wait(RETRY_DELAYS_MS[attempt])
      }
    },
    [],
  )

  const submit = useCallback(async () => {
    if (!canSubmit || busy || !recording) return

    setError(null)
    setNotice(null)
    setPhase('sending')

    /*
      몽실이의 "위로 던지기"에 해당한다.
      kind 를 'photo' 로 고정한 이유 — 이 화면은 사진과 목소리를 **묶어서 한 번에**
      올린다(canSubmit 이 둘 다 있어야 참). 몽실이는 따로 올리므로, 두 화면을
      비교할 때는 kind 별 쪼개기가 아니라 **퍼널의 모양**으로 봐야 한다.
    */
    track('upload_throw', { kind: 'photo' })

    try {
      // 사진 — 화면에 놓인 순서 그대로 올린다. 첫 장이 대표 사진이 된다.
      // 한 장씩 차례로 올리는 이유: 열 장을 한꺼번에 밀면 느린 연결에서 서로 발목을 잡고,
      // 어디까지 됐는지도 알 수 없다. 차례로 하면 성공한 것은 재시도에서 건너뛴다.
      const photoPaths: string[] = []
      for (const photo of photos) {
        // 고치기로 들어와 이미 올라가 있는 사진은 다시 올리지 않는다.
        if (photo.path) {
          photoPaths.push(photo.path)
          continue
        }
        const known = uploadedPhotoPathsRef.current.get(photo.id)
        if (known) {
          photoPaths.push(known)
          continue
        }
        if (!photo.file) continue
        // 경로 첫 조각이 room_id여야 Storage RLS를 통과한다.
        const path = `${roomId}/${randomFileId()}.jpg`
        await upload(PHOTO_BUCKET, path, photo.file, 'image/jpeg')
        uploadedPhotoPathsRef.current.set(photo.id, path)
        photoPaths.push(path)
      }

      // 음성
      // 원래 목소리를 그대로 두는 경우에는 올릴 것이 없다.
      let voicePath = voiceIsOriginal && initial ? initial.voice.path : uploadedVoicePathRef.current
      if (!voicePath) {
        voicePath = `${roomId}/${randomFileId()}.${recording.extension}`
        await upload(
          VOICE_BUCKET,
          voicePath,
          recording.blob,
          recording.mimeType,
        )
        uploadedVoicePathRef.current = voicePath
      }

      // 저장. 서버가 마지막으로 값들을 확인한다.
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
        const payload = {
          photoPaths,
          voicePath,
          voiceDurationSec: recording.durationSec,
          // 녹음하면서 이미 잰 값. 저장해 두면 피드가 파일을 안 받고도 파형을 그린다.
          voiceLevels: recording.levels,
          caption: caption.trim() || null,
        }

        const result = initial
          ? await updateMemory({ memoryId: initial.memoryId, ...payload })
          : await createMemory({ roomId, ...payload })

        if (result.ok) break

        // 내용을 고쳐야 하는 문제면 다시 보내봐야 똑같이 막힌다.
        if (!result.retryable || attempt === RETRY_DELAYS_MS.length) {
          // 서버 액션이 이미 한국어로 다듬어 준 문구다. 그대로 보여줘도 된다.
          throw new FriendlyError(result.error)
        }

        setPhase('retrying')
        setNotice(result.error)
        await wait(RETRY_DELAYS_MS[attempt])
      }

      // 저장 성공. 올라간 파일은 이제 게시물의 것이므로 떠날 때 지우면 안 된다.
      committedRef.current = true
      track('upload_complete', { kind: 'photo' })

      /*
        새로 남겼으면 방 피드로(방금 남긴 추억이 맨 위에 보인다),
        고쳤으면 보던 게시물로 돌아간다 — 고치기는 그 글을 보다가 들어온 길이다.
      */
      router.replace(
        initial ? `/rooms/${roomId}/memories/${initial.memoryId}` : `/rooms/${roomId}`,
      )
      router.refresh()
    } catch (submitError) {
      // FriendlyError만 그대로 보여준다. 나머지는 영어 기술 문구라 사람 말로 바꾼다.
      const message =
        submitError instanceof FriendlyError
          ? submitError.message
          : '지금은 표현하지 못했어요. 담으신 것은 그대로 있으니 잠시 후 다시 눌러주세요.'

      if (!(submitError instanceof FriendlyError)) {
        console.error('[마음 표현하기] 저장 실패:', submitError)
      }

      setNotice(null)
      setError(message)
      setPhase('failed')

      /*
        FriendlyError 는 "사람에게 보여줄 만한 이유"라는 뜻일 뿐 종류를 알려주지 않는다.
        ALBUM-02의 30초·50MB 검사를 붙일 때, 그 검사 자리에서 'size'/'duration'을
        직접 보내도록 바꾼다. 지금 추측으로 분류하면 숫자가 거짓말을 한다.
      */
      track('upload_fail', {
        kind: 'photo',
        reason: submitError instanceof FriendlyError ? 'unknown' : 'network',
      })
    }
  }, [
    busy,
    canSubmit,
    caption,
    initial,
    photos,
    recording,
    roomId,
    router,
    upload,
    voiceIsOriginal,
  ])

  return (
    // 캡처 12처럼 [표현하기]가 화면 아래에 고정된다 — 스크롤 칸 + 고정 줄 2단이다.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-screen-x pt-2 pb-screen-b">
          {/*
            사진 타일 줄 (캡처 12·13).
            가로로 넘치면 옆으로 민다 — 여러 줄로 접으면 카드가 아래로 밀려
            "함께 담을 목소리"가 화면 밖으로 나간다.
          */}
          <section aria-label="담을 사진" className="-mx-screen-x">
            {/*
              `overflow-x-auto`는 세로도 함께 잘라낸다(가로만 auto로 둘 수 없다).
              그래서 줄의 위아래 경계에 닿는 테두리·포커스 링·끌기 표시는 깎여 나온다.
              아래쪽은 `pb-2`가, 위쪽은 **타일마다 붙은 `pt-2`**가 그 자리를 만든다.
            */}
            <ul
              ref={photoListRef}
              // 스크롤 막대는 숨긴다(미는 기능은 그대로다). 사진 타일 아래에
              // 회색 줄이 걸쳐 보이면 카드 모양이 지저분해진다.
              className="relative flex gap-3 overflow-x-auto px-screen-x pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {/*
                `pt-2`는 사진 타일과 **같은 값**이어야 한다. 이게 어긋나면
                카메라 타일과 사진 타일의 윗변이 서로 다른 높이에 걸린다.
              */}
              <li className="shrink-0 pt-2">
                {/* [📷 N/10] 타일. label이라 키보드로도 파일 고르기가 열린다. */}
                <label
                  className={[
                    'flex h-[86px] w-[86px] cursor-pointer flex-col items-center justify-center gap-1',
                    'rounded-inner border-2 border-primary bg-card text-primary',
                    'focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-primary',
                    'active:bg-primary-soft',
                    photos.length >= PHOTO_MAX_COUNT || busy
                      ? 'pointer-events-none opacity-60'
                      : '',
                  ].join(' ')}
                >
                  <input
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    multiple
                    disabled={photos.length >= PHOTO_MAX_COUNT || busy}
                    onChange={handlePick}
                    className="sr-only"
                  />
                  <CameraIcon />
                  <span className="text-sm font-extrabold tabular-nums">
                    <span className="sr-only">사진 </span>
                    {photos.length}/{PHOTO_MAX_COUNT}
                  </span>
                </label>
              </li>

              {photos.map((photo, index) => (
                <li
                  key={photo.id}
                  data-photo-tile
                  data-photo-id={photo.id}
                  onPointerDown={(event) => onTilePointerDown(event, photo.id)}
                  className={[
                    // 꾹 누를 때 iOS가 사진 위에 "이미지 저장" 팝업을 띄우지 않게 한다.
                    'relative shrink-0 pt-2 pr-2 select-none [-webkit-touch-callout:none]',
                    // touch-none: 브라우저가 이 타일 위 터치를 먼저 스크롤로 가로채
                    // pointercancel을 보내는 것을 막는다 — 그래야 꾹 눌러 끌기가 안 끊긴다.
                    photos.length > 1 && !busy
                      ? 'touch-none cursor-grab active:cursor-grabbing'
                      : '',
                    draggingId === photo.id ? 'z-10 cursor-grabbing' : '',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'relative h-[86px] w-[86px] overflow-hidden rounded-inner bg-surface-soft',
                      'transition-transform duration-150',
                      // 끌고 있는 칸: 살짝 들리고 옅어져서 "지금 이걸 옮기는 중"이 보인다.
                      draggingId === photo.id
                        ? 'scale-105 opacity-70 shadow-chip outline-2 outline-primary'
                        : '',
                    ].join(' ')}
                  >
                    {/*
                      next/image를 쓰지 않는다. 방금 브라우저에서 만든 data: 주소라
                      최적화 서버가 손댈 것이 없고, 오히려 원격 주소로 오해받는다.
                    */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.preview}
                      alt={`담은 사진 ${index + 1}번째`}
                      draggable={false}
                      className="h-full w-full object-cover"
                    />

                    {/*
                      맨 왼쪽(배열 0번)이 대표 사진이다 (캡처 13). 피드에서 큰 자리에 온다.
                      끌어서 순서를 바꾸면 새로 0번이 된 사진이 저절로 이 배지를 갖는다 —
                      끌기 로직은 배열만 바꾸고 배지는 건드리지 않는다.
                    */}
                    {index === 0 ? (
                      <span className="absolute inset-x-0 bottom-0 bg-ink/85 py-1 text-center text-sm font-extrabold text-white">
                        대표 사진
                      </span>
                    ) : null}
                  </div>

                  {/*
                    × 로 지운다 (캡처 13). 44px 터치 목표를 지키되
                    보이는 동그라미는 타일을 가리지 않게 작게 둔다.
                  */}
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    disabled={busy}
                    aria-label={`${index + 1}번째 사진 빼기`}
                    className="absolute top-0 right-0 flex h-11 w-11 items-center justify-center"
                  >
                    <span
                      aria-hidden
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white shadow-chip"
                    >
                      <CloseIcon />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {picking ? (
              <p role="status" className="px-screen-x text-base text-muted">
                사진을 담는 중이에요…
              </p>
            ) : null}

          </section>

          {/* 함께 담을 목소리 (캡처 12·16·18) */}
          <section aria-labelledby="voice-label" className="flex flex-col gap-2">
            <h2 id="voice-label" className="text-base font-extrabold text-ink">
              함께 담을 목소리
            </h2>
            <VoiceRecorder
              value={recording}
              onChange={handleRecordingChange}
              disabled={busy}
            />
          </section>

          {/* 문구 선택 (캡처 12) — 선택 사항이라 라벨에 그렇게 적어 둔다. */}
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <label
                htmlFor="memory-caption"
                className="text-base font-extrabold text-ink"
              >
                문구 <span className="font-medium text-muted">선택</span>
              </label>
              <span className="shrink-0 tabular-nums text-base text-muted">
                {caption.length}/{CAPTION_MAX_LENGTH}
              </span>
            </div>
            <textarea
              id="memory-caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              maxLength={CAPTION_MAX_LENGTH}
              rows={3}
              disabled={busy}
              placeholder="오늘의 마음을 짧게 남겨보세요"
              className={controlClassName({ className: 'leading-relaxed' })}
            />
          </section>

          {/*
            안내문 (캡처 12). 왜 버튼이 아직 안 켜지는지를 말해준다.
            버튼을 잠가만 두고 이유를 안 적으면 "고장났나" 하고 멈춘다.
          */}
          <p className="text-center text-base break-keep text-muted">
            사진과 음성 녹음을 모두 담아야 표현할 수 있어요
          </p>

          {/*
            고치기로 들어와 원래 목소리를 아직 받아오는 중. 이 동안 [저장하기]가 꺼져 있는데
            이유를 말해주지 않으면 고장으로 읽힌다.
          */}
          {loadingVoice ? (
            <p
              role="status"
              className="rounded-inner bg-surface-soft px-4 py-3 text-base leading-relaxed text-muted"
            >
              담아둔 목소리를 불러오는 중이에요…
            </p>
          ) : null}

          {notice ? (
            <p
              role="status"
              className="rounded-inner bg-surface-soft px-4 py-3 text-base leading-relaxed text-muted"
            >
              {notice}
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-inner bg-primary-soft px-4 py-3 text-base leading-relaxed text-primary"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {/* 아래 고정 줄 (캡처 12 흐림 / 캡처 18 또렷함). */}
      <div className="shrink-0 border-t border-hairline bg-card px-screen-x py-3">
        <div className="mx-auto w-full max-w-md">
          <Button
            onClick={submit}
            fullWidth
            disabled={!canSubmit}
            pending={busy}
            pendingText={phase === 'retrying' ? '다시 담는 중…' : '담는 중…'}
          >
            <HeartIcon />
            {phase === 'failed'
              ? editing
                ? '다시 저장하기'
                : '다시 표현하기'
              : editing
                ? '저장하기'
                : '표현하기'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function CameraIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 8.5h3l1.4-2h7.2L17 8.5h3v10H4z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3.2}
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 20.5S3.5 15.2 3.5 9.4A4.9 4.9 0 0 1 12 6a4.9 4.9 0 0 1 8.5 3.4c0 5.8-8.5 11.1-8.5 11.1Z" />
    </svg>
  )
}
