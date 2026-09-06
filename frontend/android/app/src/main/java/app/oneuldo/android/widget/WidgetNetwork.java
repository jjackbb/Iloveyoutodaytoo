package app.oneuldo.android.widget;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Log;

import androidx.annotation.Nullable;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * 위젯의 서버 통신. 전부 백그라운드 스레드에서만 부를 것 — 메인 스레드에서 부르면
 * NetworkOnMainThreadException 으로 앱이 죽는다.
 *
 * 라이브러리를 붙이지 않고 HttpURLConnection 만 쓴다. 요청이 두 개뿐이라 OkHttp 를
 * 넣을 이유가 없고, 위젯 프로세스의 시작 비용도 줄어든다.
 */
public final class WidgetNetwork {

    private static final String TAG = "OneuldoWidget";

    private WidgetNetwork() {}

    /** GET /api/widget/latest 의 결과. status 로 위젯이 무슨 문구를 띄울지 가른다. */
    public static final class LatestResult {
        public enum Status { OK, EMPTY, UNAUTHORIZED, FAILED }

        public final Status status;
        @Nullable public final WidgetItem item;

        LatestResult(Status status, @Nullable WidgetItem item) {
            this.status = status;
            this.item = item;
        }
    }

    public static LatestResult fetchLatest(String token) {
        HttpURLConnection conn = null;
        try {
            conn = open(WidgetContract.API_LATEST, "GET", token);
            int code = conn.getResponseCode();
            if (code == 401 || code == 403) {
                return new LatestResult(LatestResult.Status.UNAUTHORIZED, null);
            }
            if (code < 200 || code >= 300) {
                Log.w(TAG, "latest 응답 코드 " + code);
                return new LatestResult(LatestResult.Status.FAILED, null);
            }
            String body = readAll(conn.getInputStream());
            WidgetItem item = WidgetItem.fromResponse(body);
            return item == null
                ? new LatestResult(LatestResult.Status.EMPTY, null)
                : new LatestResult(LatestResult.Status.OK, item);
        } catch (Exception e) {
            Log.w(TAG, "latest 호출 실패", e);
            return new LatestResult(LatestResult.Status.FAILED, null);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /** POST /api/widget/knock. 200 이면 true. */
    public static boolean postKnock(String token, String targetUserId, String memoryId) {
        HttpURLConnection conn = null;
        try {
            JSONObject payload = new JSONObject();
            payload.put("targetUserId", targetUserId);
            payload.put("memoryId", memoryId);
            byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);

            conn = open(WidgetContract.API_KNOCK, "POST", token);
            conn.setDoOutput(true);
            conn.setFixedLengthStreamingMode(body.length);
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            try (OutputStream out = conn.getOutputStream()) {
                out.write(body);
            }

            int code = conn.getResponseCode();
            if (code != 200) {
                Log.w(TAG, "knock 응답 코드 " + code);
                return false;
            }
            return new JSONObject(readAll(conn.getInputStream())).optBoolean("ok", false);
        } catch (Exception e) {
            Log.w(TAG, "knock 호출 실패", e);
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /**
     * 사진을 받아 위젯에 넣을 수 있는 크기로 줄인다.
     *
     * RemoteViews 의 비트맵은 Binder 트랜잭션(약 1MB)에 실려 건너가므로, 원본을 그대로
     * 넣으면 조용히 위젯이 비어 버린다. 긴 변 512px 이 상한이고, 그와 별개로 총 픽셀 수도
     * 눌러 담는다(썸네일이 64dp 라 그 이상은 어차피 안 보인다).
     */
    @Nullable
    public static Bitmap fetchPhoto(String urlString) {
        HttpURLConnection conn = null;
        try {
            conn = open(urlString, "GET", null);
            if (conn.getResponseCode() != 200) return null;
            byte[] raw = readAllBytes(conn.getInputStream());

            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(raw, 0, raw.length, bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight);
            Bitmap decoded = BitmapFactory.decodeByteArray(raw, 0, raw.length, opts);
            if (decoded == null) return null;

            return clampScale(decoded);
        } catch (Exception e) {
            Log.w(TAG, "사진 내려받기 실패", e);
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static int sampleSize(int w, int h) {
        int sample = 1;
        while ((long) (w / sample) * (h / sample) > (long) WidgetContract.PHOTO_MAX_PIXELS * 4) {
            sample *= 2;
        }
        return sample;
    }

    /** 긴 변 512px 이하 + 총 픽셀 상한을 둘 다 만족할 때까지 줄인다. */
    private static Bitmap clampScale(Bitmap src) {
        int w = src.getWidth();
        int h = src.getHeight();
        float scale = 1f;

        int longEdge = Math.max(w, h);
        if (longEdge > WidgetContract.PHOTO_MAX_EDGE_PX) {
            scale = (float) WidgetContract.PHOTO_MAX_EDGE_PX / longEdge;
        }
        long pixels = (long) Math.round(w * scale) * Math.round(h * scale);
        if (pixels > WidgetContract.PHOTO_MAX_PIXELS) {
            scale *= (float) Math.sqrt((double) WidgetContract.PHOTO_MAX_PIXELS / pixels);
        }
        if (scale >= 1f) return src;

        int nw = Math.max(1, Math.round(w * scale));
        int nh = Math.max(1, Math.round(h * scale));
        Bitmap scaled = Bitmap.createScaledBitmap(src, nw, nh, true);
        if (scaled != src) src.recycle();
        return scaled;
    }

    private static HttpURLConnection open(String url, String method, @Nullable String token) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setRequestMethod(method);
        conn.setConnectTimeout(WidgetContract.CONNECT_TIMEOUT_MS);
        conn.setReadTimeout(WidgetContract.READ_TIMEOUT_MS);
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("Accept", "application/json");
        conn.setRequestProperty("User-Agent", "OneuldoApp/1.0 (widget)");
        if (token != null) conn.setRequestProperty("Authorization", "Bearer " + token);
        return conn;
    }

    private static String readAll(InputStream in) throws IOException {
        return new String(readAllBytes(in), StandardCharsets.UTF_8);
    }

    private static byte[] readAllBytes(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        in.close();
        return out.toByteArray();
    }
}
