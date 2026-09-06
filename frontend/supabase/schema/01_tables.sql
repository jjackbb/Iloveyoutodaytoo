create table public.blocks (
  id uuid not null default gen_random_uuid(),
  blocker_id uuid not null,
  blocked_id uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint blocks_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id),
  constraint blocks_pkey PRIMARY KEY (id),
  constraint blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
  constraint blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  constraint no_self_block CHECK ((blocker_id <> blocked_id))
);

create table public.daily_streaks (
  id uuid not null default gen_random_uuid(),
  room_member_id uuid not null,
  current_count integer not null default 0,
  best_count integer not null default 0,
  last_active_date date,
  constraint daily_streaks_room_member_id_key UNIQUE (room_member_id),
  constraint daily_streaks_pkey PRIMARY KEY (id),
  constraint daily_streaks_room_member_id_fkey FOREIGN KEY (room_member_id) REFERENCES room_members(id) ON DELETE CASCADE,
  constraint daily_streaks_best_count_check CHECK ((best_count >= 0)),
  constraint daily_streaks_current_count_check CHECK ((current_count >= 0))
);

create table public.guardian_verifications (
  id uuid not null default gen_random_uuid(),
  guardian_phone text not null,
  code_hash text not null,
  expires_at timestamp with time zone not null,
  attempts smallint not null default 0,
  verified_at timestamp with time zone,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint guardian_verifications_pkey PRIMARY KEY (id),
  constraint guardian_verifications_phone_format CHECK ((guardian_phone ~ '^01[0-9]{8,9}$'::text))
);

create table public.heart_message_favorites (
  id uuid not null default gen_random_uuid(),
  message_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint heart_message_favorites_message_id_user_id_key UNIQUE (message_id, user_id),
  constraint heart_message_favorites_pkey PRIMARY KEY (id),
  constraint heart_message_favorites_message_id_fkey FOREIGN KEY (message_id) REFERENCES heart_messages(id) ON DELETE CASCADE,
  constraint heart_message_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

create table public.heart_message_hides (
  id uuid not null default gen_random_uuid(),
  message_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint heart_message_hides_message_id_user_id_key UNIQUE (message_id, user_id),
  constraint heart_message_hides_pkey PRIMARY KEY (id),
  constraint heart_message_hides_message_id_fkey FOREIGN KEY (message_id) REFERENCES heart_messages(id) ON DELETE CASCADE,
  constraint heart_message_hides_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

create table public.heart_messages (
  id uuid not null default gen_random_uuid(),
  room_id uuid not null,
  memory_id uuid,
  sender_id uuid,
  receiver_id uuid,
  type message_type not null,
  content text not null,
  duration_sec integer,
  prompt_used text,
  created_at timestamp with time zone not null default now(),
  send_mode text not null default 'direct'::text,
  voice_levels real[],
  read_at timestamp with time zone,
  replied_at timestamp with time zone,
  constraint heart_messages_pkey PRIMARY KEY (id),
  constraint heart_messages_memory_id_fkey FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE SET NULL,
  constraint heart_messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL,
  constraint heart_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  constraint heart_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
  constraint duration_matches_type CHECK ((((type = 'text'::message_type) AND (duration_sec IS NULL)) OR ((type = 'voice'::message_type) AND ((duration_sec >= 3) AND (duration_sec <= 60))) OR ((type = 'video'::message_type) AND ((duration_sec >= 2) AND (duration_sec <= 3))))),
  constraint heart_messages_send_mode_check CHECK ((send_mode = ANY (ARRAY['direct'::text, 'broadcast'::text, 'random'::text]))),
  constraint heart_messages_voice_levels_needs_voice CHECK (((voice_levels IS NULL) OR (type <> 'text'::message_type))),
  constraint heart_messages_voice_levels_shape CHECK (((voice_levels IS NULL) OR (((array_length(voice_levels, 1) >= 1) AND (array_length(voice_levels, 1) <= 48)) AND (array_position(voice_levels, NULL::real) IS NULL)))),
  constraint text_length_limit CHECK (((type <> 'text'::message_type) OR (char_length(content) <= 300)))
);

create table public.invitations (
  id uuid not null default gen_random_uuid(),
  room_id uuid not null,
  inviter_id uuid not null,
  relationship_label text not null,
  invite_token text not null,
  invite_message text not null,
  expires_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  used_at timestamp with time zone,
  used_by uuid,
  constraint invitations_invite_token_key UNIQUE (invite_token),
  constraint invitations_pkey PRIMARY KEY (id),
  constraint invitations_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
  constraint invitations_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  constraint invitations_used_by_fkey FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL
);

create table public.memories (
  id uuid not null default gen_random_uuid(),
  room_id uuid not null,
  author_id uuid,
  media_url text,
  media_type media_type not null default 'photo'::media_type,
  description text,
  taken_at date,
  created_at timestamp with time zone not null default now(),
  voice_path text,
  voice_duration_sec integer,
  pinned_at timestamp with time zone,
  deleted_at timestamp with time zone,
  voice_levels real[],
  constraint memories_pkey PRIMARY KEY (id),
  constraint memories_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  constraint memories_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  constraint memories_description_length CHECK (((description IS NULL) OR (char_length(description) <= 300))),
  constraint memories_voice_levels_needs_voice CHECK (((voice_levels IS NULL) OR (voice_path IS NOT NULL))),
  constraint memories_voice_levels_shape CHECK (((voice_levels IS NULL) OR (((array_length(voice_levels, 1) >= 1) AND (array_length(voice_levels, 1) <= 48)) AND (array_position(voice_levels, NULL::real) IS NULL)))),
  constraint memories_voice_pair CHECK ((((voice_path IS NULL) AND (voice_duration_sec IS NULL)) OR ((voice_path IS NOT NULL) AND ((voice_duration_sec >= 3) AND (voice_duration_sec <= 60)))))
);

create table public.memory_comments (
  id uuid not null default gen_random_uuid(),
  memory_id uuid not null,
  author_id uuid,
  created_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone,
  body text,
  voice_path text,
  voice_duration_sec integer,
  voice_levels real[],
  edited_at timestamp with time zone,
  constraint memory_comments_pkey PRIMARY KEY (id),
  constraint memory_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  constraint memory_comments_memory_id_fkey FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  constraint memory_comments_body_length CHECK (((body IS NULL) OR ((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 300)))),
  constraint memory_comments_kind CHECK ((((body IS NOT NULL) AND (voice_path IS NULL) AND (voice_duration_sec IS NULL)) OR ((body IS NULL) AND (voice_path IS NOT NULL) AND ((voice_duration_sec >= 3) AND (voice_duration_sec <= 60))))),
  constraint memory_comments_voice_levels_needs_voice CHECK (((voice_levels IS NULL) OR (voice_path IS NOT NULL))),
  constraint memory_comments_voice_levels_shape CHECK (((voice_levels IS NULL) OR (((array_length(voice_levels, 1) >= 1) AND (array_length(voice_levels, 1) <= 48)) AND (array_position(voice_levels, NULL::real) IS NULL))))
);

create table public.memory_hides (
  id uuid not null default gen_random_uuid(),
  memory_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint memory_hides_memory_id_user_id_key UNIQUE (memory_id, user_id),
  constraint memory_hides_pkey PRIMARY KEY (id),
  constraint memory_hides_memory_id_fkey FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  constraint memory_hides_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

create table public.memory_likes (
  id uuid not null default gen_random_uuid(),
  memory_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint memory_likes_memory_id_user_id_key UNIQUE (memory_id, user_id),
  constraint memory_likes_pkey PRIMARY KEY (id),
  constraint memory_likes_memory_id_fkey FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  constraint memory_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

create table public.memory_photos (
  id uuid not null default gen_random_uuid(),
  memory_id uuid not null,
  storage_path text not null,
  sort_order integer not null,
  created_at timestamp with time zone not null default now(),
  constraint memory_photos_order_unique UNIQUE (memory_id, sort_order),
  constraint memory_photos_pkey PRIMARY KEY (id),
  constraint memory_photos_memory_id_fkey FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  constraint memory_photos_sort_order_check CHECK (((sort_order >= 0) AND (sort_order < 10)))
);

create table public.memory_saves (
  id uuid not null default gen_random_uuid(),
  memory_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint memory_saves_memory_id_user_id_key UNIQUE (memory_id, user_id),
  constraint memory_saves_pkey PRIMARY KEY (id),
  constraint memory_saves_memory_id_fkey FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  constraint memory_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

create table public.notifications (
  id uuid not null default gen_random_uuid(),
  recipient_id uuid not null,
  actor_id uuid,
  type notification_type not null,
  room_id uuid,
  memory_id uuid,
  heart_message_id uuid,
  read_at timestamp with time zone,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint notifications_pkey PRIMARY KEY (id),
  constraint notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  constraint notifications_heart_message_id_fkey FOREIGN KEY (heart_message_id) REFERENCES heart_messages(id) ON DELETE CASCADE,
  constraint notifications_memory_id_fkey FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  constraint notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  constraint notifications_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  constraint notifications_not_self CHECK (((actor_id IS NULL) OR (actor_id <> recipient_id))),
  constraint notifications_target_present CHECK (
CASE type
    WHEN 'memory_created'::notification_type THEN ((memory_id IS NOT NULL) AND (room_id IS NOT NULL))
    WHEN 'comment_created'::notification_type THEN ((memory_id IS NOT NULL) AND (room_id IS NOT NULL))
    WHEN 'member_joined'::notification_type THEN (room_id IS NOT NULL)
    WHEN 'heart_received'::notification_type THEN (heart_message_id IS NOT NULL)
    ELSE NULL::boolean
END)
);

create table public.push_subscriptions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  endpoint text,
  p256dh text,
  auth text,
  created_at timestamp with time zone not null default now(),
  platform text not null default 'web'::text,
  token text,
  constraint push_subscriptions_endpoint_key UNIQUE (endpoint),
  constraint push_subscriptions_pkey PRIMARY KEY (id),
  constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  constraint push_subscriptions_platform_check CHECK ((platform = ANY (ARRAY['web'::text, 'ios'::text, 'android'::text]))),
  constraint push_subscriptions_shape_check CHECK ((((platform = 'web'::text) AND (endpoint IS NOT NULL) AND (p256dh IS NOT NULL) AND (auth IS NOT NULL)) OR ((platform = ANY (ARRAY['ios'::text, 'android'::text])) AND (token IS NOT NULL))))
);

create table public.reports (
  id uuid not null default gen_random_uuid(),
  reporter_id uuid,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  detail text,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now(),
  constraint reports_pkey PRIMARY KEY (id),
  constraint reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL,
  constraint reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'resolved'::text, 'dismissed'::text]))),
  constraint reports_target_type_check CHECK ((target_type = ANY (ARRAY['user'::text, 'heart_message'::text, 'memory'::text])))
);

create table public.room_members (
  id uuid not null default gen_random_uuid(),
  room_id uuid not null,
  user_id uuid not null,
  relationship_label text not null,
  role member_role not null default 'member'::member_role,
  has_replied_first_invite boolean not null default false,
  status member_status not null default 'active'::member_status,
  joined_at timestamp with time zone not null default now(),
  left_at timestamp with time zone,
  favorited boolean not null default false,
  nickname text,
  custom_name text,
  custom_cover_preset text,
  custom_cover_path text,
  constraint room_members_room_id_user_id_key UNIQUE (room_id, user_id),
  constraint room_members_pkey PRIMARY KEY (id),
  constraint room_members_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  constraint room_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  constraint left_at_matches_status CHECK ((((status = 'left'::member_status) AND (left_at IS NOT NULL)) OR ((status = 'active'::member_status) AND (left_at IS NULL)))),
  constraint room_members_custom_cover_preset_check CHECK (((custom_cover_preset IS NULL) OR (custom_cover_preset = ANY (ARRAY['warm'::text, 'blush'::text, 'sky'::text, 'sage'::text, 'dusk'::text, 'sand'::text])))),
  constraint room_members_custom_name_length CHECK (((custom_name IS NULL) OR ((btrim(custom_name) = custom_name) AND ((char_length(custom_name) >= 1) AND (char_length(custom_name) <= 20))))),
  constraint room_members_nickname_length CHECK (((nickname IS NULL) OR ((btrim(nickname) = nickname) AND ((char_length(nickname) >= 1) AND (char_length(nickname) <= 20)))))
);

create table public.rooms (
  id uuid not null default gen_random_uuid(),
  name text not null,
  relationship_type relationship_type,
  owner_id uuid,
  theme text,
  created_at timestamp with time zone not null default now(),
  cover_preset text not null default 'warm'::text,
  cover_path text,
  constraint rooms_pkey PRIMARY KEY (id),
  constraint rooms_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
  constraint rooms_cover_preset_check CHECK ((cover_preset = ANY (ARRAY['warm'::text, 'blush'::text, 'sky'::text, 'sage'::text, 'dusk'::text, 'sand'::text])))
);

create table public.users (
  id uuid not null,
  name text not null,
  email text,
  phone text,
  profile_image text,
  auth_provider auth_provider not null default 'email'::auth_provider,
  birth_date date not null,
  guardian_name text,
  guardian_phone text,
  guardian_consented_at timestamp with time zone,
  is_withdrawn boolean not null default false,
  created_at timestamp with time zone not null default now(),
  username text,
  large_text boolean not null default false,
  constraint users_phone_key UNIQUE (phone),
  constraint users_pkey PRIMARY KEY (id),
  constraint users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint users_username_format CHECK (((username IS NULL) OR (username ~ '^[a-z0-9]{4,16}$'::text)))
);

create table public.withdrawal_reasons (
  id uuid not null default gen_random_uuid(),
  reason text not null,
  detail text,
  created_at timestamp with time zone not null default now(),
  constraint withdrawal_reasons_pkey PRIMARY KEY (id)
);
