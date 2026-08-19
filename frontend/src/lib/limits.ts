/**
 * 입력 상한값 모음.
 *
 * 왜 별도 파일인가:
 * 1) Server Action 파일('use server')은 async 함수만 export할 수 있다.
 *    상수를 거기 두면 빌드가 통째로 깨진다. 그래서 상수는 여기 모은다.
 * 2) 같은 숫자가 서버 검증(actions)과 화면 표시(글자수 세기 등) 양쪽에 필요한데,
 *    각자 따로 적어두면 한쪽만 고쳐져 조용히 어긋난다.
 *
 * 아래 값은 DB의 CHECK 제약과 반드시 같아야 한다.
 * - heart_messages: text_length_limit(300), duration_matches_type(voice 3~60초)
 * 값을 바꾸려면 DB 제약도 함께 봐야 한다. 스키마 변경은 임의로 하지 않는다.
 */

/** 방 이름 최대 길이. 시니어 화면에서 한 줄에 읽히는 정도로 넉넉하게 잡았다. */
export const ROOM_NAME_MAX_LENGTH = 20

/**
 * 방별 별명의 최대 길이 (더보기 서랍의 "별명 설정").
 * DB CHECK room_members_nickname_length와 같은 값이다.
 * 방 이름과 같은 20자 — 시니어 화면에서 한 줄에 읽히는 길이다.
 */
export const ROOM_NICKNAME_MAX_LENGTH = 20

/** 글 한마디 최대 글자수. DB CHECK text_length_limit과 같은 값이다. */
export const TEXT_MAX_LENGTH = 300

/** 음성 한마디 최소 길이(초). DB CHECK duration_matches_type과 같은 값이다. */
export const VOICE_MIN_SEC = 3

/** 음성 한마디 최대 길이(초). DB CHECK duration_matches_type과 같은 값이다. */
export const VOICE_MAX_SEC = 60

/**
 * 추억 게시물 한 개에 담을 수 있는 사진 수 (캡처 12 "0/10").
 * DB CHECK memory_photos.sort_order < 10 과 같은 값이다.
 */
export const PHOTO_MAX_COUNT = 10

/**
 * 추억 게시물 문구의 최대 글자 수.
 * DB CHECK memories_description_length와 같은 값이다.
 */
export const CAPTION_MAX_LENGTH = 300

/**
 * 마음 보내기 한 번에 실제로 나가는 마음의 최대 통수 (캡처 40~45).
 *
 * 시트에서 고르는 항목 수가 아니라 **풀어낸 뒤의 통수**를 센다 —
 * "{방} (전체)" 하나가 그 방 멤버 수만큼 늘어나기 때문이다.
 * 한 통마다 서버 왕복이 한 번씩이라, 너무 크면 보내는 동안 화면이 오래 멈춘다.
 */
export const HEART_SEND_MAX_TARGETS = 20

/**
 * 신고할 때 적는 '자세한 내용'의 최대 글자 수.
 *
 * reports.detail은 자유 텍스트라 DB에 길이 CHECK가 없다. 서버가 이 값으로 막는다.
 * (원래 components/report/reasons.ts에 있었는데, 길이 상한의 단일 출처는 여기다)
 */
export const REPORT_DETAIL_MAX_LENGTH = 500

/**
 * 비밀번호 최소 길이.
 *
 * 가입(actions/auth.ts)과 비밀번호 변경(actions/profile.ts)이 같은 규칙을 써야 한다.
 * 한쪽만 느슨하면 "가입은 됐는데 바꾸려니 안 된다"가 된다.
 * Supabase Auth 대시보드의 최소 길이 설정보다 낮게 잡지 마라 — 그쪽이 더 깐깐하면
 * 화면에서 통과한 값이 서버에서 거절된다.
 */
export const PASSWORD_MIN_LENGTH = 8

/**
 * 답장 미션이 걸리는 기준 (PRD [MISSION-01] 수정안 1).
 *
 * "한 사람이 보낸 마음 중, 내가 **듣고도 답장하지 않은 것**"이 이 수에 이르면
 * 그 사람의 다음 마음이 잠긴다. 즉 6번째부터 잠긴다.
 *
 * DB의 locked_senders() 안에도 같은 숫자가 박혀 있다. 바꾸려면 둘 다 고쳐야 한다 —
 * 진짜 관문은 DB 쪽이고, 이 값은 화면에 "N개 남았어요"를 적기 위한 것이다.
 */
export const MISSION_UNREPLIED_LIMIT = 5
