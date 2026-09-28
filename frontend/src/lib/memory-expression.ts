/** 실제 앱의 선택 값. E16 데모의 필기구·편지지·마음 표현과 같은 계약이다. */
export const MEMORY_PENS = {
  ink: { label: '따뜻한 먹물펜', color: '#2B2521', width: 5 },
  pencil: { label: '연필', color: '#6F6A66', width: 3 },
  fountain: { label: '만년필', color: '#27406B', width: 4 },
} as const

export const MEMORY_PAPERS = {
  hanji: { label: '한지 크림', color: '#FBF5EA' },
  warm: { label: '따스한 온기', color: '#FBEBE3' },
} as const

export const MEMORY_REACTIONS = {
  thanks: '고마워요',
  cheer: '힘내요',
  miss: '보고싶어요',
} as const

export type MemoryPen = keyof typeof MEMORY_PENS
export type MemoryPaper = keyof typeof MEMORY_PAPERS
export type MemoryReaction = keyof typeof MEMORY_REACTIONS
export type MemoryHandwritingStyle = { pen: MemoryPen; paper: MemoryPaper }
export type MemoryVideoRange = { startMs: number; endMs: number; posterMs: number }

export const DEFAULT_MEMORY_HANDWRITING_STYLE: MemoryHandwritingStyle = { pen: 'ink', paper: 'hanji' }

export function memoryHandwritingStyle(pen: string | null, paper: string | null): MemoryHandwritingStyle {
  return {
    pen: pen && pen in MEMORY_PENS ? pen as MemoryPen : 'ink',
    paper: paper && paper in MEMORY_PAPERS ? paper as MemoryPaper : 'hanji',
  }
}

export function memoryVideoRange(
  durationMs: number,
  startMs: number | null | undefined,
  endMs: number | null | undefined,
  posterMs: number | null | undefined,
): MemoryVideoRange {
  const start = startMs ?? 0
  const end = endMs ?? durationMs
  return { startMs: start, endMs: end, posterMs: posterMs ?? start }
}
