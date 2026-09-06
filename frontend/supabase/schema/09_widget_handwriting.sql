-- 2026-09-06 적용. 08_knock_enum.sql 뒤에 돌린다(그쪽 enum 값이 여기서 쓰인다).
-- 사용자 승인: 위젯 토큰 · 톡톡 알림 · 손글씨 컬럼/버킷 — 셋을 한 번에.
-- 기존 행·제약은 하나도 건드리지 않는다.

-- ─────────────────────────────────────────────────────────────
-- ① 위젯 토큰 (WIDGET-01)
--
-- 위젯은 웹뷰 밖에서 살아 로그인 세션을 못 본다. 그래서 위젯만을 위한 긴 난수
-- 토큰을 따로 둔다. 토큰이 할 수 있는 것은 딱 둘 — 최근 표현 1건 읽기, 톡톡 보내기.
-- 새어도 그 둘뿐이고, 행 하나 지우면 폐기된다. 수명은 로그아웃·탈퇴까지(사용자 결정).
--
-- 평문은 저장하지 않는다(해시만). 발급 순간 한 번만 돌려준다.
-- RLS 를 켜고 정책을 두지 않는다 = 보호자 인증과 같은 "service_role 외 접근 금지".
-- ─────────────────────────────────────────────────────────────

create table public.widget_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
comment on table public.widget_tokens is
  '홈 화면 위젯 전용 토큰(해시). 로그아웃·탈퇴 시 삭제. 토큰이 할 수 있는 것은 최근 표현 1건 읽기와 톡톡뿐.';

create index widget_tokens_user_idx on public.widget_tokens (user_id);
alter table public.widget_tokens enable row level security;

-- 발급. 로그인한 사용자만. 기기가 여럿이면 토큰도 여럿 — 하나로 묶지 않는다.
create or replace function public.issue_widget_token()
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
$function$;

-- 회수. 로그아웃 때 부른다. 탈퇴는 FK cascade 가 알아서 지운다.
create or replace function public.revoke_widget_tokens()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
$function$;

-- 토큰 → 사용자. 아래 두 함수만 부른다(anon 이 직접 못 부르게 권한 회수).
-- DEFINER 함수 안에서는 소유자 권한으로 돌므로 회수해도 내부 호출은 된다.
create or replace function public.widget_user_from_token(p_token text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid;
begin
  update public.widget_tokens
     set last_used_at = now()
   where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  returning user_id into v_uid;
  return v_uid; -- null 이면 무효 토큰
end;
$function$;
revoke all on function public.widget_user_from_token(text) from public, anon, authenticated;

-- 위젯에 띄울 "최근 표현" 1건 (사용자 결정: 내 방에서 남이 남긴 최신 추억).
-- 남이 남긴 게 하나도 없으면 내 최신 것을 돌려준다(is_mine = true) —
-- 혼자 쓰는 사람에게도 위젯이 비지 않게(북극성 "혼자여도 성립").
-- 사진 서명은 여기서 못 한다(Storage API 의 일). 경로만 돌려주고 API 라우트가 서명한다.
create or replace function public.widget_latest(p_token text)
 returns table(
   memory_id            uuid,
   room_id              uuid,
   room_name            text,
   author_id            uuid,
   author_name          text,
   created_at           timestamptz,
   photo_path           text,
   voice_duration_sec   integer,
   handwriting_path     text,
   caption              text,
   is_mine              boolean
 )
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := public.widget_user_from_token(p_token);
begin
  if v_uid is null then
    return; -- 빈 결과. 무효 토큰인지 표현이 없는지는 API 라우트가 가른다
  end if;

  return query
  select m.id, m.room_id,
         coalesce(me.custom_name, r.name),
         m.author_id,
         coalesce(u.name, '탈퇴한 사용자'),
         m.created_at,
         (select p.storage_path from public.memory_photos p
           where p.memory_id = m.id order by p.sort_order limit 1),
         m.voice_duration_sec,
         m.handwriting_path,
         m.description,
         false
    from public.memories m
    join public.rooms r on r.id = m.room_id
    join public.room_members me
      on me.room_id = m.room_id and me.user_id = v_uid and me.status = 'active'
    left join public.users u on u.id = m.author_id
   where m.deleted_at is null
     and m.author_id is distinct from v_uid
     and not exists (select 1 from public.memory_hides h
                      where h.memory_id = m.id and h.user_id = v_uid)
     and not exists (select 1 from public.blocks b
                      where (b.blocker_id = v_uid and b.blocked_id = m.author_id)
                         or (b.blocker_id = m.author_id and b.blocked_id = v_uid))
   order by m.created_at desc
   limit 1;

  if found then return; end if;

  return query
  select m.id, m.room_id,
         coalesce(me.custom_name, r.name),
         m.author_id,
         coalesce(u.name, '나'),
         m.created_at,
         (select p.storage_path from public.memory_photos p
           where p.memory_id = m.id order by p.sort_order limit 1),
         m.voice_duration_sec,
         m.handwriting_path,
         m.description,
         true
    from public.memories m
    join public.rooms r on r.id = m.room_id
    join public.room_members me
      on me.room_id = m.room_id and me.user_id = v_uid and me.status = 'active'
    left join public.users u on u.id = m.author_id
   where m.deleted_at is null
     and m.author_id = v_uid
   order by m.created_at desc
   limit 1;
end;
$function$;

-- 톡톡. 같은 방을 쓰고 차단 관계가 아닌 사람에게만 간다.
-- 보내는 쪽 제한은 없다(사용자 결정 — 초대한 사람끼리라 스팸이 성립하지 않는다).
-- 다만 받는 쪽 알림함이 같은 사람의 톡톡으로 도배되지 않게, 아직 안 읽은 톡톡이
-- 같은 사람에게서 이미 있으면 새 줄을 만들지 않고 시각만 당긴다.
create or replace function public.widget_knock(p_token text, p_target uuid, p_memory uuid default null)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid  uuid := public.widget_user_from_token(p_token);
  v_room uuid;
begin
  if v_uid is null or p_target is null or p_target = v_uid then
    return false;
  end if;

  select a.room_id into v_room
    from public.room_members a
    join public.room_members b on a.room_id = b.room_id
   where a.user_id = v_uid    and a.status = 'active'
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

  update public.notifications
     set created_at = now(), memory_id = coalesce(p_memory, memory_id)
   where recipient_id = p_target and actor_id = v_uid
     and type = 'knock' and read_at is null and deleted_at is null;
  if not found then
    insert into public.notifications (recipient_id, actor_id, type, room_id, memory_id)
    values (p_target, v_uid, 'knock', v_room, p_memory);
  end if;

  return true;
end;
$function$;

-- 알림 대상 검사 제약에 knock 가지를 명시한다.
-- (기존 ELSE NULL 로도 통과는 했지만, "톡톡은 방이 있어야 한다"를 DB 가 말하게 둔다)
alter table public.notifications drop constraint notifications_target_present;
alter table public.notifications add constraint notifications_target_present check (
  case type
    when 'memory_created'  then (memory_id is not null and room_id is not null)
    when 'comment_created' then (memory_id is not null and room_id is not null)
    when 'member_joined'   then (room_id is not null)
    when 'heart_received'  then (heart_message_id is not null)
    when 'knock'           then (room_id is not null)
    else null::boolean
  end
);

-- ─────────────────────────────────────────────────────────────
-- ② 손글씨 (WRITE-01) — 획 좌표는 스토리지 파일, 컬럼은 경로·길이 둘.
--    목소리(voice_path · voice_duration_sec)와 정확히 같은 구조라
--    RLS · 서명 URL · 삭제 흐름을 그대로 쓴다(사용자 결정).
-- ─────────────────────────────────────────────────────────────

alter table public.memories
  add column handwriting_path        text,
  add column handwriting_duration_ms integer,
  add constraint memories_handwriting_pair check (
    (handwriting_path is null and handwriting_duration_ms is null)
    or (handwriting_path is not null
        and handwriting_duration_ms >= 0 and handwriting_duration_ms <= 600000)
  );
comment on column public.memories.handwriting_path is
  'handwriting 버킷의 {room_id}/파일.json — 획마다 점 배열+시각. 타임랩스(WRITE-02)가 여기 걸려 있다.';
comment on column public.memories.handwriting_duration_ms is
  '첫 획 시작부터 마지막 획 끝까지(ms). 재생은 최대 4초로 압축한다.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('handwriting', 'handwriting', false, 2097152, array['application/json'])
on conflict (id) do nothing;

-- media/voice 와 같은 규칙: 경로 첫 칸이 room_id, 그 방 구성원만.
create policy handwriting_select on storage.objects as permissive for select to authenticated
  using ((bucket_id = 'handwriting'::text) and is_room_member(path_uuid(name)));

create policy handwriting_insert on storage.objects as permissive for insert to authenticated
  with check ((bucket_id = 'handwriting'::text)
              and is_room_member(path_uuid(name))
              and (owner_id = ((select auth.uid()))::text));

create policy handwriting_delete on storage.objects as permissive for delete to authenticated
  using ((bucket_id = 'handwriting'::text) and (owner_id = ((select auth.uid()))::text));
