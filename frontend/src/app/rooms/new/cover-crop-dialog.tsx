'use client'

import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/Button'

/**
 * 커버사진 자르기 (캡처 07 + iOS 사진 앱 자르기 방식).
 *
 * "앨범방 규격에 맞게 사진 크기를 조절해 주세요" — 사용자가 고른 사진을
 * 홈 카드 커버 비율에 맞춰 자른다. 자르기는 **브라우저에서** 끝내고
 * 서버로는 이미 잘린 작은 그림만 보낸다. 원본을 그대로 올리면
 * Server Action 본문 제한(1MB)에 쉽게 걸리고 저장 용량도 낭비된다.
 *
 * 조작 방식(2026-08-10 변경): 사진 전체를 보여주고 그 위에 **자르는 틀**을 얹는다.
 * - 틀 모서리·변의 흰 손잡이를 끌면 틀이 커지고 작아진다(2:1 비율은 항상 유지).
 * - 틀 밖 사진은 어둡게 덮어 어디가 잘릴지 한눈에 보이게 한다.
 * - 사진 위를 끌면 사진이 움직이고, 휠·두 손가락으로 확대·축소한다.
 * 이전의 세로 배율 막대는 없앴다 — 틀 크기 자체가 "얼마나 넓게 담을지"를 정한다.
 *
 * 왜 <dialog>인가: 초점 가두기, Esc로 닫기, 뒤 화면 비활성이 브라우저에 이미 들어 있다.
 * 직접 만들면 그 셋을 다 놓치기 쉽다.
 */

/** 홈 카드 커버의 비율(가로/세로). RoomCard의 h-[158px] 커버와 같은 모양이다. */
const COVER_ASPECT = 2

/** 저장할 크기. 이 정도면 큰 화면에서도 선명하고 파일은 200KB 안쪽이다. */
const OUTPUT_WIDTH = 1200
const OUTPUT_HEIGHT = OUTPUT_WIDTH / COVER_ASPECT

/** 배율 1 = 사진 한 장이 무대에 딱 들어오는 크기. 그보다 작게는 줄이지 않는다. */
const MIN_ZOOM = 1
const MAX_ZOOM = 3

/** 틀의 최소 가로(px). 이보다 작으면 손잡이끼리 붙어 잡을 수가 없다. */
const MIN_CROP_WIDTH = 72

/** 화살표 키로 한 번에 옮길 거리(px). 키보드만으로도 자리를 잡을 수 있어야 한다. */
const KEY_PAN_STEP = 12
/** +, − 키로 한 번에 바꿀 틀 가로(px). */
const KEY_RESIZE_STEP = 16

type Point = { x: number; y: number }
type Size = { w: number; h: number }
type Rect = { x: number; y: number; w: number; h: number }

/** 자르는 틀. 높이는 언제나 w / COVER_ASPECT라 따로 담지 않는다. */
type Crop = { x: number; y: number; w: number }

/** 손잡이 8개. n·s·e·w는 변, 두 글자는 모서리다. */
type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

/**
 * 손잡이의 자리. **변을 먼저, 모서리를 나중에** 적는다.
 *
 * 잡는 자리가 44px이라 틀이 작아지면 변과 모서리의 잡는 자리가 겹친다.
 * 겹친 자리는 나중에 그려진 쪽이 이기므로, 모서리를 뒤에 두어 모서리가 이기게 했다 —
 * 모서리는 가로·세로를 한 번에 정하는 손잡이라 작은 틀에서 더 자주 쓴다.
 */
const HANDLES: { id: HandleId; x: string; y: string; cursor: string }[] = [
  { id: 'n', x: '50%', y: '0%', cursor: 'ns-resize' },
  { id: 'w', x: '0%', y: '50%', cursor: 'ew-resize' },
  { id: 'e', x: '100%', y: '50%', cursor: 'ew-resize' },
  { id: 's', x: '50%', y: '100%', cursor: 'ns-resize' },
  { id: 'nw', x: '0%', y: '0%', cursor: 'nwse-resize' },
  { id: 'ne', x: '100%', y: '0%', cursor: 'nesw-resize' },
  { id: 'sw', x: '0%', y: '100%', cursor: 'nesw-resize' },
  { id: 'se', x: '100%', y: '100%', cursor: 'nwse-resize' },
]

function clamp(value: number, low: number, high: number) {
  if (high < low) return (low + high) / 2
  return Math.min(high, Math.max(low, value))
}

/** 무대 안에서 사진이 실제로 차지하는 자리. */
function getImageRect(stage: Size, natural: Size, scale: number, offset: Point): Rect {
  const w = natural.w * scale
  const h = natural.h * scale
  return {
    x: stage.w / 2 + offset.x - w / 2,
    y: stage.h / 2 + offset.y - h / 2,
    w,
    h,
  }
}

/**
 * 틀이 놓일 수 있는 영역 = 사진과 무대가 겹치는 부분.
 *
 * 사진 밖으로 나간 틀은 빈칸이 찍히고, 무대 밖으로 나간 틀은 보이지 않는다.
 * 두 조건을 하나의 상자로 합쳐 두면 이후 계산이 전부 "이 상자 안에서"로 끝난다.
 */
function getAllowedBox(stage: Size, image: Rect): Rect {
  const left = Math.max(0, image.x)
  const top = Math.max(0, image.y)
  const right = Math.min(stage.w, image.x + image.w)
  const bottom = Math.min(stage.h, image.y + image.h)
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) }
}

/** 틀을 상자 안으로 밀어 넣는다. 비율은 건드리지 않는다. */
function clampCrop(crop: Crop, box: Rect): Crop {
  const maxWidth = Math.max(1, Math.min(box.w, box.h * COVER_ASPECT))
  const w = clamp(crop.w, Math.min(MIN_CROP_WIDTH, maxWidth), maxWidth)
  const h = w / COVER_ASPECT
  return {
    x: clamp(crop.x, box.x, box.x + box.w - w),
    y: clamp(crop.y, box.y, box.y + box.h - h),
    w,
  }
}

/** 사진이 틀을 덮은 채로 있도록 이동량을 가둔다. */
function clampOffset(
  offset: Point,
  crop: Crop,
  stage: Size,
  natural: Size,
  scale: number,
): Point {
  const displayWidth = natural.w * scale
  const displayHeight = natural.h * scale
  const cropHeight = crop.w / COVER_ASPECT
  return {
    x: clamp(
      offset.x,
      crop.x + crop.w - stage.w / 2 - displayWidth / 2,
      crop.x - stage.w / 2 + displayWidth / 2,
    ),
    y: clamp(
      offset.y,
      crop.y + cropHeight - stage.h / 2 - displayHeight / 2,
      crop.y - stage.h / 2 + displayHeight / 2,
    ),
  }
}

/** 지금 틀을 덮으려면 최소 얼마나 확대해야 하는가. */
function getMinZoom(crop: Crop, natural: Size, fitScale: number): number {
  const needed = Math.max(
    crop.w / (natural.w * fitScale),
    crop.w / COVER_ASPECT / (natural.h * fitScale),
  )
  return Math.max(MIN_ZOOM, needed)
}

/** 사진이 무대에 처음 들어왔을 때의 틀 — 사진 안에 들어가는 가장 큰 2:1 사각형. */
function getInitialCrop(stage: Size, natural: Size, fitScale: number): Crop {
  const displayWidth = natural.w * fitScale
  const displayHeight = natural.h * fitScale
  const w = Math.min(displayWidth, displayHeight * COVER_ASPECT)
  return { x: (stage.w - w) / 2, y: (stage.h - w / COVER_ASPECT) / 2, w }
}

/**
 * 손잡이를 끈 결과의 새 틀.
 *
 * 2:1 고정이라 손잡이 하나가 가로·세로를 동시에 정한다. 잡은 손잡이의
 * **맞은편 변(또는 모서리)은 고정**하고, 손이 간 거리에서 가로를 뽑은 뒤
 * 비율로 세로를 만든다. 변 손잡이는 반대 축을 가운데 기준으로 늘린다.
 */
function resizeCrop(handle: HandleId, pointer: Point, crop: Crop, box: Rect): Crop {
  const height = crop.w / COVER_ASPECT
  const right = crop.x + crop.w
  const bottom = crop.y + height
  const centerX = crop.x + crop.w / 2
  const centerY = crop.y + height / 2

  const horizontal = handle.includes('w') ? 'w' : handle.includes('e') ? 'e' : null
  const vertical = handle.includes('n') ? 'n' : handle.includes('s') ? 's' : null

  // 손이 간 거리에서 나온 가로 후보들 — 모서리는 둘 중 큰 쪽을 따른다.
  const candidates: number[] = []
  if (horizontal === 'e') candidates.push(pointer.x - crop.x)
  if (horizontal === 'w') candidates.push(right - pointer.x)
  if (vertical === 's') candidates.push((pointer.y - crop.y) * COVER_ASPECT)
  if (vertical === 'n') candidates.push((bottom - pointer.y) * COVER_ASPECT)

  const maxFromX =
    horizontal === 'e'
      ? box.x + box.w - crop.x
      : horizontal === 'w'
        ? right - box.x
        : 2 * Math.min(centerX - box.x, box.x + box.w - centerX)
  const maxFromY =
    (vertical === 's'
      ? box.y + box.h - crop.y
      : vertical === 'n'
        ? bottom - box.y
        : 2 * Math.min(centerY - box.y, box.y + box.h - centerY)) * COVER_ASPECT

  const maxWidth = Math.max(1, Math.min(maxFromX, maxFromY))
  const w = clamp(Math.max(...candidates), Math.min(MIN_CROP_WIDTH, maxWidth), maxWidth)
  const h = w / COVER_ASPECT

  const x = horizontal === 'e' ? crop.x : horizontal === 'w' ? right - w : centerX - w / 2
  const y = vertical === 's' ? crop.y : vertical === 'n' ? bottom - h : centerY - h / 2

  // 반올림 오차로 상자를 반 픽셀 넘는 일이 있어 마지막에 한 번 더 가둔다.
  return clampCrop({ x, y, w }, box)
}

export function CoverCropDialog({
  file,
  onCancel,
  onConfirm,
}: {
  /** 사용자가 고른 원본 파일. */
  file: File
  onCancel: () => void
  /** 잘라낸 결과. 그대로 폼에 실어 보낸다. */
  onConfirm: (cropped: File, previewUrl: string) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const [natural, setNatural] = useState<Size | null>(null)
  const [stage, setStage] = useState<Size | null>(null)
  /** 사용자가 손댄 틀. 비어 있으면 "아직 기본값"이라는 뜻이다(아래에서 계산한다). */
  const [cropState, setCrop] = useState<Crop | null>(null)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [rawOffset, setRawOffset] = useState<Point>({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const [dataUrl, setDataUrl] = useState('')

  /*
    고른 파일을 화면에 띄울 주소로 바꾼다.

    URL.createObjectURL을 쓰지 않는다. 그 방식은 "다 쓰면 반납"이 필요한데,
    개발 모드(StrictMode)에서는 effect가 마운트→정리→마운트로 두 번 도는 탓에
    첫 정리가 주소를 반납해 버리고, 두 번째 마운트는 이미 죽은 주소를 들고 있게 된다.
    실제로 그래서 사진이 안 뜨고 "불러오지 못했어요"가 떴다.

    FileReader는 반납할 것이 없고 effect가 다시 돌면 다시 읽는다.
    setState가 effect 안에 있지만 **읽기가 끝난 뒤 콜백에서** 부르는 것이라
    (동기 setState가 아니라) 권장되는 방식 그대로다.
  */
  useEffect(() => {
    let cancelled = false
    const reader = new FileReader()

    reader.onload = () => {
      if (!cancelled) setDataUrl(String(reader.result))
    }
    reader.onerror = () => {
      if (!cancelled) setFailed(true)
    }
    reader.readAsDataURL(file)

    return () => {
      cancelled = true
      reader.abort()
    }
  }, [file])

  // 열릴 때 modal로 띄운다. showModal이라야 초점이 갇히고 뒤 화면이 잠긴다.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()
  }, [])

  /*
    무대(사진이 놓이는 칸)의 실제 크기를 잰다. 기기 폭에 따라 달라지므로 값으로 박지 않는다.
    가로가 바뀌면 틀과 이동량도 같은 비율로 늘리거나 줄인다 — 그러지 않으면
    화면을 돌렸을 때 틀만 제자리에 남아 엉뚱한 곳을 가리킨다.
  */
  const measuredWidthRef = useRef(0)
  useEffect(() => {
    const element = stageRef.current
    if (!element) return

    const measure = () => {
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0) return

      const previous = measuredWidthRef.current
      if (previous > 0 && rect.width !== previous) {
        const ratio = rect.width / previous
        setCrop((current) =>
          current
            ? { x: current.x * ratio, y: current.y * ratio, w: current.w * ratio }
            : current,
        )
        setRawOffset((current) => ({ x: current.x * ratio, y: current.y * ratio }))
      }
      measuredWidthRef.current = rect.width
      setStage({ w: rect.width, h: rect.height })
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  /** 사진 한 장이 무대에 통째로 들어오는 배율. 여기서부터 확대해 나간다. */
  const fitScale =
    natural && stage ? Math.min(stage.w / natural.w, stage.h / natural.h) : 1

  /*
    지금 쓰는 틀. 아직 손대지 않았으면(cropState가 비었으면) 그 자리에서 계산해 쓴다.

    effect로 "처음 값"을 넣지 않는 이유: 사진 크기와 무대 크기를 알게 된 순간
    한 번 더 그려야 하고, 사진이 바뀌거나 화면을 돌릴 때마다 "언제 초기화할지"를
    또 따져야 한다. 손대기 전까지는 계산으로 두면 그 문제가 통째로 사라진다.
  */
  const crop =
    cropState ?? (natural && stage ? getInitialCrop(stage, natural, fitScale) : null)

  /*
    실제로 쓰는 값들. 상태에는 손이 움직인 그대로를 담고, 한계 안으로 넣는 일은
    그릴 때마다 여기서 한다. 배율이 바뀌면 한계도 같이 바뀌는데, 그때마다 effect로
    상태를 고치면 그림이 한 번 더 그려진다. 계산으로 끝낼 수 있는 일에 상태를 쓰지 않는다.
  */
  const minZoom = crop && natural ? getMinZoom(crop, natural, fitScale) : MIN_ZOOM
  const safeZoom = clamp(zoom, minZoom, Math.max(minZoom, MAX_ZOOM))
  const scale = fitScale * safeZoom
  const displayWidth = natural ? natural.w * scale : 0
  const displayHeight = natural ? natural.h * scale : 0

  const offset =
    crop && natural && stage
      ? clampOffset(rawOffset, crop, stage, natural, scale)
      : rawOffset

  const imageRect =
    natural && stage ? getImageRect(stage, natural, scale, offset) : null
  const allowedBox = stage && imageRect ? getAllowedBox(stage, imageRect) : null

  /** 무대 왼쪽 위를 원점으로 한 좌표. 손잡이 계산은 전부 이 좌표계에서 한다. */
  function toStagePoint(clientX: number, clientY: number): Point {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return { x: clientX, y: clientY }
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  /** 화면의 한 점을 붙잡은 채 확대·축소한다(휠·핀치 공통). */
  function applyZoom(nextZoom: number, focus: Point) {
    if (!natural || !stage || !crop) return
    const target = clamp(nextZoom, minZoom, Math.max(minZoom, MAX_ZOOM))
    const nextScale = fitScale * target
    const k = nextScale / scale
    const moved = {
      x: focus.x - stage.w / 2 - (focus.x - stage.w / 2 - offset.x) * k,
      y: focus.y - stage.h / 2 - (focus.y - stage.h / 2 - offset.y) * k,
    }
    setZoom(target)
    setRawOffset(clampOffset(moved, crop, stage, natural, nextScale))
  }

  /*
    무대 위 손가락·마우스. pointer 이벤트 하나로 둘 다 처리된다.
    손가락이 둘이면 핀치(확대·축소), 하나면 사진 옮기기다.
  */
  const pointersRef = useRef(new Map<number, Point>())
  const panRef = useRef<Point | null>(null)
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null)

  /** 손가락이 늘거나 줄 때마다 기준점을 다시 잡는다. 안 그러면 값이 튄다. */
  function syncGesture() {
    const points = [...pointersRef.current.values()]
    if (points.length >= 2) {
      pinchRef.current = {
        distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
        zoom: safeZoom,
      }
      panRef.current = null
      return
    }
    pinchRef.current = null
    panRef.current =
      points.length === 1
        ? { x: points[0].x - offset.x, y: points[0].y - offset.y }
        : null
  }

  function handleStagePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!natural) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture(event.pointerId)
    syncGesture()
  }

  function handleStagePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return
    if (!natural || !stage || !crop) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const points = [...pointersRef.current.values()]
    const pinch = pinchRef.current
    if (points.length >= 2 && pinch && pinch.distance > 0) {
      const distance = Math.hypot(
        points[0].x - points[1].x,
        points[0].y - points[1].y,
      )
      const focus = toStagePoint(
        (points[0].x + points[1].x) / 2,
        (points[0].y + points[1].y) / 2,
      )
      applyZoom(pinch.zoom * (distance / pinch.distance), focus)
      return
    }

    const pan = panRef.current
    if (!pan) return
    setRawOffset(
      clampOffset(
        { x: event.clientX - pan.x, y: event.clientY - pan.y },
        crop,
        stage,
        natural,
        scale,
      ),
    )
  }

  function handleStagePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId)
    syncGesture()
  }

  /*
    휠(트랙패드 두 손가락 포함) 확대·축소.

    React의 onWheel은 passive로 붙어서 preventDefault가 먹지 않는다 —
    그대로 두면 확대하는 동안 뒤 페이지가 같이 스크롤된다. 그래서 직접 붙인다.
    최신 값이 필요하지만 매 렌더 다시 붙일 이유는 없어, 함수만 ref에 갈아 끼운다.
  */
  const wheelRef = useRef<(event: WheelEvent) => void>(() => {})
  useEffect(() => {
    wheelRef.current = (event: WheelEvent) => {
      if (!natural || !crop) return
      event.preventDefault()
      const focus = toStagePoint(event.clientX, event.clientY)
      applyZoom(safeZoom * Math.exp(-event.deltaY * 0.0015), focus)
    }
  })
  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const listener = (event: WheelEvent) => wheelRef.current(event)
    element.addEventListener('wheel', listener, { passive: false })
    return () => element.removeEventListener('wheel', listener)
  }, [])

  /*
    손잡이 끌기. 손잡이가 pointer를 붙잡으므로 무대의 옮기기와 섞이지 않는다.
    (누를 때 stopPropagation을 해서 무대가 아예 이 손가락을 등록하지 않는다.)
  */
  const resizeRef = useRef<{ id: number; handle: HandleId } | null>(null)

  function handleResizeStart(
    event: React.PointerEvent<HTMLDivElement>,
    handle: HandleId,
  ) {
    if (!crop) return
    event.preventDefault()
    event.stopPropagation()
    resizeRef.current = { id: event.pointerId, handle }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleResizeMove(event: React.PointerEvent<HTMLDivElement>) {
    const active = resizeRef.current
    if (!active || active.id !== event.pointerId) return
    if (!crop || !allowedBox) return
    event.stopPropagation()
    const pointer = toStagePoint(event.clientX, event.clientY)
    setCrop(resizeCrop(active.handle, pointer, crop, allowedBox))
  }

  function handleResizeEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (resizeRef.current?.id === event.pointerId) resizeRef.current = null
  }

  /*
    키보드만으로도 자리와 크기를 잡을 수 있어야 한다.
    화살표는 사진 옮기기, + / − 는 틀 크기다.
  */
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!natural || !stage || !crop) return

    const moves: Record<string, Point> = {
      ArrowUp: { x: 0, y: KEY_PAN_STEP },
      ArrowDown: { x: 0, y: -KEY_PAN_STEP },
      ArrowLeft: { x: KEY_PAN_STEP, y: 0 },
      ArrowRight: { x: -KEY_PAN_STEP, y: 0 },
    }
    const move = moves[event.key]
    if (move) {
      event.preventDefault()
      setRawOffset(
        clampOffset(
          { x: offset.x + move.x, y: offset.y + move.y },
          crop,
          stage,
          natural,
          scale,
        ),
      )
      return
    }

    const grow = event.key === '+' || event.key === '=' ? 1 : 0
    const shrink = event.key === '-' || event.key === '_' ? 1 : 0
    if (!grow && !shrink) return
    event.preventDefault()
    if (!allowedBox) return
    const delta = (grow - shrink) * KEY_RESIZE_STEP
    // 가운데를 붙잡고 키운다 — 눈이 보고 있는 지점이 그대로 남는다.
    setCrop(
      clampCrop(
        {
          x: crop.x - delta / 2,
          y: crop.y - delta / COVER_ASPECT / 2,
          w: crop.w + delta,
        },
        allowedBox,
      ),
    )
  }

  /** 틀과 사진을 처음 상태로 되돌린다(참고: 사진 앱의 "재설정"). */
  function handleReset() {
    setZoom(MIN_ZOOM)
    setRawOffset({ x: 0, y: 0 })
    setCrop(null)
  }

  /** 틀 안에 보이는 그대로를 그림 파일로 굽는다. */
  async function handleConfirm() {
    const image = imageRef.current
    if (!image || !natural || !stage || !crop || !imageRect || busy) return

    setBusy(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_WIDTH
      canvas.height = OUTPUT_HEIGHT
      const context = canvas.getContext('2d')
      if (!context) throw new Error('canvas 2d context를 못 얻었다')

      /*
        틀은 무대 좌표에 있고, 잘라야 할 곳은 원본 사진 좌표에 있다.
        사진의 왼쪽 위가 무대의 어디에 있는지(imageRect)를 빼고 배율로 나누면
        곧바로 원본 좌표가 된다. 반올림 오차로 원본 밖을 가리키는 일이 없도록 가둔다.
      */
      const sourceWidth = Math.min(crop.w / scale, natural.w)
      const sourceHeight = Math.min(crop.w / COVER_ASPECT / scale, natural.h)
      const sourceX = clamp(
        (crop.x - imageRect.x) / scale,
        0,
        natural.w - sourceWidth,
      )
      const sourceY = clamp(
        (crop.y - imageRect.y) / scale,
        0,
        natural.h - sourceHeight,
      )

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        OUTPUT_WIDTH,
        OUTPUT_HEIGHT,
      )

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85),
      )
      if (!blob) throw new Error('toBlob이 비었다')

      const cropped = new File([blob], 'cover.jpg', { type: 'image/jpeg' })
      onConfirm(cropped, canvas.toDataURL('image/jpeg', 0.7))
    } catch (error) {
      console.error('[커버 자르기] 실패:', error)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const cropHeight = crop ? crop.w / COVER_ASPECT : 0

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cover-crop-title"
      // Esc를 눌렀을 때도 부모가 알아야 파일 선택 상태가 정리된다.
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      /*
        전체화면 편집기. <dialog>의 기본 여백·최대크기(margin auto, max-width/height)를
        전부 풀어야 화면을 꽉 채운다. 높이는 dvh — 모바일 주소창이 접혔다 펴져도 어긋나지 않는다.
        전체화면이어도 showModal이 준 초점 가두기·Esc는 그대로다(크기와 무관한 기능이다).
      */
      className="m-0 h-dvh max-h-none w-screen max-w-none rounded-none border-0 bg-black p-0 text-white backdrop:bg-black"
    >
      <div className="flex h-full flex-col">
        {/*
          위 도구줄 (참고 이미지와 같은 자리): 왼쪽 취소 · 가운데 제목 · 오른쪽 재설정.

          여기만 Button 부품을 쓰지 않았다. primary 도 secondary(흰 바탕)도
          검정 위에 놓으라고 만든 색이 아니다. 대신 흰 글자로 대비를 최대로 하고,
          부품이 지키던 것(글자 17px·터치 목표 44px)은 그대로 지킨다.
        */}
        <div className="flex shrink-0 items-center justify-between gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-chip px-4 text-base font-extrabold text-white active:bg-white/15"
          >
            취소
          </button>
          <h2 id="cover-crop-title" className="text-base font-extrabold text-white">
            커버사진 선택
          </h2>
          <button
            type="button"
            onClick={handleReset}
            disabled={!natural || failed}
            className="min-h-[44px] rounded-chip px-4 text-base font-extrabold text-white active:bg-white/15 disabled:opacity-50"
          >
            재설정
          </button>
        </div>

        {/*
          안내 한 줄. 아이콘만으로는 무엇을 하는 화면인지 알기 어렵다 —
          처음 쓰는 시니어 사용자에게는 이 한 줄이 화면 전체의 설명이다.
        */}
        <p className="shrink-0 px-4 pt-1 pb-3 text-center text-base break-keep text-white/75">
          밝은 틀 안이 커버가 돼요. 흰 손잡이를 끌어 크기를 정해 주세요.
        </p>

        {failed ? (
          // 검정 위라 글자색만 바꾸면 안 보인다. primary 바탕 + 흰 글자는 버튼과 같은 조합이다.
          <p
            role="alert"
            className="mx-4 mb-2 shrink-0 rounded-inner bg-primary px-3 py-2 text-center text-base break-keep text-white"
          >
            사진을 불러오지 못했어요. 다른 사진으로 다시 시도해 주세요.
          </p>
        ) : null}

        {/*
          무대. 남는 자리를 통째로 쓴다(flex-1). 사진 한 장이 여기 통째로 들어오고
          그 위에 자르는 틀이 얹힌다. 비율을 값으로 박지 않으므로 기기 화면이 세로로
          길면 무대도 길어지고, 틀도 그만큼 커진다.
          min-h-0: flex 자식은 기본이 "내용보다 작아지지 않음"이라 이걸 풀어야 남는 자리에 맞춰진다.

          tabIndex=0 + 화살표/＋/− 키: 끌 수 없는 환경에서도 자리와 크기를 잡을 수 있어야 한다.
        */}
        <div
          ref={stageRef}
          role="group"
          aria-label="커버 자르기 (화살표 키로 사진 옮기기, + − 키로 틀 크기 조절)"
          tabIndex={0}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
          onPointerCancel={handleStagePointerUp}
          onKeyDown={handleKeyDown}
          className="relative min-h-0 w-full flex-1 cursor-grab touch-none overflow-hidden bg-black select-none active:cursor-grabbing"
        >
          {dataUrl ? (
            // 원본을 그대로 보여주고 CSS로만 옮긴다. 미리보기 단계에서 canvas를 쓸 이유가 없다.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imageRef}
              src={dataUrl}
              alt=""
              draggable={false}
              onLoad={(event) => {
                const element = event.currentTarget
                setNatural({ w: element.naturalWidth, h: element.naturalHeight })
                // 다른 사진으로 바뀌었을 수도 있다. 틀은 새로 놓는다.
                setCrop(null)
                setZoom(MIN_ZOOM)
                setRawOffset({ x: 0, y: 0 })
              }}
              onError={() => setFailed(true)}
              style={{
                width: displayWidth || undefined,
                height: displayHeight || undefined,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              }}
              className="absolute top-1/2 left-1/2 max-w-none"
            />
          ) : null}

          {crop ? (
            /*
              자르는 틀. 바깥을 어둡게 덮는 일은 아주 넓게 퍼뜨린 그림자 하나로 끝낸다 —
              덮개를 네 조각으로 나눠 놓으면 틀이 움직일 때마다 네 개를 다 고쳐야 한다.
              (흰색·반투명 검정은 크롭 UI의 관례색이라 토큰에 두지 않았다.)
            */
            <div
              style={{
                left: crop.x,
                top: crop.y,
                width: crop.w,
                height: cropHeight,
              }}
              className="pointer-events-none absolute border border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
            >
              {/* 삼분할 구도선. 어디를 가운데 둘지 가늠하는 눈금이다. */}
              <div aria-hidden className="absolute inset-0">
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
              </div>

              {/* 모서리 갈고리와 변 가운데 막대 — 여기를 잡으라는 표시다. */}
              <div aria-hidden className="absolute inset-0">
                <div className="absolute -top-px -left-px h-5 w-5 border-t-[3px] border-l-[3px] border-white" />
                <div className="absolute -top-px -right-px h-5 w-5 border-t-[3px] border-r-[3px] border-white" />
                <div className="absolute -bottom-px -left-px h-5 w-5 border-b-[3px] border-l-[3px] border-white" />
                <div className="absolute -right-px -bottom-px h-5 w-5 border-r-[3px] border-b-[3px] border-white" />
                <div className="absolute -top-px left-1/2 h-[3px] w-7 -translate-x-1/2 bg-white" />
                <div className="absolute -bottom-px left-1/2 h-[3px] w-7 -translate-x-1/2 bg-white" />
                <div className="absolute top-1/2 -left-px h-7 w-[3px] -translate-y-1/2 bg-white" />
                <div className="absolute top-1/2 -right-px h-7 w-[3px] -translate-y-1/2 bg-white" />
              </div>

              {/*
                잡는 자리는 보이는 표시(갈고리 20px·막대 28px)와 따로 둔다.
                눈에 보이지 않는 44×44 정사각형을 표시 위에 겹쳐서, 모양은 참고 이미지대로
                가늘게 두면서 손가락이 닿는 넓이는 프로젝트 기준(44px)을 지킨다.
                시니어 사용자가 주요 대상이라 이 값은 깎지 않는다.
              */}
              {HANDLES.map((handle) => (
                <div
                  key={handle.id}
                  onPointerDown={(event) => handleResizeStart(event, handle.id)}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                  onPointerCancel={handleResizeEnd}
                  style={{ left: handle.x, top: handle.y, cursor: handle.cursor }}
                  className="pointer-events-auto absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-none"
                />
              ))}
            </div>
          ) : null}
        </div>

        {/*
          확정은 아래 고정 (참고 이미지의 "완료" 자리). 되돌릴 수 없는 확정 동작이라
          Button 기본 크기(lg, 52px)를 그대로 쓴다. 아래 여백은 홈 인디케이터를 피한다.
        */}
        <div className="shrink-0 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            fullWidth
            onClick={handleConfirm}
            disabled={!natural || failed}
            pending={busy}
            pendingText="담는 중…"
          >
            선택
          </Button>
        </div>
      </div>
    </dialog>
  )
}
