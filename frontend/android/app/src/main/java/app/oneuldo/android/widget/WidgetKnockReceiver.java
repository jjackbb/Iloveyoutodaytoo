package app.oneuldo.android.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * 위젯의 [톡톡] 단추.
 *
 * 안드로이드 위젯은 "길게 누르기"를 앱에 주지 않는다(시스템이 이동·크기조절로 가져간다).
 * 그래서 PRD 의 "꾹 누르면 진동"은 단추 탭으로 바꿨다(사용자 결정 2026-09-06).
 *
 * 흐름: 탭 → 이 리시버 → POST /api/widget/knock → 성공하면 단추 글자를 잠깐
 * "톡톡했어요"로 바꿨다가 되돌린다. 보내는 횟수 제한은 없다 — 초대한 사람끼리라
 * 스팸이 성립하지 않고, 받는 쪽 알림함 정리는 서버(widget_knock)가 한다.
 *
 * goAsync() 로 10초 예산을 받아 백그라운드에서 네트워크를 탄다. 리시버의 onReceive 는
 * 메인 스레드라 여기서 직접 부르면 앱이 죽는다.
 */
public class WidgetKnockReceiver extends BroadcastReceiver {

    private static final String TAG = "OneuldoWidget";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!WidgetContract.ACTION_KNOCK.equals(intent.getAction())) return;

        final String target = intent.getStringExtra(WidgetContract.EXTRA_TARGET_USER_ID);
        final String memory = intent.getStringExtra(WidgetContract.EXTRA_MEMORY_ID);
        if (target == null) return;

        final PendingResult pending = goAsync();
        final Context app = context.getApplicationContext();

        new Thread(() -> {
            try {
                String token = WidgetStore.readToken(app);
                boolean ok = token != null && WidgetNetwork.postKnock(token, target, memory);
                if (!ok) {
                    Log.w(TAG, "톡톡 실패 (토큰 없음 또는 서버 거절)");
                    return;
                }

                // 눌렀다는 것을 바로 보여준다. 캐시가 없으면(드묾) 조용히 넘어간다.
                WidgetItem cached = WidgetStore.readCachedItem(app);
                if (cached == null) return;
                WidgetRenderer.apply(app, WidgetRenderer.item(app, cached, WidgetStore.readCachedPhoto(app), true));
                try {
                    Thread.sleep(WidgetContract.KNOCK_FEEDBACK_MS);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
                WidgetRenderer.apply(app, WidgetRenderer.item(app, cached, WidgetStore.readCachedPhoto(app), false));
            } catch (Throwable t) {
                Log.w(TAG, "톡톡 처리 중 예외", t);
            } finally {
                pending.finish();
            }
        }, "oneuldo-widget-knock").start();
    }
}
