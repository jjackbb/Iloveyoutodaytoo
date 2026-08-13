/**
 * 음성 파형 — 막대 높이 계산.
 *
 * 이 파일이 있는 이유: 파형 막대의 높이는 **반드시 실제 소리 크기에서 나와야 한다.**
 * 높이를 다 같은 값으로 그리면 화면에는 파형처럼 보이지만 소리와는 아무 상관이 없다.
 * 녹음 화면(실시간 측정)과 피드(저장된 파일 해석)가 서로 다른 길로 값을 얻지만,
 * 마지막에 막대 높이로 바꾸는 규칙은 한 곳에 두어야 같은 소리가 같은 모양으로 보인다.
 *
 * ⚠️ 소리를 **해석하는** 함수들은 브라우저 전용이다(AudioContext). 서버에서 부르지 마라.
 *    맨 아래 `sanitizeLevels`만 예외로, 서버(저장 액션)에서도 쓰라고 둔 것이다.
 */

/** 파형 막대 개수. 캡처의 밀도에 맞춘 값이다. */
export const BAR_COUNT = 48

/** 소리가 거의 없는 구간도 흔적은 남긴다. 0이면 막대가 사라져 칸이 비어 보인다. */
const MIN_BAR_RATIO = 0.16

/**
 * 크기 값 묶음을 막대 개수만큼 접고, 가장 큰 구간이 1이 되도록 맞춘다.
 *
 * 왜 최대값 기준으로 맞추나: 조용히 녹음한 소리는 원래 값이 0.01 언저리라
 * 그대로 그리면 파형이 아예 안 보인다. 소리의 "모양"을 보여주는 것이 목적이므로
 * 절대 크기가 아니라 그 안에서의 높낮이를 그린다.
 */
export function toBarLevels(samples: number[]): number[] {
  if (samples.length === 0) return []

  const perBar = samples.length / BAR_COUNT
  const folded: number[] = []

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const start = Math.floor(bar * perBar)
    const end = Math.max(start + 1, Math.floor((bar + 1) * perBar))
    let sum = 0
    for (let i = start; i < end; i += 1) sum += samples[i] ?? 0
    folded.push(sum / (end - start))
  }

  const peak = Math.max(...folded, 0.0001)
  return folded.map((level) =>
    Math.min(1, MIN_BAR_RATIO + (level / peak) * (1 - MIN_BAR_RATIO)),
  )
}

/** 이미 해석된 소리에서 막대 높이를 뽑는다. 저장된 파일을 그릴 때 쓴다. */
export function levelsFromAudioBuffer(buffer: AudioBuffer): number[] {
  const channel = buffer.getChannelData(0)
  const perBar = Math.max(1, Math.floor(channel.length / BAR_COUNT))
  const samples: number[] = []

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const start = bar * perBar
    let sum = 0
    for (let i = 0; i < perBar; i += 1) sum += Math.abs(channel[start + i] ?? 0)
    samples.push(sum / perBar)
  }

  return toBarLevels(samples)
}

/**
 * 해석용 AudioContext는 문서에 **하나만** 둔다.
 *
 * 예전에는 해석할 때마다 새로 만들고 바로 닫았다. 음성 게시물이 하나일 때는 멀쩡했지만,
 * 피드에 여러 개가 쌓이면 카드들이 동시에 해석을 시작하므로 컨텍스트가 동시에 살아 있게 된다.
 * 크롬은 **문서당 6개**가 상한이라 7번째부터 생성자가 예외를 던진다(사파리·iOS는 더 낮다).
 * 해석은 순간이고 서로 방해하지 않으므로 하나를 계속 재사용한다 — 상한에 닿을 일이 없어진다.
 *
 * 닫지 않는 이유: 닫으면 다음 해석 때 또 만들어야 하고, 그러면 상한 문제가 되돌아온다.
 * 해석만 하는 컨텍스트는 소리를 내보내지 않아 기기가 오디오 장치를 붙들지 않는다.
 */
let decodeContext: AudioContext | null = null

function getDecodeContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (decodeContext && decodeContext.state !== 'closed') return decodeContext

  const AudioContextClass =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null

  try {
    decodeContext = new AudioContextClass()
  } catch (error) {
    // 상한을 넘겼거나 자동재생 정책에 막힌 경우. 파형 없이도 재생은 되어야 하므로 막지 않는다.
    console.error('[파형] 소리 해석기를 만들지 못했습니다:', error)
    decodeContext = null
  }
  return decodeContext
}

/**
 * 소리 파일을 내려받아 해석해서 막대 높이를 뽑는다.
 *
 * 못 해석하면 null을 준다 — 그때는 파형 대신 밋밋한 막대 하나를 그린다.
 * 지어낸 모양을 그리느니 "아직 모른다"를 그대로 보여주는 편이 정직하다.
 *
 * ⚠️ **이 함수는 파일 전체를 내려받는다.** 화면에 뜨자마자 부르면 피드에 있는 음성을
 * 전부 내려받게 된다. 사용자가 재생을 시작한 뒤에 불러라(`VoicePlayer` 참고).
 *
 * 어떤 경우에도 reject하지 않는다 — 부르는 쪽이 잡지 않아 미처리 프라미스 거부로 새던 자리다.
 */
export async function levelsFromUrl(src: string): Promise<number[] | null> {
  try {
    const context = getDecodeContext()
    if (!context) return null

    const response = await fetch(src)
    if (!response.ok) return null
    const bytes = await response.arrayBuffer()
    const buffer = await context.decodeAudioData(bytes)
    return levelsFromAudioBuffer(buffer)
  } catch {
    return null
  }
}

/**
 * 브라우저가 보내온 막대 높이를 DB에 넣어도 되는 모양으로 다듬는다.
 *
 * **서버에서 부르는 함수다**(위쪽 해석 함수들과 달리 AudioContext를 쓰지 않는다).
 * 값은 결국 브라우저가 보내는 것이라 그대로 믿을 수 없다 — 길이가 넘치거나,
 * 숫자가 아니거나, 0~1을 벗어난 값이 오면 파형이 칸을 넘치거나 뒤집혀 그려진다.
 *
 * DB의 CHECK는 길이와 빈 칸만 막는다(집계 subquery를 못 써서 범위는 못 막는다).
 * 그래서 0~1로 자르는 일은 여기서 책임진다.
 *
 * 쓸 값이 하나도 없으면 null을 준다 — 빈 배열을 넣으면 "파형이 있다"는 거짓이 된다.
 */
export function sanitizeLevels(input: unknown): number[] | null {
  if (!Array.isArray(input)) return null

  const levels = input
    .slice(0, BAR_COUNT)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .map((value) => Math.min(1, Math.max(0, value)))

  return levels.length > 0 ? levels : null
}
