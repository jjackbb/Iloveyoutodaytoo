package app.oneuldo.android.widget;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Log;

import androidx.annotation.Nullable;

import java.io.File;
import java.io.FileOutputStream;

/**
 * 위젯이 읽고 쓰는 저장소.
 *
 * ① 토큰은 웹이 @capacitor/preferences 로 넣은 것을 읽기만 한다(위젯은 쓰지 않는다).
 * ② 마지막으로 성공한 응답과 사진은 캐시해 둔다 — 네트워크가 끊겼을 때 빈 위젯 대신
 *    직전 내용을 그대로 보여주기 위해서다.
 */
public final class WidgetStore {

    private static final String TAG = "OneuldoWidget";
    private static final String PHOTO_FILE = "widget_photo.png";

    private WidgetStore() {}

    private static SharedPreferences widgetPrefs(Context c) {
        return c.getSharedPreferences(WidgetContract.WIDGET_PREFS, Context.MODE_PRIVATE);
    }

    /** 웹(@capacitor/preferences)이 저장한 Bearer 토큰. 없으면 null. */
    @Nullable
    public static String readToken(Context c) {
        SharedPreferences p = c.getSharedPreferences(WidgetContract.CAP_PREFS, Context.MODE_PRIVATE);
        String token = p.getString(WidgetContract.KEY_TOKEN, null);
        if (token == null) return null;
        token = token.trim();
        return token.isEmpty() ? null : token;
    }

    @Nullable
    public static WidgetItem readCachedItem(Context c) {
        String json = widgetPrefs(c).getString(WidgetContract.KEY_CACHED_ITEM, null);
        if (json == null) return null;
        try {
            return WidgetItem.fromResponse(json);
        } catch (Exception e) {
            return null;
        }
    }

    /** 성공한 응답을 캐시한다. item 이 null(아무것도 없음)이어도 그 사실을 캐시한다. */
    public static void writeCachedItem(Context c, @Nullable WidgetItem item) {
        widgetPrefs(c)
            .edit()
            .putString(WidgetContract.KEY_CACHED_ITEM, item == null ? "{\"item\":null}" : item.toCacheJson())
            .apply();
    }

    public static void writeCachedPhoto(Context c, @Nullable Bitmap bitmap) {
        File f = new File(c.getFilesDir(), PHOTO_FILE);
        if (bitmap == null) {
            //noinspection ResultOfMethodCallIgnored
            f.delete();
            widgetPrefs(c).edit().remove(WidgetContract.KEY_CACHED_PHOTO).apply();
            return;
        }
        try (FileOutputStream out = new FileOutputStream(f)) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
            widgetPrefs(c).edit().putString(WidgetContract.KEY_CACHED_PHOTO, f.getAbsolutePath()).apply();
        } catch (Exception e) {
            Log.w(TAG, "사진 캐시 저장 실패", e);
        }
    }

    @Nullable
    public static Bitmap readCachedPhoto(Context c) {
        String path = widgetPrefs(c).getString(WidgetContract.KEY_CACHED_PHOTO, null);
        if (path == null) return null;
        try {
            return BitmapFactory.decodeFile(path);
        } catch (Throwable t) {
            return null;
        }
    }

    /** 설치 리퍼러는 딱 한 번만 읽는다. 이미 읽었으면 false. */
    public static boolean claimReferrerCheck(Context c) {
        SharedPreferences p = widgetPrefs(c);
        if (p.getBoolean(WidgetContract.KEY_REFERRER_DONE, false)) return false;
        p.edit().putBoolean(WidgetContract.KEY_REFERRER_DONE, true).apply();
        return true;
    }
}
