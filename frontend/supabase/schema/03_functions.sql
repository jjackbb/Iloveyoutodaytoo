-- 함수 28개. RLS 정책이 이 함수들에 기대고 있으므로 05_rls_public.sql 보다 먼저 돌려야 한다.

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text, p_label text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_inv public.invitations%rowtype;
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  -- 같은 링크로 두 명이 동시에 들어오는 것을 막는다
  select * into v_inv from public.invitations
   where invite_token = p_token for update;

  if not found then
    raise exception '유효하지 않은 초대입니다.';
  end if;

  -- 이미 그 방 구성원이면 통과시킨다 (같은 사람이 링크를 다시 열었을 뿐이다)
  if exists (
    select 1 from public.room_members
     where room_id = v_inv.room_id and user_id = v_uid and status = 'active'
  ) then
    return (select id from public.room_members
             where room_id = v_inv.room_id and user_id = v_uid);
  end if;

  if v_inv.used_at is not null then
    raise exception '이미 사용된 초대입니다. 초대한 분께 새 링크를 요청해주세요.';
  end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    raise exception '만료된 초대입니다.';
  end if;

  -- 방에 있는 사람 중 나와 차단 관계인 사람이 하나라도 있으면 입장 불가
  -- (초대자만 보던 것을 방 전체로 넓혔다)
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
  on conflict (room_id, user_id) do update
     set status = 'active', left_at = null
  returning id into v_id;

  update public.invitations
     set used_at = now(), used_by = v_uid
   where id = v_inv.id;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.add_owner_as_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.room_members (room_id, user_id, relationship_label, role)
  values (new.id, new.owner_id, '나', 'admin');
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_guardian_verification(p_id uuid, p_phone text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.create_streak_for_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.daily_streaks (room_member_id) values (new.id)
  on conflict (room_member_id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.effective_streak(p_room_member_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select case
           when ds.last_active_date >= (now() at time zone 'Asia/Seoul')::date - 1
             then ds.current_count
           else 0
         end
    from public.daily_streaks ds
   where ds.room_member_id = p_room_member_id;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_guardian_consent()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.birth_date > (current_date - interval '14 years')::date
     and new.guardian_consented_at is null then
    raise exception '만 14세 미만은 법정대리인 동의가 필요합니다.' using errcode = '23514';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_provider public.auth_provider;
begin
  -- raw_app_meta_data.provider 는 GoTrue 가 항상 정확히 채운다(email/kakao/google/phone).
  -- 우리가 직접 넣는 raw_user_meta_data.auth_provider 와 달리 OAuth 에서도 믿을 수 있다.
  -- (이 부분은 남겨 둔다 — 원래 코드의 실제 버그였고, 고쳐서 손해 볼 것이 없다)
  v_provider := coalesce(
    nullif(new.raw_app_meta_data->>'provider', '')::public.auth_provider,
    'email'
  );

  -- 생년월일은 **모든 가입 경로에서** 필수다. 만 14세 미만 판별에 쓰인다.
  if new.raw_user_meta_data->>'birth_date' is null then
    raise exception '생년월일 없이 가입할 수 없습니다. (만 14세 미만 판별 필수)';
  end if;

  insert into public.users (
    id, name, username, email, birth_date, auth_provider,
    guardian_name, guardian_phone, guardian_consented_at
  ) values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), '이름 없음'),
    nullif(new.raw_user_meta_data->>'username', ''),
    case when new.email ilike '%@id.oneuldo.local' then null else new.email end,
    nullif(new.raw_user_meta_data->>'birth_date', '')::date,
    v_provider,
    nullif(new.raw_user_meta_data->>'guardian_name', ''),
    nullif(new.raw_user_meta_data->>'guardian_phone', ''),
    case when (new.raw_user_meta_data->>'guardian_consented')::boolean is true
         then now() else null end
  );
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.has_blocked(p_blocked uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_blocked is not null and exists (
    select 1 from public.blocks
     where blocker_id = auth.uid() and blocked_id = p_blocked
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_room_admin(p_room_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.room_members
     where room_id = p_room_id and user_id = auth.uid()
       and status = 'active' and role = 'admin'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.room_members
     where room_id = p_room_id and user_id = auth.uid() and status = 'active'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.locked_senders()
 RETURNS TABLE(sender_id uuid, unreplied_count integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select h.sender_id, count(*)::integer
    from public.heart_messages h
   where h.receiver_id = (select auth.uid())
     and h.sender_id is not null
     and h.sender_id <> h.receiver_id
     and h.read_at is not null
     and h.replied_at is null
     and (
       h.memory_id is null
       or exists (
         select 1 from public.memories m
          where m.id = h.memory_id and m.deleted_at is null
       )
     )
     and not exists (
       select 1 from public.heart_message_hides x
        where x.message_id = h.id and x.user_id = (select auth.uid())
     )
   group by h.sender_id
  having count(*) >= 5;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_heart_read(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sender uuid;
  v_read timestamptz;
begin
  select h.sender_id, h.read_at into v_sender, v_read
    from public.heart_messages h
   where h.id = p_id and h.receiver_id = auth.uid();

  -- 내 것이 아니거나 없는 마음. 있는지 없는지 알려주지 않는다.
  if not found then
    return false;
  end if;

  -- 이미 들은 마음은 그대로 둔다. 처음 들은 시각이 진짜다.
  if v_read is not null then
    return true;
  end if;

  -- 잠긴 발신자의 안 들은 마음은 열 수 없다.
  if exists (select 1 from public.locked_senders() ls where ls.sender_id = v_sender) then
    return false;
  end if;

  update public.heart_messages
     set read_at = now()
   where id = p_id;

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_author_of_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_author uuid;
  v_room uuid;
begin
  -- 지워진 추억에는 알리지 않는다.
  select m.author_id, m.room_id into v_author, v_room
    from public.memories m
   where m.id = new.memory_id and m.deleted_at is null;

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
$function$
;

CREATE OR REPLACE FUNCTION public.notify_receiver_of_heart()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- "나에게" 보낸 마음은 알리지 않는다. 방금 자기가 보낸 것이다.
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

  insert into public.notifications
    (recipient_id, actor_id, type, room_id, heart_message_id)
  values (new.receiver_id, new.sender_id, 'heart_received', new.room_id, new.id);
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_room_members_of_memory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.notifications (recipient_id, actor_id, type, room_id, memory_id)
  select rm.user_id, new.author_id, 'memory_created', new.room_id, new.id
    from public.room_members rm
   where rm.room_id = new.room_id
     and rm.user_id <> new.author_id
     and rm.left_at is null
     and not exists (
       select 1 from public.blocks b
        where (b.blocker_id = rm.user_id and b.blocked_id = new.author_id)
           or (b.blocker_id = new.author_id and b.blocked_id = rm.user_id)
     );
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_room_of_new_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- 방을 처음 만든 사람(첫 멤버)에게는 알릴 상대가 없다.
  if new.left_at is not null then
    return null;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, room_id)
  select rm.user_id, new.user_id, 'member_joined', new.room_id
    from public.room_members rm
   where rm.room_id = new.room_id
     and rm.user_id <> new.user_id
     and rm.left_at is null
     and not exists (
       select 1 from public.blocks b
        where (b.blocker_id = rm.user_id and b.blocked_id = new.user_id)
           or (b.blocker_id = new.user_id and b.blocked_id = rm.user_id)
     );
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.owns_room_member(p_room_member_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.room_members
     where id = p_room_member_id and user_id = auth.uid()
  );
$function$
;

CREATE OR REPLACE FUNCTION public.path_uuid(p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare v uuid;
begin
  begin
    v := split_part(p_name, '/', 1)::uuid;
  exception when others then
    return null;
  end;
  return v;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pin_memory(p_memory_id uuid, p_pinned boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_room uuid;
begin
  select room_id into v_room
    from public.memories
   where id = p_memory_id and deleted_at is null;

  if v_room is null then
    raise exception '고정할 게시물을 찾지 못했습니다' using errcode = 'P0002';
  end if;

  if not public.is_room_member(v_room) then
    raise exception '이 앨범방의 멤버가 아닙니다' using errcode = '42501';
  end if;

  -- 새로 고정하면 이전 고정은 자동으로 풀린다. 유니크 인덱스와 부딪히지 않도록 먼저 비운다.
  update public.memories
     set pinned_at = null
   where room_id = v_room and pinned_at is not null;

  if p_pinned then
    update public.memories
       set pinned_at = now()
     where id = p_memory_id;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.preview_invitation(p_token text)
 RETURNS TABLE(room_id uuid, room_name text, inviter_name text, relationship_label text, invite_message text, expired boolean, used boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.name, coalesce(u.name, '탈퇴한 사용자'),
         i.relationship_label, i.invite_message,
         (i.expires_at is not null and i.expires_at < now()),
         (i.used_at is not null)
    from public.invitations i
    join public.rooms r on r.id = i.room_id
    left join public.users u on u.id = i.inviter_id
   where i.invite_token = p_token;
$function$
;

CREATE OR REPLACE FUNCTION public.prune_push_subscription(p_endpoint text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$function$
;

CREATE OR REPLACE FUNCTION public.push_targets_for_user(p_user_id uuid)
 RETURNS TABLE(endpoint text, p256dh text, auth text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select ps.endpoint, ps.p256dh, ps.auth
    from public.push_subscriptions ps
   where ps.user_id = p_user_id
     and public.shares_room_with(p_user_id)
     and not exists (
       select 1 from public.blocks b
        where (b.blocker_id = p_user_id and b.blocked_id = auth.uid())
           or (b.blocker_id = auth.uid() and b.blocked_id = p_user_id)
     );
$function$
;

CREATE OR REPLACE FUNCTION public.room_members_guard_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.role is distinct from old.role
     and old.user_id = (select auth.uid())
     and not public.is_room_admin(old.room_id)
  then
    raise exception '방장 권한은 스스로 바꿀 수 없습니다.'
      using errcode = '42501';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.shares_room_with(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
      from public.room_members a
      join public.room_members b on a.room_id = b.room_id
     where a.user_id = auth.uid() and a.status = 'active'
       and b.user_id = p_user_id  and b.status = 'active'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.touch_streak()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    return new;                                  -- 오늘 이미 실천함
  elsif v_last = v_today - 1 then
    v_cur := v_cur + 1;                          -- 연속 유지
  else
    v_cur := 1;                                  -- 끊겼다 → 담담하게 1부터 다시
  end if;

  update public.daily_streaks
     set current_count    = v_cur,
         best_count       = greatest(v_best, v_cur),
         last_active_date = v_today
   where room_member_id = v_member_id;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.unlock_on_reply()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- "나에게" 보낸 마음은 답장이 아니다.
  if new.receiver_id is null
     or new.sender_id is null
     or new.receiver_id = new.sender_id then
    return null;
  end if;

  update public.heart_messages
     set replied_at = now()
   where receiver_id = new.sender_id     -- 나에게 온 것 중
     and sender_id = new.receiver_id     -- 방금 내가 마음을 보낸 그 사람이 보낸 것
     and replied_at is null;

  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.username_taken(p_username text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- normalizeUsername(앞뒤 공백 제거 + 소문자)과 같은 규칙으로 맞춘다.
  -- 화면에서 다듬은 값과 여기서 보는 값이 다르면 결과가 어긋난다.
  select exists (
    select 1 from public.users
    where username = lower(btrim(coalesce(p_username, '')))
  );
$function$
;

CREATE OR REPLACE FUNCTION public.withdraw_account(p_reason text DEFAULT NULL::text, p_detail text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    values (left(trim(p_reason), 200),
            nullif(left(trim(coalesce(p_detail, '')), 1000), ''));
  end if;

  -- 나 말고 아무도 발을 들인 적 없는 방만 정리한다.
  -- 나갔던(left) 사람도 자기 사서함에 기록이 남아 있으므로 '남의 방'으로 친다.
  delete from public.rooms r
   where r.owner_id = v_uid
     and not exists (
       select 1 from public.room_members m
        where m.room_id = r.id and m.user_id <> v_uid
     );

  -- 남은 방은 방장을 넘긴다.
  for v_room in select id from public.rooms where owner_id = v_uid
  loop
    select m.user_id into v_heir
      from public.room_members m
     where m.room_id = v_room.id
       and m.user_id <> v_uid
       and m.status = 'active'
     order by (m.role = 'admin') desc, m.joined_at
     limit 1;

    if v_heir is not null then
      update public.rooms set owner_id = v_heir where id = v_room.id;
      update public.room_members set role = 'admin'
       where room_id = v_room.id and user_id = v_heir;
    end if;
  end loop;

  -- 개인정보는 즉시 파기. 내가 남긴 마음은 상대 사서함에 익명으로 남는다.
  delete from auth.users where id = v_uid;
end;
$function$
;
