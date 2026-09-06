/**
 * 손글씨 (WRITE-01) 와 타임랩스 재생 (WRITE-02) 의 자료 모양과 규칙.
 *
 * **저장은 획 좌표다** (사용자 결정 2026-09-06 — 나중에 못 바꾼다). 그림(PNG)이 아니라
 * 획마다 점의 위치와 **시각**을 남긴다. 그래야 "쓰는 과정"을 다시 돌릴 수 있다 —
 * 핵심 축 ③ 살아있는 현장감이 여기 걸려 있다.
 *
 * 파일은 handwriting 버킷의 `{room_id}/{id}.json` 이고 DB(memories.handwriting_path)는
 * 경로만 든다. 목소리(voice_path)와 정확히 같은 구조라 RLS·서명 URL·삭제 흐름을 그대로 쓴다.
 *
 * 화면과 무관한 것만 여기 둔다 — 서버(검증)와 브라우저(쓰기·재생)가 같이 부른다.
 */

/** 캔버스의 논리 좌표계. 4:3 가로 (사용자 결정). 화면 크기와 무관하게 이 안에서 잰다. */
export const HANDWRITING_W = 800
export const HANDWRITING_H = 600

/** 펜 굵기(논리 px). 검정 한 색·굵기 고정 (사용자 결정). */
export const HANDWRITING_PEN_WIDTH = 4

/** 한 장에 담을 수 있는 점의 상한. 1분을 꾹꾹 눌러 써도 1만 점 안팎이다. 파일 2MB 상한과 맞물린다. */
export const HANDWRITING_MAX_POINTS = 20_000

/** 쓰기 시간 상한(ms). DB CHECK(memories_handwriting_pair)와 같은 값 — 바꾸려면 둘 다. */
export const HANDWRITING_MAX_DURATION_MS = 600_000

/** 타임랩스는 아무리 길게 썼어도 이 안에 다 그려진다 (사용자 결정: 최대 4초). */
export const HANDWRITING_PLAYBACK_MAX_MS = 4_000

/** 획과 획 사이 멈춘 시간(생각하던 시간)은 재생할 때 이만큼으로 줄인다. */
export const HANDWRITING_PAUSE_CAP_MS = 300

export const HANDWRITING_BUCKET = 'handwriting'

/** [x, y, dt] — 획 시작으로부터 dt ms 뒤에 (x, y). 첫 점의 dt 는 0. */
export type HandwritingPoint = [number, number, number]

export type HandwritingStroke = {
  /** 이 획이 시작된 시각(ms). 첫 획의 시작이 0 이다. */
  t: number
  p: HandwritingPoint[]
}

export type HandwritingDoc = {
  v: 1
  w: number
  h: number
  strokes: HandwritingStroke[]
  /** 첫 획 시작부터 마지막 점까지(ms). DB 의 handwriting_duration_ms 와 같은 값. */
  durationMs: number
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * 파일에서 읽은 것이 우리가 아는 모양인지.
 * 서버가 저장하기 전에도, 브라우저가 재생하기 전에도 부른다 — 결국 사용자가 올린 파일이다.
 */
export function isHandwritingDoc(value: unknown): value is HandwritingDoc {
  if (!value || typeof value !== 'object') return false
  const doc = value as Record<string, unknown>
  if (doc.v !== 1) return false
  if (doc.w !== HANDWRITING_W || doc.h !== HANDWRITING_H) return false
  if (!isFiniteNumber(doc.durationMs) || doc.durationMs < 0) return false
  if (doc.durationMs > HANDWRITING_MAX_DURATION_MS) return false
  if (!Array.isArray(doc.strokes) || doc.strokes.length === 0) return false

  let points = 0
  for (const stroke of doc.strokes as unknown[]) {
    if (!stroke || typeof stroke !== 'object') return false
    const s = stroke as Record<string, unknown>
    if (!isFiniteNumber(s.t) || s.t < 0) return false
    if (!Array.isArray(s.p) || s.p.length === 0) return false
    for (const point of s.p as unknown[]) {
      if (!Array.isArray(point) || point.length !== 3) return false
      const [x, y, dt] = point as unknown[]
      if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(dt)) return false
      if (x < 0 || x > HANDWRITING_W || y < 0 || y > HANDWRITING_H || dt < 0) return false
      points += 1
      if (points > HANDWRITING_MAX_POINTS) return false
    }
  }
  return true
}

/** 획 하나를 SVG path 의 d 로. 점 하나짜리(톡 찍은 점)는 아주 짧은 선으로 그려 round cap 이 점을 만든다. */
export function strokePath(stroke: HandwritingStroke): string {
  const [first] = stroke.p
  if (!first) return ''
  if (stroke.p.length === 1) {
    return `M ${first[0]} ${first[1]} L ${first[0] + 0.01} ${first[1]}`
  }
  let d = `M ${first[0]} ${first[1]}`
  for (let i = 1; i < stroke.p.length; i += 1) {
    d += ` L ${stroke.p[i][0]} ${stroke.p[i][1]}`
  }
  return d
}

export type PlaybackPoint = {
  x: number
  y: number
  /** 재생 시작으로부터 이 점이 그려져야 하는 시각(ms). 압축된 값이다. */
  at: number
  strokeIndex: number
  /** 획의 첫 점이면 true — 재생기가 펜을 떼었다 다시 댄다. */
  first: boolean
}

/**
 * 재생용 시간표. 두 단계로 줄인다.
 *  1. 획 사이의 멈춤(생각하던 시간)은 HANDWRITING_PAUSE_CAP_MS 로 자른다.
 *  2. 그래도 전체가 HANDWRITING_PLAYBACK_MAX_MS 를 넘으면 비례해서 눌러 담는다.
 * 짧게 쓴 것은 실제 속도 그대로, 길게 쓴 것은 4초 안에 다 지나간다.
 */
export function playbackTimeline(doc: HandwritingDoc): {
  points: PlaybackPoint[]
  totalMs: number
} {
  const points: PlaybackPoint[] = []
  let offset = 0 // 멈춤을 잘라낸 만큼 앞당겨진 시간
  let prevEnd: number | null = null

  doc.strokes.forEach((stroke, strokeIndex) => {
    let start = stroke.t
    if (prevEnd !== null) {
      const pause = stroke.t - prevEnd
      if (pause > HANDWRITING_PAUSE_CAP_MS) {
        offset += pause - HANDWRITING_PAUSE_CAP_MS
      }
    }
    start -= offset

    let last = start
    stroke.p.forEach(([x, y, dt], index) => {
      const at = start + Math.max(0, dt)
      last = Math.max(last, at)
      points.push({ x, y, at, strokeIndex, first: index === 0 })
    })
    prevEnd = stroke.t + Math.max(0, stroke.p[stroke.p.length - 1]?.[2] ?? 0)
    void last
  })

  const rawTotal = points.length > 0 ? Math.max(...points.map((p) => p.at)) : 0
  if (rawTotal > HANDWRITING_PLAYBACK_MAX_MS && rawTotal > 0) {
    const scale = HANDWRITING_PLAYBACK_MAX_MS / rawTotal
    for (const p of points) p.at *= scale
    return { points, totalMs: HANDWRITING_PLAYBACK_MAX_MS }
  }
  return { points, totalMs: rawTotal }
}

/** 업로드용 파일. 버킷이 application/json 만 받는다(supabase/schema/09). */
export function serializeHandwriting(doc: HandwritingDoc): Blob {
  return new Blob([JSON.stringify(doc)], { type: 'application/json' })
}

/** 점의 수. 상한 검사와 "빈 장인가" 판단에 쓴다. */
export function countPoints(doc: HandwritingDoc): number {
  return doc.strokes.reduce((sum, stroke) => sum + stroke.p.length, 0)
}
