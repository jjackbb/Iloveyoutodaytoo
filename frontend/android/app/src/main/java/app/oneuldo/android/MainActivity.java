package app.oneuldo.android;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.getcapacitor.BridgeActivity;

import java.net.URLDecoder;

import app.oneuldo.android.widget.WidgetContract;
import app.oneuldo.android.widget.WidgetRefresher;
import app.oneuldo.android.widget.WidgetStore;

/**
 * 앱의 유일한 액티비티. Capacitor 웹뷰가 배포된 서버(capacitor.config.ts 의 server.url)를 부른다.
 *
 * 여기서 네이티브가 덧붙이는 일은 둘뿐이다.
 *  1. 설치 뒤 첫 실행에 초대를 복원한다(Install Referrer) — 없으면 부모가 앱을 열고
 *     "그래서 뭘 하라는 거지"가 된다(PRD §6⑮).
 *  2. 앱이 앞으로 올 때마다 홈 위젯을 갱신한다 — 시스템 30분 주기를 기다리지 않는다.
 *
 * 딥링크(App Links)는 매니페스트의 intent-filter 가 받고, Capacitor 의 App 플러그인이
 * appUrlOpen 으로 JS 에 올려 웹이 그 화면으로 이동한다. 여기 코드는 없다.
 */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "OneuldoApp";

    /**
     * 웹뷰가 페이지를 받아 appUrlOpen 리스너를 달 때까지의 여유.
     * 리퍼러는 몇백 ms 면 읽히는데 그 순간 JS 가 아직 없으면 이벤트가 허공에 뜬다.
     * 웹 쪽은 App.getLaunchUrl() 로 한 번 더 확인하지만, 그건 시작 인텐트만 보므로
     * 여기서 시간을 조금 두는 편이 안전하다. (실기기에서 검증 필요 — WORKLOG 참고)
     */
    private static final long REFERRER_DISPATCH_DELAY_MS = 2000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        maybeRestoreInviteFromInstallReferrer();
    }

    @Override
    public void onResume() {
        super.onResume();
        WidgetRefresher.refreshAsync(this);
    }

    /**
     * Play 스토어 링크에 실려 온 `referrer=invite%3D<token>` 을 딱 한 번 읽어,
     * 초대 페이지를 여는 VIEW 인텐트를 **자기 자신에게** 보낸다.
     * 그러면 App Links 로 열린 것과 똑같은 경로(appUrlOpen)를 타서 웹이 /invite/<token> 으로 간다.
     *
     * 한 번만 읽는 이유: 리퍼러는 설치 시점의 값이라 두 번째부터는 뜻이 없고,
     * 매 실행마다 Play 에 연결하는 비용도 아깝다.
     */
    private void maybeRestoreInviteFromInstallReferrer() {
        if (!WidgetStore.claimReferrerCheck(this)) return;

        final InstallReferrerClient client = InstallReferrerClient.newBuilder(this).build();
        try {
            client.startConnection(new InstallReferrerStateListener() {
                @Override
                public void onInstallReferrerSetupFinished(int responseCode) {
                    try {
                        if (responseCode != InstallReferrerClient.InstallReferrerResponse.OK) {
                            Log.i(TAG, "설치 리퍼러 없음/미지원: " + responseCode);
                            return;
                        }
                        String raw = client.getInstallReferrer().getInstallReferrer();
                        String token = parseInviteToken(raw);
                        if (token == null) return;

                        final Uri target = Uri.parse(WidgetContract.BASE_URL + "/invite/" + Uri.encode(token));
                        new Handler(Looper.getMainLooper()).postDelayed(() -> {
                            Intent open = new Intent(Intent.ACTION_VIEW, target);
                            open.setClass(MainActivity.this, MainActivity.class);
                            open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
                            startActivity(open);
                        }, REFERRER_DISPATCH_DELAY_MS);
                    } catch (Exception e) {
                        Log.w(TAG, "설치 리퍼러 읽기 실패", e);
                    } finally {
                        client.endConnection();
                    }
                }

                @Override
                public void onInstallReferrerServiceDisconnected() {
                    // 재시도하지 않는다. 다음 실행에서도 안 읽는다(한 번뿐). 초대는 링크를 다시 누르면 된다.
                }
            });
        } catch (Exception e) {
            // Play 서비스가 없는 기기(에뮬레이터 일부 등)에서 던질 수 있다. 앱은 계속 뜬다.
            Log.w(TAG, "설치 리퍼러 연결 실패", e);
        }
    }

    /**
     * "invite=abc&utm_source=..." 또는 통째로 인코딩된 "invite%3Dabc" 에서 토큰만 뽑는다.
     * 모양이 다르면 null — 초대가 아닌 설치(스토어에서 직접 검색)도 이 길로 온다.
     */
    static String parseInviteToken(String referrer) {
        if (referrer == null) return null;
        String decoded = referrer;
        try {
            decoded = URLDecoder.decode(referrer, "UTF-8");
        } catch (Exception ignored) {
            // 디코딩이 안 되면 원문 그대로 본다.
        }
        for (String part : decoded.split("&")) {
            int eq = part.indexOf('=');
            if (eq <= 0) continue;
            String key = part.substring(0, eq).trim();
            String value = part.substring(eq + 1).trim();
            if ("invite".equals(key) && !value.isEmpty()) return value;
        }
        return null;
    }
}
