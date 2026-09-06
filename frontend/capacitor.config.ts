import type { CapacitorConfig } from '@capacitor/cli'

/**
 * 안드로이드 앱 껍데기 설정 (PRD §6⑮ · APP-01).
 *
 * **이 앱은 웹뷰가 배포된 Next.js 서버를 그대로 부른다.**
 * 화면을 기기에 넣지 않는 이유는 하나다 — 이 앱은 서버 액션 18개와 미들웨어
 * (`src/proxy.ts` 의 Supabase 세션 처리) 위에 서 있고, 정적 전환(`output: 'export'`)은
 * 그 둘을 못 쓴다. 전부 클라이언트+API로 다시 쓰면 몇 주가 걸리고,
 * **서버에서만 하던 검증이 무너지지 않는지 보안 재검토까지** 필요하다.
 *
 * 그래서 껍데기만 네이티브로 두고 알맹이는 서버에 남긴다. 대신 네이티브가 필요한 것
 * (위젯 · 햅틱 · FCM)은 Capacitor 플러그인과 네이티브 코드로 정식으로 붙인다 —
 * 그것이 TWA 대신 Capacitor를 고른 이유다(PRD §6⑮ 표).
 *
 * **감수한 것: 오프라인이 안 된다.** 앨범방·사서함·음성이 전부 서버 데이터라
 * 오프라인에서 할 수 있는 일이 원래 거의 없다.
 */
const config: CapacitorConfig = {
  /**
   * ⚠️ 플레이스토어에 한 번 올리면 **영영 못 바꾼다.** 바꾸려면 다른 앱이 된다.
   * 코드베이스가 이미 oneuldo 를 쓰고 있어(package.json 의 oneuldo-saranghae,
   * 가입 합성 메일 @id.oneuldo.local) 거기에 맞췄다.
   */
  appId: 'app.oneuldo.android',

  /** 홈 화면과 스토어에 보이는 이름. 이것은 나중에 바꿀 수 있다. */
  appName: '오늘도 사랑해',

  /**
   * Capacitor 는 `server.url` 을 쓸 때도 webDir 이 있어야 한다.
   * 아래 server.url 이 살아 있는 한 이 폴더의 파일은 화면에 뜨지 않는다 —
   * 서버에 닿지 못했을 때 보이는 마지막 안전망이다.
   */
  webDir: 'capacitor-shell',

  server: {
    /**
     * 웹뷰가 부를 주소. **사람에게 웹 주소로 홍보하지 않는다** — 들어오는 길은 앱이다.
     * 이 주소는 "앱이 불러올 서버"로만 산다(PRD §6⑮).
     */
    url: 'https://iloveyoutodaytoo.vercel.app',

    /**
     * https 만 쓴다. 평문 http 를 열면 중간에서 세션 쿠키를 들여다볼 수 있다.
     * 로컬 개발 서버를 붙일 때도 이 값을 켜지 말고 `npx cap run android --external` 를 쓸 것.
     */
    cleartext: false,
    androidScheme: 'https',
  },

  android: {
    /**
     * 웹뷰가 우리 서버만 열게 둔다. 사용자가 앱 안에서 바깥 링크를 눌렀을 때
     * 앱 안에 가두지 않고 기기 브라우저로 내보내기 위한 것이다.
     * (약관·개인정보 화면은 우리 도메인이라 그대로 앱 안에서 열린다)
     */
    allowMixedContent: false,

    /**
     * 서버가 "이 요청은 앱에서 왔다"를 알아보는 표식 (PRD §6⑮ 웹 폐기).
     * 브라우저로 들어온 사람은 소개·스토어 화면으로 보내고, 앱은 그대로 통과시킨다.
     * 판별은 src/lib/native.ts 한 곳에서만 한다 — 여기 문자열을 바꾸면 그쪽도 함께.
     */
    appendUserAgent: 'OneuldoApp/1.0',
  },
}

export default config
