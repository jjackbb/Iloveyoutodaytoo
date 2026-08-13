/**
 * 한글 초성 뽑기.
 *
 * 검색칸에 "ㄱㅁㅅ"라고 쳐도 "김민수"가 걸리게 하려면 양쪽을 초성으로 바꿔 견줘야 한다.
 * 시니어 사용자는 이름 전체를 치기보다 아는 글자만 더듬어 치는 일이 많다.
 *
 * 초대 화면(받는 사람 고르기)과 마음 보내기 화면이 같은 규칙을 써야 해서 여기로 뺐다 —
 * 두 화면의 검색이 다르게 동작하면 같은 이름이 한쪽에서만 걸린다.
 *
 * 서버 전용 모듈을 하나도 부르지 않는다. 클라이언트 부품이 그냥 가져다 쓴다.
 */

const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]

const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

/** "김민수" → "ㄱㅁㅅ". 한글이 아닌 글자는 그대로 둔다. */
export function toChosung(text: string): string {
  let out = ''
  for (const char of text) {
    const code = char.charCodeAt(0)
    if (code >= HANGUL_START && code <= HANGUL_END) {
      out += CHOSUNG[Math.floor((code - HANGUL_START) / 588)]
    } else {
      out += char
    }
  }
  return out
}

/**
 * 이름이 검색어와 맞는지. 글자 그대로와 초성, 두 갈래로 본다.
 * 대소문자는 구분하지 않는다(영문 이름).
 */
export function nameMatchesQuery(name: string, rawQuery: string): boolean {
  const query = rawQuery.trim()
  if (!query) return true

  if (name.toLowerCase().includes(query.toLowerCase())) return true
  return toChosung(name).includes(toChosung(query))
}
