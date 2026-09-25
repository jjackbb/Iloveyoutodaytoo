import { isHandwritingDoc, type HandwritingDoc } from '@/lib/handwriting'
import { CAPTION_MAX_LENGTH, PHOTO_MAX_COUNT, VOICE_MAX_SEC, VOICE_MIN_SEC } from '@/lib/limits'

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

export type DemoDraft = {
  method: 'handwriting' | 'voice' | 'photo' | null
  handwriting: HandwritingDoc | null
  recording: (DemoVoice & { mimeType: string; extension: string }) | null
  photos: { id: string; blob: Blob }[]
  caption: string
}

export function emptyDemoDraft(): DemoDraft {
  return { method: null, handwriting: null, recording: null, photos: [], caption: '' }
}

export type DemoMemory = {
  id: string
  author: DemoActor
  createdAt: string
  caption: string
  handwriting: HandwritingDoc | null
  voice: DemoVoice | null
  photos: Blob[]
  likedBy: DemoActor[]
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
  if (!memory.handwriting && !memory.voice && !memory.photos.length) throw new Error('손글씨, 목소리, 사진 중 하나를 담아주세요.')
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
