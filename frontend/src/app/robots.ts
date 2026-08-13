import type { MetadataRoute } from 'next'

/**
 * 검색엔진에게 무엇을 훑어도 되는지 알려준다.
 *
 * 이 서비스에는 가족끼리 주고받은 목소리와 마음이 들어 있다.
 * 로그인 뒤 화면은 어차피 크롤러가 못 들어오지만(proxy가 /login으로 보낸다),
 * **초대 링크(/invite/{토큰})는 로그인 없이 열리는 유일한 화면**이라
 * 어딘가로 링크가 새어 나가면 검색 결과에 뜰 수 있다. 그래서 명시적으로 막는다.
 *
 * 열어두는 것은 서비스 소개 역할을 하는 로그인·가입 화면과 약관뿐이다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/login', '/signup', '/legal/'],
        disallow: ['/', '/invite/', '/rooms/', '/mailbox', '/my/', '/report/'],
      },
    ],
  }
}
