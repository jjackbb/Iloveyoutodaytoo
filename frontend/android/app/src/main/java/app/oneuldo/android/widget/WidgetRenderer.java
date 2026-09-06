package app.oneuldo.android.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.view.View;

import androidx.annotation.Nullable;

import app.oneuldo.android.MainActivity;
import app.oneuldo.android.R;

import android.widget.RemoteViews;

/**
 * 위젯 화면을 만들어 실제로 붙이는 곳. 여기 말고 다른 데서 RemoteViews 를 만들지 않는다.
 *
 * 본문 탭과 딥링크는 같은 통로를 쓴다 — MainActivity 에 VIEW 인텐트를 던지면
 * Capacitor 의 App 플러그인이 appUrlOpen 으로 JS 에 올려 주고, 웹이 그 경로로 이동한다.
 * 그래서 위젯은 "어느 화면으로 갈지"를 URL 로만 말하고 네비게이션은 웹에 맡긴다.
 */
public final class WidgetRenderer {

    private WidgetRenderer() {}

    public static int[] widgetIds(Context context) {
        return AppWidgetManager
            .getInstance(context)
            .getAppWidgetIds(new ComponentName(context, LatestWidgetProvider.class));
    }

    /** 지금 붙어 있는 모든 위젯에 같은 화면을 적용한다. */
    public static void apply(Context context, RemoteViews views) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = widgetIds(context);
        if (ids.length == 0) return;
        manager.updateAppWidget(ids, views);
    }

    /** 문구 한 줄만 있는 화면(빈 상태 · 로그인 필요 · 오프라인 · 로딩). */
    public static RemoteViews message(Context context, String text) {
        RemoteViews views = base(context);
        views.setViewVisibility(R.id.widget_photo, View.GONE);
        views.setViewVisibility(R.id.widget_knock, View.GONE);
        views.setTextViewText(R.id.widget_title, text);
        views.setViewVisibility(R.id.widget_subtitle, View.GONE);
        views.setOnClickPendingIntent(R.id.widget_root, openApp(context, WidgetContract.BASE_URL));
        return views;
    }

    /**
     * 표현 1건을 보여주는 화면.
     *
     * @param knockLabelDone 톡톡을 막 눌렀으면 true — 단추 글자를 잠깐 "톡톡했어요"로 바꾼다.
     */
    public static RemoteViews item(
        Context context,
        WidgetItem item,
        @Nullable Bitmap photo,
        boolean knockLabelDone
    ) {
        RemoteViews views = base(context);

        String name = item.authorName != null
            ? item.authorName
            : context.getString(R.string.widget_author_unknown);
        views.setTextViewText(R.id.widget_title, context.getString(R.string.widget_author_suffix, name));

        String subtitle = subtitleOf(context, item);
        if (subtitle == null) {
            views.setViewVisibility(R.id.widget_subtitle, View.GONE);
        } else {
            views.setViewVisibility(R.id.widget_subtitle, View.VISIBLE);
            views.setTextViewText(R.id.widget_subtitle, subtitle);
        }

        // 사진이 없으면 회색 자리만 남기지 않고 아예 접는다 — 글이 넓게 보이는 편이 낫다.
        if (photo != null) {
            views.setViewVisibility(R.id.widget_photo, View.VISIBLE);
            views.setImageViewBitmap(R.id.widget_photo, photo);
        } else {
            views.setViewVisibility(R.id.widget_photo, View.GONE);
        }

        // 내 것에는 톡톡을 보내지 않는다(자기 자신에게 알림이 갈 이유가 없다).
        if (item.isMine || item.authorId == null) {
            views.setViewVisibility(R.id.widget_knock, View.GONE);
        } else {
            views.setViewVisibility(R.id.widget_knock, View.VISIBLE);
            views.setTextViewText(
                R.id.widget_knock,
                context.getString(knockLabelDone ? R.string.widget_knock_done : R.string.widget_knock)
            );
            views.setOnClickPendingIntent(R.id.widget_knock, knock(context, item));
        }

        views.setOnClickPendingIntent(R.id.widget_root, openApp(context, item.deepLinkUrl()));
        return views;
    }

    /** 보조 한 줄: 문구 > 목소리 > 손글씨 순으로 하나만 고른다. */
    @Nullable
    private static String subtitleOf(Context context, WidgetItem item) {
        if (item.caption != null) return item.caption;
        if (item.voiceDurationSec != null) {
            return context.getString(R.string.widget_voice_seconds, item.voiceDurationSec);
        }
        if (item.hasHandwriting) return context.getString(R.string.widget_handwriting);
        return null;
    }

    private static RemoteViews base(Context context) {
        return new RemoteViews(context.getPackageName(), R.layout.widget_latest);
    }

    /**
     * 앱을 URL 로 여는 PendingIntent.
     * MainActivity 는 singleTask 라 이미 떠 있으면 onNewIntent 로, 꺼져 있으면
     * onCreate 안에서 같은 경로로 흘러들어 appUrlOpen 이 뜬다.
     */
    private static PendingIntent openApp(Context context, String url) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.setClass(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        // requestCode 를 URL 해시로 둬야 위젯 여러 개일 때 PendingIntent 가 서로 덮어쓰지 않는다.
        return PendingIntent.getActivity(context, url.hashCode(), intent, flags());
    }

    private static PendingIntent knock(Context context, WidgetItem item) {
        Intent intent = new Intent(context, WidgetKnockReceiver.class);
        intent.setAction(WidgetContract.ACTION_KNOCK);
        intent.putExtra(WidgetContract.EXTRA_TARGET_USER_ID, item.authorId);
        intent.putExtra(WidgetContract.EXTRA_MEMORY_ID, item.memoryId);
        return PendingIntent.getBroadcast(context, item.memoryId.hashCode(), intent, flags());
    }

    private static int flags() {
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            f |= PendingIntent.FLAG_IMMUTABLE;
        }
        return f;
    }
}
