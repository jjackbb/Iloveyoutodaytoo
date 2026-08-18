import { cookies } from 'next/headers'

/**
 * 큰 글자 모드 — 저장 위치와 읽는 법.
 *
 * 왜 DB와 쿠키 둘 다인가:
 *   진짜 값은 `users.large_text`에 있다. 사람에 붙는 설정이라 부모님이 다른 기기로
 *   로그인해도 따라와야 하기 때문이다. 하지만 글자 크기는 **모든 화면의 <html>에**
 *   걸려야 해서, 루트 레이아웃이 페이지를 그릴 때마다 알아야 한다.
 *   거기서 DB를 읽으면 모든 화면이 조회를 한 번씩 더 하게 된다.
 *
 *   그래서 켜고 끌 때와 로그인할 때 쿠키에 같은 값을 적어두고, 루트 레이아웃은
 *   쿠키만 본다. 쿠키가 틀어져도 마이 화면의 토글은 DB 값을 보여주므로
 *   한 번 더 누르면 다시 맞는다 — 어긋나도 글자 크기가 잠깐 다를 뿐 데이터는 안 상한다.
 *
 * 잔여데이터가 아닌 이유: 브라우저 메모리에 남는 상태가 아니라 요청마다 서버가
 * 새로 읽는 값이다. 로그아웃할 때 지운다.
 */
export const LARGE_TEXT_COOKIE = 'oneuldo-large-text'

/** 1년. 접근성 설정을 몇 달 뒤에 저절로 풀리게 두면 안 된다. */
const ONE_YEAR_SEC = 60 * 60 * 24 * 365

/** 루트 레이아웃이 쓰는 읽기. DB를 건드리지 않는다. */
export async function readLargeTextCookie(): Promise<boolean> {
  const store = await cookies()
  return store.get(LARGE_TEXT_COOKIE)?.value === '1'
}

/**
 * 쿠키를 DB 값에 맞춘다. Server Action이나 Route Handler에서만 부를 수 있다
 * (페이지를 그리는 도중에는 쿠키를 쓸 수 없다).
 */
export async function writeLargeTextCookie(on: boolean): Promise<void> {
  const store = await cookies()
  store.set(LARGE_TEXT_COOKIE, on ? '1' : '0', {
    maxAge: ONE_YEAR_SEC,
    path: '/',
    sameSite: 'lax',
    // 화면 크기 취향일 뿐 비밀이 아니다. 다만 굳이 스크립트가 읽을 일도 없다.
    httpOnly: true,
  })
}

/** 로그아웃할 때. 다음 사람이 앞사람의 글자 크기를 물려받지 않게 한다. */
export async function clearLargeTextCookie(): Promise<void> {
  const store = await cookies()
  store.delete(LARGE_TEXT_COOKIE)
}
