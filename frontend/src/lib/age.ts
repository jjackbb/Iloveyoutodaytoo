/**
 * 나이 계산 — 서버·브라우저 양쪽에서 쓰므로 서버 전용 코드를 import하지 않는다.
 */

/** 만 나이 계산 (생일이 지났는지까지 반영) */
export function calculateAge(birthDate: string, today = new Date()): number {
  const birth = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return Number.NaN

  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }
  return age
}

/**
 * 만 14세 미만이면 법정대리인 동의가 필요하다 (개인정보보호법 제22조의2).
 * 날짜를 못 읽으면 true를 돌려준다 — 잘못 읽었을 때 동의를 빼먹는 쪽보다
 * 한 번 더 묻는 쪽이 안전하다.
 */
export function needsGuardianConsent(birthDate: string): boolean {
  const age = calculateAge(birthDate)
  return Number.isNaN(age) || age < 14
}
