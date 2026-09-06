package app.oneuldo.android.widget;

import androidx.annotation.Nullable;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * GET /api/widget/latest 의 item 하나. 서버가 보내는 필드를 그대로 담는다.
 *
 * 서버가 아직 배포 전이거나 필드가 빠져도 위젯이 죽지 않도록, 모든 읽기는
 * optString/optInt 로 하고 없으면 null·기본값으로 둔다.
 */
public final class WidgetItem {

    public final String memoryId;
    public final String roomId;
    public final String authorId;
    public final String authorName;
    @Nullable public final String photoUrl;
    @Nullable public final Integer voiceDurationSec;
    public final boolean hasHandwriting;
    @Nullable public final String caption;
    public final boolean isMine;

    private WidgetItem(
        String memoryId,
        String roomId,
        String authorId,
        String authorName,
        @Nullable String photoUrl,
        @Nullable Integer voiceDurationSec,
        boolean hasHandwriting,
        @Nullable String caption,
        boolean isMine
    ) {
        this.memoryId = memoryId;
        this.roomId = roomId;
        this.authorId = authorId;
        this.authorName = authorName;
        this.photoUrl = photoUrl;
        this.voiceDurationSec = voiceDurationSec;
        this.hasHandwriting = hasHandwriting;
        this.caption = caption;
        this.isMine = isMine;
    }

    /** 응답 본문 전체({"item": …})에서 item 을 꺼낸다. item 이 null 이면 null 을 돌려준다. */
    @Nullable
    public static WidgetItem fromResponse(String body) throws JSONException {
        JSONObject root = new JSONObject(body);
        if (root.isNull("item")) return null;
        return fromJson(root.getJSONObject("item"));
    }

    @Nullable
    public static WidgetItem fromJson(JSONObject o) {
        String memoryId = nullable(o.optString("memoryId", null));
        String roomId = nullable(o.optString("roomId", null));
        if (memoryId == null || roomId == null) return null;

        Integer voice = o.isNull("voiceDurationSec") ? null : o.optInt("voiceDurationSec", 0);
        if (voice != null && voice <= 0) voice = null;

        return new WidgetItem(
            memoryId,
            roomId,
            nullable(o.optString("authorId", null)),
            nullable(o.optString("authorName", null)),
            nullable(o.optString("photoUrl", null)),
            voice,
            o.optBoolean("hasHandwriting", false),
            nullable(o.optString("caption", null)),
            o.optBoolean("isMine", false)
        );
    }

    /** 캐시에 다시 넣을 수 있게 원래 모양({"item": …})으로 되돌린다. */
    public String toCacheJson() {
        JSONObject item = new JSONObject();
        try {
            item.put("memoryId", memoryId);
            item.put("roomId", roomId);
            item.put("authorId", authorId == null ? JSONObject.NULL : authorId);
            item.put("authorName", authorName == null ? JSONObject.NULL : authorName);
            item.put("photoUrl", photoUrl == null ? JSONObject.NULL : photoUrl);
            item.put("voiceDurationSec", voiceDurationSec == null ? JSONObject.NULL : voiceDurationSec);
            item.put("hasHandwriting", hasHandwriting);
            item.put("caption", caption == null ? JSONObject.NULL : caption);
            item.put("isMine", isMine);
            JSONObject root = new JSONObject();
            root.put("item", item);
            return root.toString();
        } catch (JSONException e) {
            return "{\"item\":null}";
        }
    }

    /** 본문을 눌렀을 때 열 화면. 딥링크와 같은 통로(VIEW 인텐트)로 보낸다. */
    public String deepLinkUrl() {
        return WidgetContract.BASE_URL + "/rooms/" + roomId + "/memories/" + memoryId;
    }

    @Nullable
    private static String nullable(@Nullable String s) {
        if (s == null) return null;
        String t = s.trim();
        return (t.isEmpty() || "null".equals(t)) ? null : t;
    }
}
