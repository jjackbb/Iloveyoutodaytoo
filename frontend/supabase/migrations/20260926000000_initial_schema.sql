-- 오늘도 사랑해 — 빈 Supabase 프로젝트용 초기 마이그레이션 (2026-09-26)
--
-- 이 파일은 ../schema/ 의 옛 스냅샷(2026-09-06)을 "구조 자료"로 읽고 새로 짰다.
-- 스냅샷은 생성 순서가 틀려 그대로 실행되지 않고, 삭제된 옛 DB를 전제로 한다.
-- 과거 데이터는 복원하지 않는다(사용자 결정). 원격 프로젝트 적용은 이 파일의 범위가 아니다.
--
-- 옛 스냅샷과 달라진 점 (근거: 문서/12_클로드_연속실행_지시서.md 2절)
--   1. 관계 유형(rooms.relationship_type)과 답장 잠금(replied_at·locked_senders·unlock_on_reply)
--      을 활성 DB에서 뺐다. 초대장의 자유 입력 호칭(relationship_label)은 그대로다.
--   2. 추억은 저장하는 순간의 활성 참여자 수로 공개 범위가 정해지고 바뀌지 않는다.
--      1명이면 private(작성자만), 2명 이상이면 room(방 공유). 방 행을 잠가 직렬화한다.
--   3. 추억 영상 1개(video_path·video_duration_ms, 0~30초)와 video 버킷(50MB)을 더했다.
--   4. 음성은 추억·댓글·사서함 모두 0~60초. 사서함 영상 작성은 막는다.
--   5. public.users 는 방 참여자에게 보여도 되는 것(이름·프로필 사진)만 둔다.
--      생년월일·보호자·연락처·아이디는 public.user_private — 본인만 읽는다.
--   6. Storage 읽기는 "경로의 방 id"가 아니라 "내가 읽을 수 있는 기록에 연결된 파일"로 판단한다.
--   7. 추억 삭제는 행을 완전히 지우고(댓글·반응·알림 함께), 연결 파일은 삭제 작업표에 적어
--      파일 삭제가 실패해도 다시 시도할 수 있게 한다.
--   8. 만 14세 미만 가입은 보호자 확인 기능이 완성되기 전까지 DB에서 막는다.
--      체크박스나 미검증 전화번호는 확인 완료가 아니다.

-- ─────────────────────────────────────────────────────────────
-- 0. 확장과 열거형
-- ─────────────────────────────────────────────────────────────

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;

create type public.auth_provider as enum ('email', 'kakao', 'google', 'phone');
create type public.member_role as enum ('admin', 'member');
create type public.member_status as enum ('active', 'left');
-- 'video' 는 옛 사서함 화면의 표시 분기(MessageBubble 등) 때문에 값만 남긴다.
-- 새 영상 메시지는 heart_messages_type_allowed 제약이 막는다(사서함 영상 작성은 범위 밖).
create type public.message_type as enum ('text', 'voice', 'video');
create type public.notification_type as enum (
  'memory_created', 'comment_created', 'member_joined', 'heart_received', 'knock'
);
create type public.memory_visibility as enum ('private', 'room');
-- 사서함 보내기 방식. 옛 DB는 text + CHECK 였고 앱 타입만 enum 처럼 썼다. 이제 DB도 같은 모양이다.
create type public.send_mode as enum ('direct', 'broadcast', 'random');

-- ─────────────────────────────────────────────────────────────
-- 1. 사람
-- ─────────────────────────────────────────────────────────────

-- 방 참여자에게 보여도 되는 프로필만.
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  profile_image text,
  created_at    timestamptz not null default now()
);
comment on table public.users is
  '방 참여자에게 보이는 프로필(이름·프로필 사진). 개인 정보는 user_private.';

-- 본인만 읽는 계정 정보. 가입 트리거만 만든다.
create table public.user_private (
  id                    uuid primary key references public.users(id) on delete cascade,
  username              text,
  email                 text,
  phone                 text unique,
  auth_provider         public.auth_provider not null default 'email',
  birth_date            date not null,
  guardian_name         text,
  guardian_phone        text,
  guardian_consented_at timestamptz,
  is_withdrawn          boolean not null default false,
  large_text            boolean not null default false,
  constraint user_private_username_format
    check (username is null or username ~ '^[a-z0-9]{4,16}$')
);
create unique index user_private_username_key on public.user_private (username);
comment on table public.user_private is
  '본인만 읽는 계정 정보(아이디·생년월일·보호자). 방 참여자에게 노출하지 않는다.';

-- ─────────────────────────────────────────────────────────────
-- 2. 앨범방·참여·초대
-- ─────────────────────────────────────────────────────────────

create table public.rooms (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  owner_id     uuid references public.users(id) on delete set null,
  theme        text,
  created_at   timestamptz not null default now(),
  cover_preset text not null default 'warm'
    check (cover_preset in ('warm', 'blush', 'sky', 'sage', 'dusk', 'sand')),
  cover_path   text
);

create table public.room_members (
  id                  uuid primary key default gen_random_uuid(),
  room_id             uuid not null references public.rooms(id) on delete cascade,
  user_id             uuid not null references public.users(id) on delete cascade,
  relationship_label  text not null,
  role                public.member_role not null default 'member',
  status              public.member_status not null default 'active',
  joined_at           timestamptz not null default now(),
  left_at             timestamptz,
  favorited           boolean not null default false,
  nickname            text,
  custom_name         text,
  custom_cover_preset text,
  custom_cover_path   text,
  constraint room_members_room_id_user_id_key unique (room_id, user_id),
  constraint left_at_matches_status check (
    (status = 'left' and left_at is not null) or (status = 'active' and left_at is null)
  ),
  constraint room_members_custom_cover_preset_check check (
    custom_cover_preset is null
    or custom_cover_preset in ('warm', 'blush', 'sky', 'sage', 'dusk', 'sand')
  ),
  constraint room_members_custom_name_length check (
    custom_name is null
    or (btrim(custom_name) = custom_name and char_length(custom_name) between 1 and 20)
  ),
  constraint room_members_nickname_length check (
    nickname is null
    or (btrim(nickname) = nickname and char_length(nickname) between 1 and 20)
  )
);

create table public.invitations (
  id                 uuid primary key default gen_random_uuid(),
  room_id            uuid not null references public.rooms(id) on delete cascade,
  inviter_id         uuid not null references public.users(id) on delete cascade,
  relationship_label text not null,
  invite_token       text not null unique,
  invite_message     text not null,
  expires_at         timestamptz,
  created_at         timestamptz not null default now(),
  used_at            timestamptz,
  used_by            uuid references public.users(id) on delete set null
);

-- ─────────────────────────────────────────────────────────────
-- 3. 추억과 딸린 것들
-- ─────────────────────────────────────────────────────────────

create table public.memories (
  id                      uuid primary key default gen_random_uuid(),
  room_id                 uuid not null references public.rooms(id) on delete cascade,
  author_id               uuid references public.users(id) on delete set null,
  -- 저장 순간 활성 참여자 1명 → private, 2명 이상 → room. 트리거가 정하고 바꾸지 않는다.
  visibility              public.memory_visibility not null default 'private',
  description             text,
  taken_at                date,
  created_at              timestamptz not null default now(),
  voice_path              text,
  voice_duration_sec      integer,
  voice_levels            real[],
  handwriting_path        text,
  handwriting_duration_ms integer,
  video_path              text,
  video_duration_ms       integer,
  pinned_at               timestamptz,
  constraint memories_description_length
    check (description is null or char_length(description) <= 300),
  constraint memories_voice_pair check (
    (voice_path is null and voice_duration_sec is null)
    or (voice_path is not null and voice_duration_sec is not null
        and voice_duration_sec between 0 and 60)
  ),
  constraint memories_voice_levels_needs_voice
    check (voice_levels is null or voice_path is not null),
  constraint memories_voice_levels_shape check (
    voice_levels is null
    or (array_length(voice_levels, 1) between 1 and 48
        and array_position(voice_levels, null::real) is null)
  ),
  constraint memories_handwriting_pair check (
    (handwriting_path is null and handwriting_duration_ms is null)
    or (handwriting_path is not null and handwriting_duration_ms is not null
        and handwriting_duration_ms between 0 and 600000)
  ),
  -- 영상: 최소 없음 · 최대 30초. 밀리초라 30.4초 같은 초과도 거른다.
  constraint memories_video_pair check (
    (video_path is null and video_duration_ms is null)
    or (video_path is not null and video_duration_ms is not null
        and video_duration_ms between 0 and 30000)
  )
);
create unique index memories_voice_path_key on public.memories (voice_path) where voice_path is not null;
create unique index memories_handwriting_path_key on public.memories (handwriting_path) where handwriting_path is not null;
create unique index memories_video_path_key on public.memories (video_path) where video_path is not null;

create table public.memory_photos (
  id           uuid primary key default gen_random_uuid(),
  memory_id    uuid not null references public.memories(id) on delete cascade,
  storage_path text not null unique,
  sort_order   integer not null check (sort_order >= 0 and sort_order < 10),
  created_at   timestamptz not null default now(),
  constraint memory_photos_order_unique unique (memory_id, sort_order)
);

create table public.memory_comments (
  id                 uuid primary key default gen_random_uuid(),
  memory_id          uuid not null references public.memories(id) on delete cascade,
  author_id          uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  body               text,
  voice_path         text,
  voice_duration_sec integer,
  voice_levels       real[],
  edited_at          timestamptz,
  constraint memory_comments_body_length check (
    body is null or char_length(btrim(body)) between 1 and 300
  ),
  constraint memory_comments_kind check (
    (body is not null and voice_path is null and voice_duration_sec is null)
    or (body is null and voice_path is not null and voice_duration_sec is not null
        and voice_duration_sec between 0 and 60)
  ),
  constraint memory_comments_voice_levels_needs_voice
    check (voice_levels is null or voice_path is not null),
  constraint memory_comments_voice_levels_shape check (
    voice_levels is null
    or (array_length(voice_levels, 1) between 1 and 48
        and array_position(voice_levels, null::real) is null)
  )
);
create unique index memory_comments_voice_path_key on public.memory_comments (voice_path) where voice_path is not null;

create table public.memory_likes (
  id         uuid primary key default gen_random_uuid(),
  memory_id  uuid not null references public.memories(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint memory_likes_memory_id_user_id_key unique (memory_id, user_id)
);

create table public.memory_saves (
  id         uuid primary key default gen_random_uuid(),
  memory_id  uuid not null references public.memories(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint memory_saves_memory_id_user_id_key unique (memory_id, user_id)
);

create table public.memory_hides (
  id         uuid primary key default gen_random_uuid(),
  memory_id  uuid not null references public.memories(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint memory_hides_memory_id_user_id_key unique (memory_id, user_id)
);

-- ─────────────────────────────────────────────────────────────
-- 4. 사서함(1:1 마음)
-- ─────────────────────────────────────────────────────────────

create table public.heart_messages (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  memory_id    uuid references public.memories(id) on delete set null,
  sender_id    uuid references public.users(id) on delete set null,
  receiver_id  uuid references public.users(id) on delete set null,
  type         public.message_type not null,
  content      text not null,
  duration_sec integer,
  prompt_used  text,
  created_at   timestamptz not null default now(),
  send_mode    public.send_mode not null default 'direct',
  voice_levels real[],
  read_at      timestamptz,
  constraint heart_messages_type_allowed check (type in ('text', 'voice')),
  constraint duration_matches_type check (
    (type = 'text' and duration_sec is null)
    or (type = 'voice' and duration_sec is not null and duration_sec between 0 and 60)
  ),
  constraint heart_messages_voice_levels_needs_voice
    check (voice_levels is null or type <> 'text'),
  constraint heart_messages_voice_levels_shape check (
    voice_levels is null
    or (array_length(voice_levels, 1) between 1 and 48
        and array_position(voice_levels, null::real) is null)
  ),
  constraint text_length_limit check (type <> 'text' or char_length(content) <= 300)
);

create table public.heart_message_favorites (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.heart_messages(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint heart_message_favorites_message_id_user_id_key unique (message_id, user_id)
);

create table public.heart_message_hides (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.heart_messages(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint heart_message_hides_message_id_user_id_key unique (message_id, user_id)
);

-- ─────────────────────────────────────────────────────────────
-- 5. 알림·차단·신고·푸시·위젯·기타
-- ─────────────────────────────────────────────────────────────

create table public.notifications (
  id               uuid primary key default gen_random_uuid(),
  recipient_id     uuid not null references public.users(id) on delete cascade,
  actor_id         uuid references public.users(id) on delete set null,
  type             public.notification_type not null,
  room_id          uuid references public.rooms(id) on delete cascade,
  memory_id        uuid references public.memories(id) on delete cascade,
  heart_message_id uuid references public.heart_messages(id) on delete cascade,
  read_at          timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  constraint notifications_not_self check (actor_id is null or actor_id <> recipient_id),
  constraint notifications_target_present check (
    case type
      when 'memory_created'  then (memory_id is not null and room_id is not null)
      when 'comment_created' then (memory_id is not null and room_id is not null)
      when 'member_joined'   then (room_id is not null)
      when 'heart_received'  then (heart_message_id is not null)
      when 'knock'           then (room_id is not null)
      else null::boolean
    end
  )
);

create table public.blocks (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocks_blocker_id_blocked_id_key unique (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete set null,
  target_type text not null check (target_type in ('user', 'heart_message', 'memory')),
  target_id   uuid not null,
  reason      text not null,
  detail      text,
  status      text not null default 'pending'
    check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now()
);

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  endpoint   text unique,
  p256dh     text,
  auth       text,
  created_at timestamptz not null default now(),
  platform   text not null default 'web' check (platform in ('web', 'ios', 'android')),
  token      text,
  constraint push_subscriptions_shape_check check (
    (platform = 'web' and endpoint is not null and p256dh is not null and auth is not null)
    or (platform in ('ios', 'android') and token is not null)
  )
);

create table public.withdrawal_reasons (
  id         uuid primary key default gen_random_uuid(),
  reason     text not null,
  detail     text,
  created_at timestamptz not null default now()
);

-- 보호자 확인 구조. 실제 확인 기능이 완성되기 전까지 가입 경로에서 쓰지 않는다.
-- RLS를 켜고 정책을 두지 않는다 = service_role 외 접근 금지(의도).
create table public.guardian_verifications (
  id             uuid primary key default gen_random_uuid(),
  guardian_phone text not null check (guardian_phone ~ '^01[0-9]{8,9}$'),
  code_hash      text not null,
  expires_at     timestamptz not null,
  attempts       smallint not null default 0,
  verified_at    timestamptz,
  consumed_at    timestamptz,
  created_at     timestamptz not null default now()
);

create table public.daily_streaks (
  id               uuid primary key default gen_random_uuid(),
  room_member_id   uuid not null unique references public.room_members(id) on delete cascade,
  current_count    integer not null default 0 check (current_count >= 0),
  best_count       integer not null default 0 check (best_count >= 0),
  last_active_date date
);

create table public.widget_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

-- 추억 삭제 뒤 아직 지우지 못한 파일. 파일 삭제가 실패해도 여기 남아 다시 시도한다.
-- requested_by 는 외래 키가 아니다 — 요청한 사람이 탈퇴해도 정리할 목록은 남아야 한다.
create table public.storage_deletion_jobs (
  id           uuid primary key default gen_random_uuid(),
  requested_by uuid not null,
  bucket_id    text not null,
  object_name  text not null,
  reason       text not null default 'memory_deleted',
  created_at   timestamptz not null default now(),
  attempts     integer not null default 0,
  last_error   text,
  -- 지금 지우는 중이라고 표시한 시각. Storage 삭제는 내부적으로 읽기 권한이 필요해서
  -- 이 시각부터 30초 동안만 요청한 사람에게 그 파일 읽기를 연다(아래 app_objects_select).
  claimed_at   timestamptz,
  constraint storage_deletion_jobs_object_key unique (bucket_id, object_name)
);

-- ─────────────────────────────────────────────────────────────
-- 6. 인덱스 (제약이 만드는 것 제외)
-- ─────────────────────────────────────────────────────────────

create index idx_blocks_blocked on public.blocks (blocked_id);
create index idx_blocks_blocker on public.blocks (blocker_id);
create index guardian_verifications_phone_created_idx on public.guardian_verifications (guardian_phone, created_at desc);
create index heart_message_favorites_user_message_idx on public.heart_message_favorites (user_id, message_id);
create index heart_message_hides_user_idx on public.heart_message_hides (user_id, message_id);
create index idx_hm_memory on public.heart_messages (memory_id);
create index idx_hm_receiver_created on public.heart_messages (receiver_id, created_at desc);
create index idx_hm_room_created on public.heart_messages (room_id, created_at desc);
create index idx_hm_sender_created on public.heart_messages (sender_id, created_at desc);
create index idx_invitations_inviter on public.invitations (inviter_id);
create index idx_invitations_room on public.invitations (room_id);
create index idx_invitations_unused on public.invitations (room_id) where used_at is null;
create index idx_invitations_used_by on public.invitations (used_by);
create index idx_memories_author on public.memories (author_id);
create index idx_memories_room_created on public.memories (room_id, created_at desc);
create unique index memories_one_pin_per_room_idx on public.memories (room_id) where pinned_at is not null;
create index memories_room_pinned_created_idx on public.memories (room_id, pinned_at desc nulls last, created_at desc);
create index memory_comments_author_idx on public.memory_comments (author_id);
create index memory_comments_memory_idx on public.memory_comments (memory_id, created_at) where deleted_at is null;
create index memory_hides_memory_idx on public.memory_hides (memory_id);
create index memory_hides_user_idx on public.memory_hides (user_id);
create index memory_likes_memory_idx on public.memory_likes (memory_id);
create index memory_likes_user_idx on public.memory_likes (user_id);
create index memory_photos_memory_idx on public.memory_photos (memory_id, sort_order);
create index memory_saves_memory_idx on public.memory_saves (memory_id);
create index memory_saves_user_idx on public.memory_saves (user_id);
create index notifications_inbox_idx on public.notifications (recipient_id, created_at desc) where deleted_at is null;
create unique index push_subscriptions_token_key on public.push_subscriptions (token) where token is not null;
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index idx_reports_reporter on public.reports (reporter_id);
create index idx_reports_status on public.reports (status, created_at desc);
create index idx_room_members_room on public.room_members (room_id) where status = 'active';
create index idx_room_members_user on public.room_members (user_id) where status = 'active';
create index room_members_user_favorited_idx on public.room_members (user_id, favorited) where status = 'active';
create index idx_rooms_owner on public.rooms (owner_id);
create index widget_tokens_user_idx on public.widget_tokens (user_id);
create index storage_deletion_jobs_requester_idx on public.storage_deletion_jobs (requested_by);

-- ─────────────────────────────────────────────────────────────
-- 7. 권한 도우미 함수 — RLS 정책이 여기에 기댄다
-- ─────────────────────────────────────────────────────────────

create or replace function public.is_room_member(p_room_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.room_members
     where room_id = p_room_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_room_admin(p_room_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.room_members
     where room_id = p_room_id and user_id = auth.uid()
       and status = 'active' and role = 'admin'
  );
$$;

create or replace function public.shares_room_with(p_user_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1
      from public.room_members a
      join public.room_members b on a.room_id = b.room_id
     where a.user_id = auth.uid() and a.status = 'active'
       and b.user_id = p_user_id  and b.status = 'active'
  );
$$;

create or replace function public.has_blocked(p_blocked uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select p_blocked is not null and exists (
    select 1 from public.blocks
     where blocker_id = auth.uid() and blocked_id = p_blocked
  );
$$;

create or replace function public.owns_room_member(p_room_member_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.room_members
     where id = p_room_member_id and user_id = auth.uid()
  );
$$;

-- 추억을 읽을 수 있는가. 추억·사진·영상·음성·손글씨·댓글·반응·알림·파일 서명이 모두 이 한 규칙을 쓴다.
--   - 지금 그 방의 활성 참여자여야 한다(떠난 사람은 못 읽는다).
--   - private: 작성자 본인만.
--   - room: 활성 참여자 모두. 내가 차단한 작성자의 글은 빼고 본다.
create or replace function public.can_read_memory(p_memory_id uuid)
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.memories m
     where m.id = p_memory_id
       and public.is_room_member(m.room_id)
       and (
         m.author_id = auth.uid()
         or (m.visibility = 'room' and not public.has_blocked(m.author_id))
       )
  );
$$;

create or replace function public.path_uuid(p_name text)
 returns uuid language plpgsql immutable set search_path to 'public'
as $$
declare v uuid;
begin
  begin
    v := split_part(p_name, '/', 1)::uuid;
  exception when others then
    return null;
  end;
  return v;
end;
$$;

-- 파일이 "지금 로그인한 사람이 올린 것"인가. 남이 올린 파일 경로를 내 기록에 붙여
-- 공개 범위를 넓히는 것을 막는다. auth.uid() 가 없으면(관리 작업) 검사하지 않는다.
create or replace function public.assert_own_upload(p_bucket text, p_path text)
 returns void language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if p_path is null or auth.uid() is null then
    return;
  end if;
  if not exists (
    select 1 from storage.objects o
     where o.bucket_id = p_bucket and o.name = p_path
       and o.owner_id = auth.uid()::text
  ) then
    raise exception '올린 파일을 확인하지 못했습니다. (%/%)', p_bucket, p_path
      using errcode = '23514';
  end if;
end;
$$;

-- 이 파일을 지금 로그인한 사람이 읽거나 서명해도 되는가.
-- 경로의 방 id 가 아니라 "내가 읽을 수 있는 기록에 연결되어 있는가"를 본다.
create or replace function public.can_read_storage_object(p_bucket text, p_name text)
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select case p_bucket
    when 'media' then exists (
      select 1 from public.memory_photos p
       where p.storage_path = p_name and public.can_read_memory(p.memory_id))
    when 'video' then exists (
      select 1 from public.memories m
       where m.video_path = p_name and public.can_read_memory(m.id))
    when 'handwriting' then exists (
      select 1 from public.memories m
       where m.handwriting_path = p_name and public.can_read_memory(m.id))
    when 'voice' then (
      exists (
        select 1 from public.memories m
         where m.voice_path = p_name and public.can_read_memory(m.id))
      or exists (
        select 1 from public.memory_comments c
         where c.voice_path = p_name and c.deleted_at is null
           and public.can_read_memory(c.memory_id)
           and not public.has_blocked(c.author_id))
      or exists (
        select 1 from public.heart_messages h
         where h.type = 'voice'
           and (h.content = p_name or h.content = 'voice/' || p_name)
           and (h.sender_id = auth.uid()
                or (h.receiver_id = auth.uid() and not public.has_blocked(h.sender_id))))
    )
    when 'covers' then (
      exists (
        select 1 from public.rooms r
         where r.cover_path = p_name and public.is_room_member(r.id))
      or exists (
        select 1 from public.room_members rm
         where rm.custom_cover_path = p_name and rm.user_id = auth.uid()
           and rm.status = 'active')
    )
    when 'avatars' then exists (
      select 1 from public.users u
       where u.profile_image = p_name
         and (u.id = auth.uid() or public.shares_room_with(u.id)))
    else false
  end;
$$;

-- 이 파일이 삭제 정리 목록에 올라 있는가. 정책 안에서 목록을 직접 읽으면 목록의 RLS
-- (요청한 본인만 보기)에 걸려 다른 사람 눈에는 "목록에 없음"으로 보인다 — 그래서 함수로 본다.
create or replace function public.storage_object_pending_deletion(p_bucket text, p_name text)
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.storage_deletion_jobs j
     where j.bucket_id = p_bucket and j.object_name = p_name
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. 트리거 함수
-- ─────────────────────────────────────────────────────────────

-- 가입: auth.users → users + user_private.
-- 생년월일은 모든 가입 경로에서 필수. 만 14세 미만은 보호자 확인 기능 완성 전까지 막는다.
create or replace function public.handle_new_user()
 returns trigger language plpgsql security definer set search_path to ''
as $$
declare
  v_provider public.auth_provider;
  v_birth    date;
begin
  v_provider := coalesce(
    nullif(new.raw_app_meta_data->>'provider', '')::public.auth_provider,
    'email'
  );

  if nullif(new.raw_user_meta_data->>'birth_date', '') is null then
    raise exception '생년월일 없이 가입할 수 없습니다. (만 14세 미만 판별 필수)';
  end if;
  v_birth := (new.raw_user_meta_data->>'birth_date')::date;

  insert into public.users (id, name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name', ''), '이름 없음'));

  -- 보호자 이름·전화·동의 체크는 받아도 확인 완료로 적지 않는다(guardian_consented_at = null).
  -- 그래서 만 14세 미만이면 아래 enforce_guardian_consent 가 가입을 막는다.
  insert into public.user_private (
    id, username, email, birth_date, auth_provider, guardian_name, guardian_phone
  ) values (
    new.id,
    nullif(new.raw_user_meta_data->>'username', ''),
    case when new.email ilike '%@id.oneuldo.local' then null else new.email end,
    v_birth,
    v_provider,
    nullif(new.raw_user_meta_data->>'guardian_name', ''),
    nullif(new.raw_user_meta_data->>'guardian_phone', '')
  );
  return new;
end;
$$;

-- 만 14세 미만 가입 차단. guardian_consented_at 은 앱 사용자가 직접 쓸 수 없다(열 권한 없음).
-- 실제 보호자 확인 기능을 붙일 때 service_role 경로에서만 채우도록 설계한다.
create or replace function public.enforce_guardian_consent()
 returns trigger language plpgsql set search_path to 'public'
as $$
begin
  if new.birth_date > (current_date - interval '14 years')::date
     and new.guardian_consented_at is null then
    raise exception '만 14세 미만은 보호자 확인이 끝난 뒤에 가입할 수 있습니다.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.add_owner_as_member()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  insert into public.room_members (room_id, user_id, relationship_label, role)
  values (new.id, new.owner_id, '나', 'admin');
  return new;
end;
$$;

-- 참여자 변동(입장·재입장·나가기)은 방 행을 잠근 뒤에 일어난다.
-- 추억 저장도 같은 방 행을 잠그므로, 둘이 동시에 일어나도 순서가 정해져
-- "저장 순간 활성 참여자 수"가 뒤집히지 않는다.
create or replace function public.room_members_lock_room()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    perform 1 from public.rooms where id = new.room_id for update;
  end if;
  return new;
end;
$$;

create or replace function public.memories_before_write()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare
  v_active integer;
begin
  if tg_op = 'INSERT' then
    -- 방 행 잠금 → 활성 참여자 수 → 공개 범위. 입력값은 믿지 않는다.
    perform 1 from public.rooms where id = new.room_id for update;
    select count(*) into v_active
      from public.room_members
     where room_id = new.room_id and status = 'active';
    new.visibility := case when v_active >= 2 then 'room' else 'private' end::public.memory_visibility;
  else
    -- 저장 뒤에는 방·작성자·공개 범위를 바꾸지 않는다.
    new.visibility := old.visibility;
    new.room_id := old.room_id;
    new.author_id := case when new.author_id is null then null else old.author_id end;
  end if;

  -- 파일 경로는 이 방 폴더여야 하고, 지금 저장하는 사람이 올린 파일이어야 한다.
  if new.voice_path is not null and (tg_op = 'INSERT' or new.voice_path is distinct from old.voice_path) then
    if public.path_uuid(new.voice_path) is distinct from new.room_id then
      raise exception '녹음 파일 경로가 이 방의 것이 아닙니다.' using errcode = '23514';
    end if;
    perform public.assert_own_upload('voice', new.voice_path);
  end if;
  if new.handwriting_path is not null and (tg_op = 'INSERT' or new.handwriting_path is distinct from old.handwriting_path) then
    if public.path_uuid(new.handwriting_path) is distinct from new.room_id then
      raise exception '손글씨 파일 경로가 이 방의 것이 아닙니다.' using errcode = '23514';
    end if;
    perform public.assert_own_upload('handwriting', new.handwriting_path);
  end if;
  if new.video_path is not null and (tg_op = 'INSERT' or new.video_path is distinct from old.video_path) then
    if public.path_uuid(new.video_path) is distinct from new.room_id then
      raise exception '영상 파일 경로가 이 방의 것이 아닙니다.' using errcode = '23514';
    end if;
    perform public.assert_own_upload('video', new.video_path);
  end if;
  return new;
end;
$$;

create or replace function public.memory_photos_before_insert()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare
  v_room uuid;
begin
  select room_id into v_room from public.memories where id = new.memory_id;
  if public.path_uuid(new.storage_path) is distinct from v_room then
    raise exception '사진 경로가 이 방의 것이 아닙니다.' using errcode = '23514';
  end if;
  -- 고치기(updateMemory)는 사진 줄을 지웠다 다시 넣는다. 원래 붙어 있던 사진은
  -- 이미 이 추억의 작성자가 올린 파일이므로 같은 검사를 통과한다.
  perform public.assert_own_upload('media', new.storage_path);
  return new;
end;
$$;

create or replace function public.memory_comments_before_insert()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare
  v_room uuid;
begin
  if new.voice_path is not null then
    select room_id into v_room from public.memories where id = new.memory_id;
    if public.path_uuid(new.voice_path) is distinct from v_room then
      raise exception '녹음 파일 경로가 이 방의 것이 아닙니다.' using errcode = '23514';
    end if;
    perform public.assert_own_upload('voice', new.voice_path);
  end if;
  return new;
end;
$$;

create or replace function public.heart_messages_before_insert()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare
  v_path text;
begin
  if new.type = 'voice' then
    v_path := regexp_replace(new.content, '^voice/', '');
    if public.path_uuid(v_path) is distinct from new.room_id then
      raise exception '녹음 파일 경로가 이 방의 것이 아닙니다.' using errcode = '23514';
    end if;
    perform public.assert_own_upload('voice', v_path);
  end if;
  return new;
end;
$$;

create or replace function public.notify_room_members_of_memory()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  -- 작성자만 읽는 추억은 아무에게도 알리지 않는다.
  if new.visibility <> 'room' then
    return null;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, room_id, memory_id)
  select rm.user_id, new.author_id, 'memory_created', new.room_id, new.id
    from public.room_members rm
   where rm.room_id = new.room_id
     and rm.user_id <> new.author_id
     and rm.status = 'active'
     and not exists (
       select 1 from public.blocks b
        where (b.blocker_id = rm.user_id and b.blocked_id = new.author_id)
           or (b.blocker_id = new.author_id and b.blocked_id = rm.user_id)
     );
  return null;
end;
$$;

create or replace function public.notify_author_of_comment()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare
  v_author uuid;
  v_room uuid;
begin
  select m.author_id, m.room_id into v_author, v_room
    from public.memories m where m.id = new.memory_id;

  if v_author is null or v_author = new.author_id then
    return null;
  end if;

  if exists (
    select 1 from public.blocks b
     where (b.blocker_id = v_author and b.blocked_id = new.author_id)
        or (b.blocker_id = new.author_id and b.blocked_id = v_author)
  ) then
    return null;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, room_id, memory_id)
  values (v_author, new.author_id, 'comment_created', v_room, new.memory_id);
  return null;
end;
$$;

create or replace function public.notify_receiver_of_heart()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.receiver_id is null or new.receiver_id = new.sender_id then
    return null;
  end if;

  if exists (
    select 1 from public.blocks b
     where (b.blocker_id = new.receiver_id and b.blocked_id = new.sender_id)
        or (b.blocker_id = new.sender_id and b.blocked_id = new.receiver_id)
  ) then
    return null;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, room_id, heart_message_id)
  values (new.receiver_id, new.sender_id, 'heart_received', new.room_id, new.id);
  return null;
end;
$$;

create or replace function public.notify_room_of_new_member()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.left_at is not null then
    return null;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, room_id)
  select rm.user_id, new.user_id, 'member_joined', new.room_id
    from public.room_members rm
   where rm.room_id = new.room_id
     and rm.user_id <> new.user_id
     and rm.status = 'active'
     and not exists (
       select 1 from public.blocks b
        where (b.blocker_id = rm.user_id and b.blocked_id = new.user_id)
           or (b.blocker_id = new.user_id and b.blocked_id = rm.user_id)
     );
  return null;
end;
$$;

create or replace function public.room_members_guard_role()
 returns trigger language plpgsql set search_path to ''
as $$
begin
  if new.role is distinct from old.role
     and old.user_id = (select auth.uid())
     and not public.is_room_admin(old.room_id)
  then
    raise exception '방장 권한은 스스로 바꿀 수 없습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.create_streak_for_member()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  insert into public.daily_streaks (room_member_id) values (new.id)
  on conflict (room_member_id) do nothing;
  return new;
end;
$$;

create or replace function public.touch_streak()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare
  v_member_id uuid;
  v_today     date := (new.created_at at time zone 'Asia/Seoul')::date;
  v_cur       integer;
  v_best      integer;
  v_last      date;
begin
  if new.sender_id is null then return new; end if;

  select id into v_member_id
    from public.room_members
   where room_id = new.room_id and user_id = new.sender_id and status = 'active';
  if v_member_id is null then return new; end if;

  select current_count, best_count, last_active_date
    into v_cur, v_best, v_last
    from public.daily_streaks where room_member_id = v_member_id
     for update;

  if not found then
    insert into public.daily_streaks (room_member_id, current_count, best_count, last_active_date)
    values (v_member_id, 1, 1, v_today);
    return new;
  end if;

  if v_last = v_today then
    return new;
  elsif v_last = v_today - 1 then
    v_cur := v_cur + 1;
  else
    v_cur := 1;
  end if;

  update public.daily_streaks
     set current_count = v_cur, best_count = greatest(v_best, v_cur), last_active_date = v_today
   where room_member_id = v_member_id;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 9. 트리거
-- ─────────────────────────────────────────────────────────────

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
create trigger trg_guardian_consent before insert or update of birth_date, guardian_consented_at
  on public.user_private for each row execute function public.enforce_guardian_consent();
create trigger trg_room_owner_member after insert on public.rooms
  for each row execute function public.add_owner_as_member();
create trigger room_members_lock_room before insert or update on public.room_members
  for each row execute function public.room_members_lock_room();
create trigger room_members_guard_role before update on public.room_members
  for each row execute function public.room_members_guard_role();
create trigger room_members_notify after insert on public.room_members
  for each row execute function public.notify_room_of_new_member();
create trigger trg_create_streak after insert on public.room_members
  for each row execute function public.create_streak_for_member();
create trigger memories_before_write before insert or update on public.memories
  for each row execute function public.memories_before_write();
create trigger memories_notify after insert on public.memories
  for each row execute function public.notify_room_members_of_memory();
create trigger memory_photos_before_insert before insert on public.memory_photos
  for each row execute function public.memory_photos_before_insert();
create trigger memory_comments_before_insert before insert on public.memory_comments
  for each row execute function public.memory_comments_before_insert();
create trigger memory_comments_notify after insert on public.memory_comments
  for each row execute function public.notify_author_of_comment();
create trigger heart_messages_before_insert before insert on public.heart_messages
  for each row execute function public.heart_messages_before_insert();
create trigger heart_messages_notify after insert on public.heart_messages
  for each row execute function public.notify_receiver_of_heart();
create trigger trg_touch_streak after insert on public.heart_messages
  for each row execute function public.touch_streak();

-- ─────────────────────────────────────────────────────────────
-- 10. 앱이 부르는 함수(RPC)
-- ─────────────────────────────────────────────────────────────

create or replace function public.accept_invitation(p_token text, p_label text default null)
 returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare
  v_inv public.invitations%rowtype;
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  -- 같은 링크로 두 명이 동시에 들어오는 것을 막는다
  select * into v_inv from public.invitations where invite_token = p_token for update;
  if not found then
    raise exception '유효하지 않은 초대입니다.';
  end if;

  -- 추억 저장과 순서를 맞추기 위해 방 행도 잠근다(room_members_lock_room 과 같은 규칙).
  perform 1 from public.rooms where id = v_inv.room_id for update;

  if exists (
    select 1 from public.room_members
     where room_id = v_inv.room_id and user_id = v_uid and status = 'active'
  ) then
    return (select id from public.room_members where room_id = v_inv.room_id and user_id = v_uid);
  end if;

  if v_inv.used_at is not null then
    raise exception '이미 사용된 초대입니다. 초대한 분께 새 링크를 요청해주세요.';
  end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    raise exception '만료된 초대입니다.';
  end if;

  if exists (
    select 1
      from public.room_members m
      join public.blocks b
        on (b.blocker_id = v_uid and b.blocked_id = m.user_id)
        or (b.blocker_id = m.user_id and b.blocked_id = v_uid)
     where m.room_id = v_inv.room_id and m.status = 'active'
  ) or exists (
    select 1 from public.blocks
     where (blocker_id = v_uid and blocked_id = v_inv.inviter_id)
        or (blocker_id = v_inv.inviter_id and blocked_id = v_uid)
  ) then
    raise exception '이 초대는 사용할 수 없습니다.';
  end if;

  insert into public.room_members (room_id, user_id, relationship_label, role, status)
  values (v_inv.room_id, v_uid,
          coalesce(nullif(trim(coalesce(p_label, '')), ''), v_inv.relationship_label),
          'member', 'active')
  on conflict (room_id, user_id) do update set status = 'active', left_at = null
  returning id into v_id;

  update public.invitations set used_at = now(), used_by = v_uid where id = v_inv.id;
  return v_id;
end;
$$;

create or replace function public.preview_invitation(p_token text)
 returns table(room_id uuid, room_name text, inviter_name text, relationship_label text,
               invite_message text, expired boolean, used boolean)
 language sql stable security definer set search_path to 'public'
as $$
  select r.id, r.name, coalesce(u.name, '탈퇴한 사용자'),
         i.relationship_label, i.invite_message,
         (i.expires_at is not null and i.expires_at < now()),
         (i.used_at is not null)
    from public.invitations i
    join public.rooms r on r.id = i.room_id
    left join public.users u on u.id = i.inviter_id
   where i.invite_token = p_token;
$$;

create or replace function public.pin_memory(p_memory_id uuid, p_pinned boolean)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_room uuid;
begin
  select room_id into v_room from public.memories where id = p_memory_id;
  if v_room is null or not public.can_read_memory(p_memory_id) then
    raise exception '고정할 게시물을 찾지 못했습니다' using errcode = 'P0002';
  end if;

  update public.memories set pinned_at = null where room_id = v_room and pinned_at is not null;
  if p_pinned then
    update public.memories set pinned_at = now() where id = p_memory_id;
  end if;
end;
$$;

-- 사서함 "들었다" 표시. 답장 잠금은 없앴다 — 받은 사람의 마음이면 그냥 읽음을 적는다.
create or replace function public.mark_heart_read(p_id uuid)
 returns boolean language plpgsql security definer set search_path to 'public'
as $$
declare
  v_read timestamptz;
begin
  select h.read_at into v_read
    from public.heart_messages h
   where h.id = p_id and h.receiver_id = auth.uid();
  if not found then
    return false;
  end if;
  if v_read is null then
    update public.heart_messages set read_at = now() where id = p_id;
  end if;
  return true;
end;
$$;

create or replace function public.username_taken(p_username text)
 returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (
    select 1 from public.user_private
     where username = lower(btrim(coalesce(p_username, '')))
  );
$$;

-- 추억 완전 삭제. 작성자만. 연결 파일은 삭제 작업표에 먼저 적고 행을 지운다.
-- 행이 사라지는 순간 모든 사람의 읽기·서명이 막힌다(can_read_storage_object 가 연결 기록을 본다).
-- 돌려주는 목록은 이 사람이 아직 지우지 못한 모든 파일이다 — 앞서 실패한 것도 함께 다시 지운다.
create or replace function public.delete_memory(p_memory_id uuid)
 returns table(bucket_id text, object_name text)
 language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_author uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  select m.author_id into v_author from public.memories m where m.id = p_memory_id for update;
  if not found then
    raise exception '게시물을 찾지 못했습니다.' using errcode = 'P0002';
  end if;
  if v_author is distinct from v_uid then
    raise exception '내가 남긴 글만 지울 수 있습니다.' using errcode = '42501';
  end if;

  insert into public.storage_deletion_jobs (requested_by, bucket_id, object_name)
  select v_uid, f.bucket, f.path
    from (
      select 'media'::text as bucket, p.storage_path as path
        from public.memory_photos p where p.memory_id = p_memory_id
      union all
      select 'voice', m.voice_path from public.memories m
       where m.id = p_memory_id and m.voice_path is not null
      union all
      select 'handwriting', m.handwriting_path from public.memories m
       where m.id = p_memory_id and m.handwriting_path is not null
      union all
      select 'video', m.video_path from public.memories m
       where m.id = p_memory_id and m.video_path is not null
      union all
      select 'voice', c.voice_path from public.memory_comments c
       where c.memory_id = p_memory_id and c.voice_path is not null
    ) f
  on conflict on constraint storage_deletion_jobs_object_key
    do update set requested_by = excluded.requested_by;

  delete from public.memories where id = p_memory_id;

  return query
    select j.bucket_id, j.object_name
      from public.storage_deletion_jobs j
     where j.requested_by = v_uid
     order by j.created_at;
end;
$$;

-- 파일 삭제 뒤 확인. 실제로 Storage 에서 사라진 파일만 작업표에서 뺀다.
-- 남은 것은 시도 횟수와 오류를 적고 그대로 둔다. 돌려주는 값 = 아직 남은 개수.
create or replace function public.finish_storage_deletions(p_error text default null)
 returns integer language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_left integer;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  delete from public.storage_deletion_jobs j
   where j.requested_by = v_uid
     and not exists (
       select 1 from storage.objects o
        where o.bucket_id = j.bucket_id and o.name = j.object_name
     );

  update public.storage_deletion_jobs
     set attempts = attempts + 1, last_error = left(p_error, 500), claimed_at = null
   where requested_by = v_uid;
  get diagnostics v_left = row_count;
  return v_left;
end;
$$;

create or replace function public.withdraw_account(p_reason text default null, p_detail text default null)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid  uuid := auth.uid();
  v_room record;
  v_heir uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_reason is not null and length(trim(p_reason)) > 0 then
    insert into public.withdrawal_reasons (reason, detail)
    values (left(trim(p_reason), 200), nullif(left(trim(coalesce(p_detail, '')), 1000), ''));
  end if;

  -- 나만 읽던 추억(private)은 탈퇴하면 아무도 읽을 수 없으므로 함께 지운다.
  -- 파일은 앱이 탈퇴 전에 목록을 모아 두었다가 지운다(owner = 나).
  delete from public.memories where author_id = v_uid and visibility = 'private';

  delete from public.rooms r
   where r.owner_id = v_uid
     and not exists (
       select 1 from public.room_members m where m.room_id = r.id and m.user_id <> v_uid
     );

  for v_room in select id from public.rooms where owner_id = v_uid
  loop
    select m.user_id into v_heir
      from public.room_members m
     where m.room_id = v_room.id and m.user_id <> v_uid and m.status = 'active'
     order by (m.role = 'admin') desc, m.joined_at
     limit 1;

    if v_heir is not null then
      update public.rooms set owner_id = v_heir where id = v_room.id;
      update public.room_members set role = 'admin' where room_id = v_room.id and user_id = v_heir;
    end if;
  end loop;

  delete from auth.users where id = v_uid;
end;
$$;

create or replace function public.push_targets_for_user(p_user_id uuid)
 returns table(endpoint text, p256dh text, auth text)
 language sql stable security definer set search_path to 'public'
as $$
  select ps.endpoint, ps.p256dh, ps.auth
    from public.push_subscriptions ps
   where ps.user_id = p_user_id
     and public.shares_room_with(p_user_id)
     and not exists (
       select 1 from public.blocks b
        where (b.blocker_id = p_user_id and b.blocked_id = auth.uid())
           or (b.blocker_id = auth.uid() and b.blocked_id = p_user_id)
     );
$$;

create or replace function public.prune_push_subscription(p_endpoint text)
 returns void language sql security definer set search_path to 'public'
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

create or replace function public.effective_streak(p_room_member_id uuid)
 returns integer language sql stable set search_path to 'public'
as $$
  select case
           when ds.last_active_date >= (now() at time zone 'Asia/Seoul')::date - 1
             then ds.current_count
           else 0
         end
    from public.daily_streaks ds
   where ds.room_member_id = p_room_member_id;
$$;

-- 보호자 확인 구조(아직 가입 경로에 연결하지 않음). service_role 만 부른다.
create or replace function public.consume_guardian_verification(p_id uuid, p_phone text)
 returns boolean language plpgsql security definer set search_path to 'public'
as $$
declare
  v_ok boolean;
begin
  update public.guardian_verifications
     set consumed_at = now()
   where id = p_id
     and guardian_phone = regexp_replace(p_phone, '[^0-9]', '', 'g')
     and verified_at is not null
     and consumed_at is null
     and verified_at > now() - interval '30 minutes'
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

create or replace function public.purge_guardian_verifications()
 returns integer language plpgsql security definer set search_path to 'public'
as $$
declare
  v_deleted integer;
begin
  delete from public.guardian_verifications where created_at < now() - interval '24 hours';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- 위젯 토큰 ────────────────────────────────────────────────

create or replace function public.issue_widget_token()
 returns text language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid   uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.widget_tokens (user_id, token_hash)
  values (v_uid, encode(extensions.digest(v_token, 'sha256'), 'hex'));
  return v_token;
end;
$$;

create or replace function public.revoke_widget_tokens()
 returns integer language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_n   integer;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;
  delete from public.widget_tokens where user_id = v_uid;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.widget_user_from_token(p_token text)
 returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid;
begin
  update public.widget_tokens
     set last_used_at = now()
   where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  returning user_id into v_uid;
  if v_uid is null then
    raise exception '위젯 토큰이 유효하지 않습니다.' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

-- 위젯의 최근 표현 1건. 남의 글은 방 공유(room) 추억만, 없으면 내 최신 글.
create or replace function public.widget_latest(p_token text)
 returns table(memory_id uuid, room_id uuid, room_name text, author_id uuid, author_name text,
               created_at timestamptz, photo_path text, voice_duration_sec integer,
               handwriting_path text, caption text, is_mine boolean)
 language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := public.widget_user_from_token(p_token);
begin
  return query
  select m.id, m.room_id, coalesce(me.custom_name, r.name), m.author_id,
         coalesce(u.name, '탈퇴한 사용자'), m.created_at,
         (select p.storage_path from public.memory_photos p
           where p.memory_id = m.id order by p.sort_order limit 1),
         m.voice_duration_sec, m.handwriting_path, m.description, false
    from public.memories m
    join public.rooms r on r.id = m.room_id
    join public.room_members me
      on me.room_id = m.room_id and me.user_id = v_uid and me.status = 'active'
    left join public.users u on u.id = m.author_id
   where m.visibility = 'room'
     and m.author_id is distinct from v_uid
     and not exists (select 1 from public.memory_hides h where h.memory_id = m.id and h.user_id = v_uid)
     and not exists (select 1 from public.blocks b
                      where (b.blocker_id = v_uid and b.blocked_id = m.author_id)
                         or (b.blocker_id = m.author_id and b.blocked_id = v_uid))
   order by m.created_at desc
   limit 1;

  if found then return; end if;

  return query
  select m.id, m.room_id, coalesce(me.custom_name, r.name), m.author_id,
         coalesce(u.name, '나'), m.created_at,
         (select p.storage_path from public.memory_photos p
           where p.memory_id = m.id order by p.sort_order limit 1),
         m.voice_duration_sec, m.handwriting_path, m.description, true
    from public.memories m
    join public.rooms r on r.id = m.room_id
    join public.room_members me
      on me.room_id = m.room_id and me.user_id = v_uid and me.status = 'active'
    left join public.users u on u.id = m.author_id
   where m.author_id = v_uid
   order by m.created_at desc
   limit 1;
end;
$$;

create or replace function public.widget_knock(p_token text, p_target uuid, p_memory uuid default null)
 returns boolean language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid    uuid := public.widget_user_from_token(p_token);
  v_room   uuid;
  v_memory uuid;
begin
  if p_target is null or p_target = v_uid then
    return false;
  end if;

  select a.room_id into v_room
    from public.room_members a
    join public.room_members b on a.room_id = b.room_id
   where a.user_id = v_uid and a.status = 'active'
     and b.user_id = p_target and b.status = 'active'
   limit 1;
  if v_room is null then
    return false;
  end if;

  if exists (select 1 from public.blocks
              where (blocker_id = v_uid and blocked_id = p_target)
                 or (blocker_id = p_target and blocked_id = v_uid)) then
    return false;
  end if;

  -- 알림에 붙일 추억은 받는 사람도 읽을 수 있는 방 공유 추억일 때만.
  select m.id into v_memory from public.memories m
   where m.id = p_memory and m.visibility = 'room'
     and exists (select 1 from public.room_members rm
                  where rm.room_id = m.room_id and rm.user_id = p_target and rm.status = 'active');

  update public.notifications
     set created_at = now(), memory_id = coalesce(v_memory, memory_id)
   where recipient_id = p_target and actor_id = v_uid
     and type = 'knock' and read_at is null and deleted_at is null;
  if not found then
    insert into public.notifications (recipient_id, actor_id, type, room_id, memory_id)
    values (p_target, v_uid, 'knock', v_room, v_memory);
  end if;
  return true;
end;
$$;

-- 추억 저장·고치기 ───────────────────────────────────────────
-- 추억 한 줄과 사진 줄을 한 트랜잭션으로 넣는다. 중간에 실패하면 둘 다 없던 일이 된다
-- (예전 앱은 따로 넣고 실패하면 지웠다 — 지우기마저 실패하면 반쪽 추억이 남았다).
-- SECURITY INVOKER: 호출한 사람의 RLS 가 그대로 적용된다. 공개 범위는 트리거가 정한다.

-- 내 파일을 정리 목록에 올린다. 남의 파일은 올릴 수 없다(올린 사람 = 나 인 것만).
create or replace function public.enqueue_own_storage_deletion(p_bucket text, p_path text)
 returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null or p_path is null then
    return;
  end if;
  insert into public.storage_deletion_jobs (requested_by, bucket_id, object_name, reason)
  select auth.uid(), o.bucket_id, o.name, 'memory_updated'
    from storage.objects o
   where o.bucket_id = p_bucket and o.name = p_path and o.owner_id = auth.uid()::text
  on conflict on constraint storage_deletion_jobs_object_key do nothing;
end;
$$;

create or replace function public.create_memory(
  p_room_id uuid,
  p_caption text,
  p_photo_paths text[],
  p_voice_path text default null,
  p_voice_duration_sec integer default null,
  p_voice_levels real[] default null,
  p_handwriting_path text default null,
  p_handwriting_duration_ms integer default null,
  p_video_path text default null,
  p_video_duration_ms integer default null
)
 returns uuid language plpgsql security invoker set search_path to 'public'
as $$
declare
  v_id uuid;
  v_photos text[] := coalesce(p_photo_paths, '{}');
begin
  if cardinality(v_photos) > 10 then
    raise exception '사진은 10장까지 담을 수 있습니다.' using errcode = '23514';
  end if;
  if p_voice_path is null and p_handwriting_path is null and p_video_path is null
     and cardinality(v_photos) = 0 then
    raise exception '목소리·손글씨·사진·영상 중 하나는 담아야 합니다.' using errcode = '23514';
  end if;

  insert into public.memories (
    room_id, author_id, description,
    voice_path, voice_duration_sec, voice_levels,
    handwriting_path, handwriting_duration_ms,
    video_path, video_duration_ms
  ) values (
    p_room_id, auth.uid(), nullif(btrim(coalesce(p_caption, '')), ''),
    p_voice_path, p_voice_duration_sec, case when p_voice_path is null then null else p_voice_levels end,
    p_handwriting_path, p_handwriting_duration_ms,
    p_video_path, p_video_duration_ms
  )
  returning id into v_id;

  insert into public.memory_photos (memory_id, storage_path, sort_order)
  select v_id, path, ord - 1
    from unnest(v_photos) with ordinality as t(path, ord);

  return v_id;
end;
$$;

-- 고치기. 작성자만(RLS memories_update). 더 이상 가리키지 않는 옛 파일은 정리 목록에 올리고,
-- 앱이 지운 뒤 finish_storage_deletions() 로 확인한다.
create or replace function public.update_memory(
  p_memory_id uuid,
  p_caption text,
  p_photo_paths text[],
  p_voice_path text default null,
  p_voice_duration_sec integer default null,
  p_voice_levels real[] default null,
  p_handwriting_path text default null,
  p_handwriting_duration_ms integer default null,
  p_video_path text default null,
  p_video_duration_ms integer default null
)
 returns void language plpgsql security invoker set search_path to 'public'
as $$
declare
  v_old public.memories%rowtype;
  v_photos text[] := coalesce(p_photo_paths, '{}');
  v_stale text;
begin
  select * into v_old from public.memories
   where id = p_memory_id and author_id = auth.uid()
   for update;
  if not found then
    raise exception '내가 남긴 글만 고칠 수 있습니다.' using errcode = '42501';
  end if;

  if cardinality(v_photos) > 10 then
    raise exception '사진은 10장까지 담을 수 있습니다.' using errcode = '23514';
  end if;
  if p_voice_path is null and p_handwriting_path is null and p_video_path is null
     and cardinality(v_photos) = 0 then
    raise exception '목소리·손글씨·사진·영상 중 하나는 담아야 합니다.' using errcode = '23514';
  end if;

  update public.memories
     set description = nullif(btrim(coalesce(p_caption, '')), ''),
         voice_path = p_voice_path,
         voice_duration_sec = p_voice_duration_sec,
         voice_levels = case when p_voice_path is null then null else p_voice_levels end,
         handwriting_path = p_handwriting_path,
         handwriting_duration_ms = p_handwriting_duration_ms,
         video_path = p_video_path,
         video_duration_ms = p_video_duration_ms
   where id = p_memory_id;

  for v_stale in
    select storage_path from public.memory_photos
     where memory_id = p_memory_id and not (storage_path = any (v_photos))
  loop
    perform public.enqueue_own_storage_deletion('media', v_stale);
  end loop;

  delete from public.memory_photos where memory_id = p_memory_id;
  insert into public.memory_photos (memory_id, storage_path, sort_order)
  select p_memory_id, path, ord - 1
    from unnest(v_photos) with ordinality as t(path, ord);

  if v_old.voice_path is not null and v_old.voice_path is distinct from p_voice_path then
    perform public.enqueue_own_storage_deletion('voice', v_old.voice_path);
  end if;
  if v_old.handwriting_path is not null and v_old.handwriting_path is distinct from p_handwriting_path then
    perform public.enqueue_own_storage_deletion('handwriting', v_old.handwriting_path);
  end if;
  if v_old.video_path is not null and v_old.video_path is distinct from p_video_path then
    perform public.enqueue_own_storage_deletion('video', v_old.video_path);
  end if;
end;
$$;

-- 내가 아직 지우지 못한 파일 목록(앞서 실패한 것 포함). 부르는 순간 "지우는 중"으로 표시한다.
-- 앱은 이 목록을 받은 즉시 Storage 삭제를 부르고, 끝나면 finish_storage_deletions() 를 부른다.
create or replace function public.pending_storage_deletions()
 returns table(bucket_id text, object_name text)
 language sql volatile security definer set search_path to 'public'
as $$
  update public.storage_deletion_jobs j
     set claimed_at = now()
   where j.requested_by = auth.uid()
  returning j.bucket_id, j.object_name;
$$;

-- 내부 전용 함수는 앱 역할이 직접 부르지 못하게 한다.
revoke all on function public.widget_user_from_token(text) from public, anon, authenticated;
revoke all on function public.purge_guardian_verifications() from public, anon, authenticated;
revoke all on function public.consume_guardian_verification(uuid, text) from public, anon, authenticated;
revoke all on function public.assert_own_upload(text, text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.withdraw_account(text, text) from public, anon;
revoke all on function public.delete_memory(uuid) from public, anon;
revoke all on function public.finish_storage_deletions(text) from public, anon;
revoke all on function public.enqueue_own_storage_deletion(text, text) from public, anon;
revoke all on function public.pending_storage_deletions() from public, anon;
revoke all on function public.create_memory(uuid, text, text[], text, integer, real[], text, integer, text, integer) from public, anon;
revoke all on function public.update_memory(uuid, text, text[], text, integer, real[], text, integer, text, integer) from public, anon;
grant execute on function public.enqueue_own_storage_deletion(text, text) to authenticated;
grant execute on function public.pending_storage_deletions() to authenticated;
grant execute on function public.create_memory(uuid, text, text[], text, integer, real[], text, integer, text, integer) to authenticated;
grant execute on function public.update_memory(uuid, text, text[], text, integer, real[], text, integer, text, integer) to authenticated;
grant execute on function public.withdraw_account(text, text) to authenticated;
grant execute on function public.delete_memory(uuid) to authenticated;
grant execute on function public.finish_storage_deletions(text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 11. RLS — 누가 어떤 행을 읽고 쓰는가
-- ─────────────────────────────────────────────────────────────

alter table public.users                   enable row level security;
alter table public.user_private            enable row level security;
alter table public.rooms                   enable row level security;
alter table public.room_members            enable row level security;
alter table public.invitations             enable row level security;
alter table public.memories                enable row level security;
alter table public.memory_photos           enable row level security;
alter table public.memory_comments         enable row level security;
alter table public.memory_likes            enable row level security;
alter table public.memory_saves            enable row level security;
alter table public.memory_hides            enable row level security;
alter table public.heart_messages          enable row level security;
alter table public.heart_message_favorites enable row level security;
alter table public.heart_message_hides     enable row level security;
alter table public.notifications           enable row level security;
alter table public.blocks                  enable row level security;
alter table public.reports                 enable row level security;
alter table public.push_subscriptions      enable row level security;
alter table public.withdrawal_reasons      enable row level security;
alter table public.guardian_verifications  enable row level security;
alter table public.daily_streaks           enable row level security;
alter table public.widget_tokens           enable row level security;
alter table public.storage_deletion_jobs   enable row level security;

-- 사람: 프로필은 나와 같은 방 사람만, 개인 정보는 나만.
create policy users_select on public.users for select to authenticated
  using (id = (select auth.uid()) or public.shares_room_with(id));
create policy users_update on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy user_private_select on public.user_private for select to authenticated
  using (id = (select auth.uid()));
create policy user_private_update on public.user_private for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 열 단위로도 막는다: 이름·사진·큰 글자만 앱이 고칠 수 있다.
revoke insert, update, delete on public.users from anon, authenticated;
grant update (name, profile_image) on public.users to authenticated;
revoke insert, update, delete on public.user_private from anon, authenticated;
grant update (large_text) on public.user_private to authenticated;

-- 앨범방
create policy rooms_select on public.rooms for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_room_member(id));
create policy rooms_insert on public.rooms for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy rooms_update on public.rooms for update to authenticated
  using (public.is_room_admin(id)) with check (public.is_room_admin(id));
create policy rooms_delete on public.rooms for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy room_members_select on public.room_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_room_member(room_id));
create policy room_members_insert on public.room_members for insert to authenticated
  with check (user_id = (select auth.uid()) or public.is_room_admin(room_id));
create policy room_members_update on public.room_members for update to authenticated
  using (user_id = (select auth.uid()) or public.is_room_admin(room_id))
  with check (user_id = (select auth.uid()) or public.is_room_admin(room_id));

create policy invitations_select on public.invitations for select to authenticated
  using (inviter_id = (select auth.uid()) or public.is_room_member(room_id));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (inviter_id = (select auth.uid()) and public.is_room_member(room_id));
create policy invitations_delete on public.invitations for delete to authenticated
  using (inviter_id = (select auth.uid()) or public.is_room_admin(room_id));

-- 추억: can_read_memory 와 같은 규칙을 풀어 쓴다(행마다 함수를 한 번 더 부르지 않도록).
create policy memories_select on public.memories for select to authenticated
  using (
    public.is_room_member(room_id)
    and (author_id = (select auth.uid())
         or (visibility = 'room' and not public.has_blocked(author_id)))
  );
create policy memories_insert on public.memories for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_room_member(room_id));
create policy memories_update on public.memories for update to authenticated
  using (author_id = (select auth.uid()) and public.is_room_member(room_id))
  with check (author_id = (select auth.uid()));
-- 삭제 정책은 두지 않는다 — 파일 정리 목록을 남기는 delete_memory() 로만 지운다.

create policy memory_photos_select on public.memory_photos for select to authenticated
  using (public.can_read_memory(memory_id));
create policy memory_photos_insert on public.memory_photos for insert to authenticated
  with check (exists (
    select 1 from public.memories m
     where m.id = memory_id and m.author_id = (select auth.uid()) and public.is_room_member(m.room_id)));
create policy memory_photos_delete on public.memory_photos for delete to authenticated
  using (exists (
    select 1 from public.memories m
     where m.id = memory_id and m.author_id = (select auth.uid())));

create policy memory_comments_select on public.memory_comments for select to authenticated
  using (public.can_read_memory(memory_id) and not public.has_blocked(author_id));
create policy memory_comments_insert on public.memory_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and deleted_at is null
              and public.can_read_memory(memory_id));
create policy memory_comments_update on public.memory_comments for update to authenticated
  using (author_id = (select auth.uid()) and public.can_read_memory(memory_id))
  with check (author_id = (select auth.uid()));

-- 반응: 읽을 수 있는 추억에만. 자기 추억에도 반응할 수 있다(사용자 결정).
create policy memory_likes_select on public.memory_likes for select to authenticated
  using (public.can_read_memory(memory_id));
create policy memory_likes_insert on public.memory_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_read_memory(memory_id));
create policy memory_likes_delete on public.memory_likes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy memory_saves_select on public.memory_saves for select to authenticated
  using (user_id = (select auth.uid()) and public.can_read_memory(memory_id));
create policy memory_saves_insert on public.memory_saves for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_read_memory(memory_id));
create policy memory_saves_delete on public.memory_saves for delete to authenticated
  using (user_id = (select auth.uid()));

create policy memory_hides_select on public.memory_hides for select to authenticated
  using (user_id = (select auth.uid()));
create policy memory_hides_insert on public.memory_hides for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_read_memory(memory_id));
create policy memory_hides_delete on public.memory_hides for delete to authenticated
  using (user_id = (select auth.uid()));

-- 사서함: 보낸 사람과 받는 사람만. 추억을 붙이려면 받는 사람도 읽을 수 있어야 한다.
create policy heart_messages_select on public.heart_messages for select to authenticated
  using (sender_id = (select auth.uid())
         or (receiver_id = (select auth.uid()) and not public.has_blocked(sender_id)));
create policy heart_messages_insert on public.heart_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid()) and public.is_room_member(room_id)
    and (memory_id is null or exists (
      select 1 from public.memories m
       where m.id = memory_id and public.can_read_memory(m.id)
         and (m.visibility = 'room' or receiver_id = (select auth.uid()))))
  );
create policy heart_messages_update on public.heart_messages for update to authenticated
  using (sender_id = (select auth.uid())) with check (sender_id = (select auth.uid()));
create policy heart_messages_delete on public.heart_messages for delete to authenticated
  using (sender_id = (select auth.uid()));

create policy heart_message_favorites_select on public.heart_message_favorites for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.heart_messages m
     where m.id = message_id
       and (m.sender_id = (select auth.uid()) or m.receiver_id = (select auth.uid()))));
create policy heart_message_favorites_insert on public.heart_message_favorites for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.heart_messages m
     where m.id = message_id
       and (m.sender_id = (select auth.uid()) or m.receiver_id = (select auth.uid()))));
create policy heart_message_favorites_delete on public.heart_message_favorites for delete to authenticated
  using (user_id = (select auth.uid()));

create policy heart_message_hides_select on public.heart_message_hides for select to authenticated
  using (user_id = (select auth.uid()));
create policy heart_message_hides_insert on public.heart_message_hides for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.heart_messages h
     where h.id = message_id
       and (h.sender_id = (select auth.uid()) or h.receiver_id = (select auth.uid()))));
create policy heart_message_hides_delete on public.heart_message_hides for delete to authenticated
  using (user_id = (select auth.uid()));

-- 알림: 받는 사람만. 추억 알림은 그 추억을 지금 읽을 수 있을 때만 보인다.
create policy notifications_select on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid())
         and (memory_id is null or public.can_read_memory(memory_id)));
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

create policy blocks_select on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy blocks_insert on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy blocks_delete on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

create policy reports_select on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

create policy push_subscriptions_select on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy push_subscriptions_update on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy withdrawal_reasons_insert on public.withdrawal_reasons for insert to authenticated
  with check (true);

create policy daily_streaks_select on public.daily_streaks for select to authenticated
  using (public.owns_room_member(room_member_id));

create policy storage_deletion_jobs_select on public.storage_deletion_jobs for select to authenticated
  using (requested_by = (select auth.uid()));

-- guardian_verifications · widget_tokens: 정책 없음 = service_role 외 접근 금지(의도).

-- ─────────────────────────────────────────────────────────────
-- 12. Storage — 파일 자체를 두는 곳
-- ─────────────────────────────────────────────────────────────
-- 모든 버킷은 비공개. 파일은 서명 URL로만 나간다.
-- 올리기: 경로 첫 칸의 방(아바타는 내 id)에 속한 사람이, 자기 이름(owner)으로.
-- 읽기·서명: 내가 올린 파일이거나, 내가 읽을 수 있는 기록에 연결된 파일만.
-- 지우기: 내가 올린 파일, 또는 내가 지운 추억의 정리 목록에 있는 파일.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',     'avatars',     false,  5242880, array['image/jpeg','image/png','image/webp']),
  ('covers',      'covers',      false,  5242880, array['image/jpeg','image/png','image/webp']),
  ('media',       'media',       false, 52428800, array['image/jpeg','image/png','image/webp','image/heic']),
  ('voice',       'voice',       false, 10485760, array['audio/webm','audio/mpeg','audio/mp4','audio/ogg','audio/wav']),
  ('handwriting', 'handwriting', false,  2097152, array['application/json']),
  -- 영상 50MB = 50 × 1024 × 1024 바이트. 화면도 같은 값으로 먼저 거른다(lib/limits.ts).
  ('video',       'video',       false, 52428800, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

create policy app_objects_insert on storage.objects for insert to authenticated
  with check (
    owner_id = (select auth.uid())::text
    and (
      (bucket_id in ('media', 'voice', 'handwriting', 'video', 'covers')
        and public.is_room_member(public.path_uuid(name)))
      or (bucket_id = 'avatars' and public.path_uuid(name) = (select auth.uid()))
    )
  );

create policy app_objects_update on storage.objects for update to authenticated
  using (
    bucket_id in ('media', 'voice', 'handwriting', 'video', 'covers', 'avatars')
    and owner_id = (select auth.uid())::text
  )
  with check (owner_id = (select auth.uid())::text);

-- 삭제 정리 목록에 오른 파일(지운 추억의 파일)은 올린 본인도 더 이상 읽거나 서명할 수 없다.
-- 예외: 삭제를 요청한 사람이 "지우는 중"으로 표시한 뒤 30초 — Storage 삭제가 읽기 권한을 요구한다.
create policy app_objects_select on storage.objects for select to authenticated
  using (
    bucket_id in ('media', 'voice', 'handwriting', 'video', 'covers', 'avatars')
    and (
      (
        (owner_id = (select auth.uid())::text
         or public.can_read_storage_object(bucket_id, name))
        and not public.storage_object_pending_deletion(bucket_id, name)
      )
      or exists (
        select 1 from public.storage_deletion_jobs j
         where j.bucket_id = storage.objects.bucket_id
           and j.object_name = storage.objects.name
           and j.requested_by = (select auth.uid())
           and j.claimed_at > now() - interval '30 seconds')
    )
  );

create policy app_objects_delete on storage.objects for delete to authenticated
  using (
    bucket_id in ('media', 'voice', 'handwriting', 'video', 'covers', 'avatars')
    and (
      owner_id = (select auth.uid())::text
      or exists (
        select 1 from public.storage_deletion_jobs j
         where j.bucket_id = storage.objects.bucket_id
           and j.object_name = storage.objects.name
           and j.requested_by = (select auth.uid()))
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 13. 예약 작업 — 보호자 확인 행 24시간 정리
-- ─────────────────────────────────────────────────────────────

select cron.schedule(
  'purge-guardian-verifications',
  '0 18 * * *',
  $cron$select public.purge_guardian_verifications();$cron$
);
