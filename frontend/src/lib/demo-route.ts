/** 데모만 공개한다. 기존 서비스의 인증 경로와 섞지 않는다. */
export function isDemoPath(pathname: string): boolean {
  return pathname === '/demo' || pathname.startsWith('/demo/')
}

export function isDemoPresentationPath(pathname: string): boolean {
  return isDemoPath(pathname) || pathname === '/welcome'
}
