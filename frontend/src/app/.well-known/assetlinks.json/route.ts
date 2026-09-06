/**
 * Digital Asset Links — "이 도메인은 저 앱의 것"이라는 증명서.
 *
 * 안드로이드는 초대 링크(https://iloveyoutodaytoo.vercel.app/invite/…)를 눌렀을 때
 * 브라우저 대신 앱을 열지 말지를 **이 파일 하나로** 판단한다(App Links).
 * 여기가 404거나 지문이 안 맞으면 링크는 조용히 브라우저로 열리고,
 * 브라우저는 proxy.ts 가 /welcome 으로 보낸다 — 초대받은 분이 앱을 못 연다.
 *
 * 그래서 두 가지를 지킨다.
 *  1. proxy.ts 의 `/.well-known` 예외 — 이 경로는 UA 와 무관하게 통과한다.
 *  2. 지문이 없어도 **200 에 빈 배열**을 준다. 404 는 "이 도메인은 App Links 를
 *     안 쓴다"로 읽히지만, 빈 배열은 "쓰긴 쓰는데 아직 등록 전"으로 읽힌다.
 *     지문을 넣는 순간 재배포 없이도(캐시 1시간 뒤) 살아난다.
 *
 * 지문(ANDROID_CERT_SHA256)은 환경변수로 둔다. 업로드 키와 Play 앱 서명 키의
 * 지문이 서로 다르고, 릴리스 때마다 늘어날 수 있어서 코드에 박으면 매번 배포해야 한다.
 * 값 형식: `AA:BB:CC:…` 대문자 지문, 여러 개면 쉼표로 잇는다.
 */

/** capacitor.config.ts 의 appId 와 반드시 같다. 스토어 등록 뒤에는 못 바꾼다. */
const PACKAGE_NAME = 'app.oneuldo.android'

export async function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const statements =
    fingerprints.length === 0
      ? []
      : [
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: PACKAGE_NAME,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]

  return new Response(JSON.stringify(statements), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // 구글 검증기가 자주 들르지는 않는다. 1시간이면 지문을 새로 넣었을 때
      // 다시 배포하지 않아도 곧 반영된다.
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
