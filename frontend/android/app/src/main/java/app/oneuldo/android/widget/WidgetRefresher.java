package app.oneuldo.android.widget;

import android.content.Context;
import android.graphics.Bitmap;
import android.util.Log;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import app.oneuldo.android.R;

/**
 * 위젯 갱신의 유일한 입구. "서버에 물어서 그린다"를 여기 한 곳에서만 한다.
 *
 * 부르는 곳 셋 — ① 시스템의 30분 주기(onUpdate) ② 앱이 앞으로 올 때(MainActivity.onResume)
 * ③ 톡톡 직후. 셋이 같은 경로를 타야 "앱에서 본 것과 위젯이 다르다"가 안 생긴다.
 *
 * 전부 백그라운드 스레드에서 돈다. 위젯 갱신은 급하지 않고 동시에 두 번 돌 이유도 없어서
 * 스레드 하나로 줄 세운다.
 */
public final class WidgetRefresher {

    private static final String TAG = "OneuldoWidget";
    private static final ExecutorService EXEC = Executors.newSingleThreadExecutor();

    private WidgetRefresher() {}

    public static void refreshAsync(Context context) {
        refreshAsync(context, false);
    }

    /** @param knockLabelDone 톡톡 직후면 true — 단추 글자를 잠깐 "톡톡했어요"로 그린다. */
    public static void refreshAsync(Context context, boolean knockLabelDone) {
        final Context app = context.getApplicationContext();
        EXEC.execute(() -> {
            try {
                refreshNow(app, knockLabelDone);
            } catch (Throwable t) {
                // 위젯 때문에 앱 프로세스가 죽으면 안 된다. 삼키고 로그만 남긴다.
                Log.w(TAG, "위젯 갱신 중 예외", t);
            }
        });
    }

    /** 반드시 백그라운드에서. 네트워크가 들어 있다. */
    static void refreshNow(Context c, boolean knockLabelDone) {
        // 홈에 위젯이 하나도 없으면 서버를 부를 이유가 없다.
        if (WidgetRenderer.widgetIds(c).length == 0) return;

        String token = WidgetStore.readToken(c);
        if (token == null) {
            WidgetRenderer.apply(c, WidgetRenderer.message(c, c.getString(R.string.widget_need_login)));
            return;
        }

        WidgetNetwork.LatestResult result = WidgetNetwork.fetchLatest(token);
        switch (result.status) {
            case UNAUTHORIZED:
                // 토큰이 죽었다(로그아웃·탈퇴). 캐시를 비워 남의 것이 남지 않게 한다.
                WidgetStore.writeCachedItem(c, null);
                WidgetStore.writeCachedPhoto(c, null);
                WidgetRenderer.apply(c, WidgetRenderer.message(c, c.getString(R.string.widget_need_login)));
                return;

            case EMPTY:
                WidgetStore.writeCachedItem(c, null);
                WidgetStore.writeCachedPhoto(c, null);
                WidgetRenderer.apply(c, WidgetRenderer.message(c, c.getString(R.string.widget_empty)));
                return;

            case OK: {
                WidgetItem item = result.item;
                Bitmap photo = item.photoUrl != null ? WidgetNetwork.fetchPhoto(item.photoUrl) : null;
                WidgetStore.writeCachedItem(c, item);
                WidgetStore.writeCachedPhoto(c, photo);
                WidgetRenderer.apply(c, WidgetRenderer.item(c, item, photo, knockLabelDone));
                return;
            }

            case FAILED:
            default: {
                // 네트워크가 안 된다. 빈 위젯을 보이느니 직전에 성공한 것을 그대로 둔다.
                WidgetItem cached = WidgetStore.readCachedItem(c);
                if (cached != null) {
                    WidgetRenderer.apply(c, WidgetRenderer.item(c, cached, WidgetStore.readCachedPhoto(c), knockLabelDone));
                } else {
                    WidgetRenderer.apply(c, WidgetRenderer.message(c, c.getString(R.string.widget_offline)));
                }
            }
        }
    }
}
