package app.oneuldo.android.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

import app.oneuldo.android.R;

/**
 * 홈 화면 위젯 (WIDGET-01). "앱 안 켜도 마음이 보임"의 네이티브 쪽 절반.
 *
 * 시스템이 30분마다(widget_latest_info.xml 의 updatePeriodMillis) onUpdate 를 부른다.
 * 여기서는 두 단계로 그린다 —
 *  1. 캐시된 직전 내용을 **즉시** 붙인다. 네트워크를 기다리는 동안 빈 칸이 보이지 않게.
 *  2. 그다음 백그라운드에서 서버에 물어 다시 그린다(WidgetRefresher).
 *
 * 위젯이 하는 일은 "보여주기"와 "톡톡" 둘뿐이고, 둘 다 위젯 전용 토큰으로만 서버에 닿는다.
 * 로그인 세션은 웹뷰 안에 있어 여기서는 볼 수 없다 — 그래서 토큰이 따로 있다.
 */
public class LatestWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        WidgetItem cached = WidgetStore.readCachedItem(context);
        RemoteViews first = cached != null
            ? WidgetRenderer.item(context, cached, WidgetStore.readCachedPhoto(context), false)
            : WidgetRenderer.message(context, context.getString(R.string.widget_loading));
        manager.updateAppWidget(appWidgetIds, first);

        WidgetRefresher.refreshAsync(context);
    }

    /** 홈에 처음 놓였을 때. onUpdate 도 곧 오지만 기다리지 않고 바로 채운다. */
    @Override
    public void onEnabled(Context context) {
        WidgetRefresher.refreshAsync(context);
    }
}
