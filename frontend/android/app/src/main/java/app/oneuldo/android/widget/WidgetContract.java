package app.oneuldo.android.widget;

/**
 * 위젯이 쓰는 상수 한 곳. 서버 주소·저장소 이름·인텐트 액션을 여기서만 정한다.
 *
 * BASE_URL 은 capacitor.config.ts 의 server.url 과 같아야 한다. 위젯은 웹뷰 밖에서
 * 도는 네이티브 코드라 그 설정을 읽을 수 없어 여기 한 번 더 적는다 — 웹 주소가 바뀌면
 * 두 곳을 같이 고칠 것.
 */
public final class WidgetContract {

    private WidgetContract() {}

    public static final String BASE_URL = "https://iloveyoutodaytoo.vercel.app";

    public static final String API_LATEST = BASE_URL + "/api/widget/latest";
    public static final String API_KNOCK = BASE_URL + "/api/widget/knock";

    /**
     * @capacitor/preferences 안드로이드 구현이 실제로 쓰는 SharedPreferences 파일 이름.
     * node_modules/@capacitor/preferences/android/.../PreferencesConfiguration.java 에서
     * DEFAULTS.group = "CapacitorStorage" 로 확인했고, Preferences.java 는 키를 가공 없이
     * 그대로 putString 한다. 그래서 웹이 Preferences.set({key:'widget_token'}) 하면
     * 아래 그대로 읽힌다.
     */
    public static final String CAP_PREFS = "CapacitorStorage";
    public static final String KEY_TOKEN = "widget_token";

    /** 위젯 자체의 캐시 저장소 (Capacitor 것과 섞지 않는다). */
    public static final String WIDGET_PREFS = "oneuldo_widget";
    public static final String KEY_CACHED_ITEM = "cached_item";
    public static final String KEY_CACHED_PHOTO = "cached_photo_file";
    public static final String KEY_REFERRER_DONE = "install_referrer_checked";

    /** 톡톡 단추가 누르는 브로드캐스트. 우리 앱 안에서만 쓴다(exported=false). */
    public static final String ACTION_KNOCK = "app.oneuldo.android.widget.KNOCK";
    public static final String EXTRA_TARGET_USER_ID = "targetUserId";
    public static final String EXTRA_MEMORY_ID = "memoryId";

    /** 위젯 비트맵은 Binder 트랜잭션(1MB)을 타므로 넉넉히 아래로 눌러 담는다. */
    public static final int PHOTO_MAX_EDGE_PX = 512;
    public static final int PHOTO_MAX_PIXELS = 110_000; // ≈ 330x330, ARGB_8888 기준 440KB

    public static final int CONNECT_TIMEOUT_MS = 4000;
    public static final int READ_TIMEOUT_MS = 5000;

    /** 톡톡 후 "톡톡했어요"를 보여주는 시간. goAsync() 10초 예산 안에 들어가야 한다. */
    public static final long KNOCK_FEEDBACK_MS = 2500;
}
