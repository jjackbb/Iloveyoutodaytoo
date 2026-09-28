/** 데모만 공개한다. 기존 서비스의 인증 경로와 섞지 않는다. */
export function isDemoPath(pathname: string): boolean {
  return pathname === '/demo' || pathname.startsWith('/demo/')
}

export function isDemoPresentationPath(pathname: string): boolean {
  // 포트폴리오 가입 시안은 데모 저장소·인증 없이 별도 경로로 공개한다.
  return isDemoPath(pathname) || pathname === '/welcome' || pathname === '/portfolio/signup-preview'
}
