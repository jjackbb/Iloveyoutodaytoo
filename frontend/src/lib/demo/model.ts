import { isHandwritingDoc, type HandwritingDoc } from '@/lib/handwriting'
import { CAPTION_MAX_LENGTH, PHOTO_MAX_COUNT, VIDEO_MAX_BYTES, VIDEO_MAX_MS, VOICE_MAX_SEC, VOICE_MIN_SEC } from '@/lib/limits'

export type DemoActor = 'child' | 'parent'
export const DEMO_PEOPLE: Record<DemoActor, { name: string; role: string }> = {
  child: { name: '지우', role: '자녀' },
  parent: { name: '엄마', role: '부모' },
}

export type DemoVoice = {
  blob: Blob
  durationSec: number
  levels: number[] | null
}

/** 영상 한 개. 기존 앱과 같은 규칙(30초·50MB)을 쓴다(2026-09-28 데모에 추가). */
export type DemoVideo = {
  blob: Blob
  durationMs: number
  /** 구간 편집(2026-09-28 스티치 7번). 파일은 자르지 않고 이 구간만 재생한다. 없으면 처음~끝. */
  trimStartMs?: number
  trimEndMs?: number
  /** 대표 섬네일로 고른 지점. 없으면 구간 시작. */
  posterMs?: number
}

/** 영상에서 실제로 재생할 구간과 대표 섬네일 지점. 예전 기록(칸 없음)도 같은 식으로 읽는다. */
export function videoRange(video: DemoVideo): { startMs: number; endMs: number; posterMs: number } {
  const startMs = video.trimStartMs ?? 0
  const endMs = video.trimEndMs ?? video.durationMs
  return { startMs, endMs, posterMs: video.posterMs ?? startMs }
}

/** 손글씨 필기구·편지지(2026-09-28 스티치 4번). 한 마음 전체에 적용한다. */
export const DEMO_PENS = {
  ink: { label: '따뜻한 먹물펜', color: '#2B2521', width: 5 },
  pencil: { label: '연필', color: '#6F6A66', width: 3 },
  fountain: { label: '만년필', color: '#27406B', width: 4 },
} as const
export const DEMO_PAPERS = {
  hanji: { label: '한지 크림', color: '#FBF5EA' },
  warm: { label: '따스한 온기', color: '#FBEBE3' },
} as const
export type DemoPen = keyof typeof DEMO_PENS
export type DemoPaper = keyof typeof DEMO_PAPERS
export type DemoHandwritingStyle = { pen: DemoPen; paper: DemoPaper }
export const DEFAULT_HANDWRITING_STYLE: DemoHandwritingStyle = { pen: 'ink', paper: 'hanji' }

/** 상세의 여러 마음 표현(2026-09-28 스티치 8번). '하트 온기'는 기존 좋아요(likedBy)를 그대로 쓴다. */
export const DEMO_REACTIONS = {
  thanks: '고마워요',
  cheer: '힘내요',
  miss: '보고싶어요',
} as const
export type DemoReaction = keyof typeof DEMO_REACTIONS

export type DemoDraft = {
  method: 'handwriting' | 'voice' | 'photo' | 'video' | null
  handwriting: HandwritingDoc | null
  recording: (DemoVoice & { mimeType: string; extension: string }) | null
  photos: { id: string; blob: Blob }[]
  video: DemoVideo | null
  handwritingStyle: DemoHandwritingStyle
  caption: string
}

export function emptyDemoDraft(): DemoDraft {
  return { method: null, handwriting: null, recording: null, photos: [], video: null, handwritingStyle: DEFAULT_HANDWRITING_STYLE, caption: '' }
}

/** 마음에 단 댓글(2026-09-28, 인스타그램처럼 상세에서 단다). 글만 받는다. */
export type DemoComment = {
  id: string
  author: DemoActor
  text: string
  createdAt: string
  /** 답글이면 원래 댓글의 번호(2026-09-28, 댓글을 꾹 눌러 단다). 답글의 답글도 원래 댓글 아래에 모은다. */
  replyTo?: string
}

export type DemoMemory = {
  id: string
  author: DemoActor
  createdAt: string
  caption: string
  handwriting: HandwritingDoc | null
  /** 필기구·편지지를 넣기 전에 저장된 체험 기록에는 이 칸이 없다(기본값으로 보여 준다). */
  handwritingStyle?: DemoHandwritingStyle
  voice: DemoVoice | null
  photos: Blob[]
  /** 영상을 넣기 전에 저장된 체험 기록에는 이 칸이 없다. */
  video?: DemoVideo | null
  /** 댓글을 넣기 전에 저장된 체험 기록에는 이 칸이 없다. */
  comments?: DemoComment[]
  likedBy: DemoActor[]
  /** 하트 외 마음 표현. 이 칸이 없던 기록도 그대로 읽는다. */
  reactions?: Partial<Record<DemoReaction, DemoActor[]>>
  example: boolean
}

export type DemoSnapshot = {
  version: 1
  actor: DemoActor
  favorite: Record<DemoActor, boolean>
  memories: DemoMemory[]
  seen: Record<DemoActor, string[]>
}

/** 가상 예시: 한 획으로 그린 하트. 실제 사용자의 기록이 아니다. */
export function exampleHandwriting(): HandwritingDoc {
  const points: [number, number, number][] = []
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * Math.PI * 2
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    points.push([400 + x * 12, 285 - y * 12, i * 22])
  }
  return { v: 1, w: 800, h: 600, strokes: [{ t: 0, p: points }], durationMs: 2640 }
}

export function createDemoSeed(): DemoSnapshot {
  return {
    version: 1,
    actor: 'child',
    favorite: { child: false, parent: false },
    seen: { child: [], parent: ['example-heart'] },
    memories: [{
      id: 'example-heart',
      author: 'parent',
      createdAt: new Date().toISOString(),
      caption: '바쁜 하루였지? 밥 잘 챙겨 먹고, 오늘도 네 편이야.',
      handwriting: exampleHandwriting(),
      voice: null,
      photos: [],
      video: null,
      likedBy: [],
      example: true,
    }],
  }
}

export function validateMemory(memory: DemoMemory): void {
  if (!memory.id || !['child', 'parent'].includes(memory.author)) throw new Error('기록 정보를 확인해주세요.')
  if (!Number.isFinite(Date.parse(memory.createdAt))) throw new Error('기록의 날짜를 확인해주세요.')
  if (memory.caption.length > CAPTION_MAX_LENGTH) throw new Error(`한마디는 ${CAPTION_MAX_LENGTH}자까지 남길 수 있어요.`)
  if (memory.handwriting && !isHandwritingDoc(memory.handwriting)) throw new Error('손글씨를 다시 확인해주세요.')
  if (memory.voice && (!(memory.voice.blob instanceof Blob) || !memory.voice.blob.size || !Number.isFinite(memory.voice.durationSec) || memory.voice.durationSec < VOICE_MIN_SEC || memory.voice.durationSec > VOICE_MAX_SEC)) throw new Error('녹음 파일을 확인해 주세요. 목소리는 1분까지 담을 수 있어요.')
  if (memory.photos.length > PHOTO_MAX_COUNT || memory.photos.some((photo) => !(photo instanceof Blob) || !photo.type.startsWith('image/') || !photo.size)) throw new Error('사진을 다시 확인해주세요.')
  if (memory.video && (!(memory.video.blob instanceof Blob) || !memory.video.blob.type.startsWith('video/') || !memory.video.blob.size || memory.video.blob.size > VIDEO_MAX_BYTES || !Number.isFinite(memory.video.durationMs) || memory.video.durationMs < 0 || memory.video.durationMs > VIDEO_MAX_MS)) throw new Error('영상을 다시 확인해 주세요. 30초·50MB까지 담을 수 있어요.')
  if (memory.video) {
    const { startMs, endMs, posterMs } = videoRange(memory.video)
    if (![startMs, endMs, posterMs].every(Number.isFinite) || startMs < 0 || endMs > memory.video.durationMs || endMs - startMs < 1000 || posterMs < startMs || posterMs > endMs) throw new Error('영상 구간을 다시 확인해 주세요.')
  }
  if (memory.handwritingStyle && (!(memory.handwritingStyle.pen in DEMO_PENS) || !(memory.handwritingStyle.paper in DEMO_PAPERS))) throw new Error('필기구와 편지지를 다시 확인해 주세요.')
  if (memory.reactions && Object.entries(memory.reactions).some(([key, actors]) => !(key in DEMO_REACTIONS) || !Array.isArray(actors) || actors.some((actor) => !['child', 'parent'].includes(actor)) || new Set(actors).size !== actors.length)) throw new Error('마음 표현을 다시 확인해 주세요.')
  if (memory.comments && (!Array.isArray(memory.comments) || memory.comments.some((comment) => !comment.id || !['child', 'parent'].includes(comment.author) || typeof comment.text !== 'string' || !comment.text.trim() || comment.text.length > CAPTION_MAX_LENGTH || (comment.replyTo !== undefined && !memory.comments?.some((parent) => parent.id === comment.replyTo && parent.replyTo === undefined))))) throw new Error(`댓글은 ${CAPTION_MAX_LENGTH}자까지 남길 수 있어요.`)
  if (!memory.handwriting && !memory.voice && !memory.photos.length && !memory.video) throw new Error('손글씨, 목소리, 사진, 영상 중 하나를 담아주세요.')
}

export function isDemoSnapshot(value: unknown): value is DemoSnapshot {
  if (!value || typeof value !== 'object') return false
  const data = value as DemoSnapshot
  if (data.version !== 1 || !['child', 'parent'].includes(data.actor) || typeof data.favorite?.child !== 'boolean' || typeof data.favorite?.parent !== 'boolean' || !Array.isArray(data.memories) || !Array.isArray(data.seen?.child) || !Array.isArray(data.seen?.parent)) return false
  try {
    for (const memory of data.memories) {
      if (typeof memory.caption !== 'string' || !Array.isArray(memory.photos) || !Array.isArray(memory.likedBy)) return false
      if (memory.likedBy.some((actor) => !['child', 'parent'].includes(actor)) || new Set(memory.likedBy).size !== memory.likedBy.length) return false
      validateMemory(memory)
    }
    return true
  } catch {
    return false
  }
}
