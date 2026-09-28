-- E16~E17 데모의 표현 기능을 Supabase 앱에서도 보존한다.
-- 기존 추억은 기본 필기구/편지지와 영상 전체 구간으로 읽힌다.

alter table public.memories
  add column handwriting_pen text not null default 'ink',
  add column handwriting_paper text not null default 'hanji',
  add column video_trim_start_ms integer,
  add column video_trim_end_ms integer,
  add column video_poster_ms integer,
  add constraint memories_handwriting_pen_check check (handwriting_pen in ('ink', 'pencil', 'fountain')),
  add constraint memories_handwriting_paper_check check (handwriting_paper in ('hanji', 'warm')),
  add constraint memories_video_presentation_check check (
    (video_path is null and video_trim_start_ms is null and video_trim_end_ms is null and video_poster_ms is null)
    or (video_path is not null
      and (video_trim_start_ms is null and video_trim_end_ms is null
        or (video_trim_start_ms is not null and video_trim_end_ms is not null
          and video_trim_start_ms >= 0
          and video_trim_end_ms - video_trim_start_ms >= 1000
          and video_trim_end_ms <= video_duration_ms))
      and (video_poster_ms is null or (video_poster_ms >= coalesce(video_trim_start_ms, 0)
        and video_poster_ms <= coalesce(video_trim_end_ms, video_duration_ms))))
  );

create table public.memory_reactions (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('thanks', 'cheer', 'miss')),
  created_at timestamptz not null default now(),
  constraint memory_reactions_one_per_kind unique (memory_id, user_id, kind)
);
create index memory_reactions_memory_idx on public.memory_reactions (memory_id);
alter table public.memory_reactions enable row level security;
create policy memory_reactions_select on public.memory_reactions for select to authenticated
  using (public.can_read_memory(memory_id));
create policy memory_reactions_insert on public.memory_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_read_memory(memory_id));
create policy memory_reactions_delete on public.memory_reactions for delete to authenticated
  using (user_id = (select auth.uid()));
grant select, insert, delete on public.memory_reactions to authenticated;

alter table public.memory_comments
  add column reply_to uuid references public.memory_comments(id) on delete cascade;
create index memory_comments_reply_to_idx on public.memory_comments (reply_to) where reply_to is not null;

-- 클라이언트가 RLS를 통과해 직접 쓰더라도 다른 게시물·답글에 매달리지 못하게 한다.
create function public.check_memory_comment_reply() returns trigger
language plpgsql security invoker set search_path to 'public' as $$
declare v_parent public.memory_comments%rowtype;
begin
  if tg_op = 'UPDATE' and (new.memory_id is distinct from old.memory_id
    or new.reply_to is distinct from old.reply_to) then
    raise exception '댓글의 게시물과 답글 대상은 바꿀 수 없습니다.' using errcode = '23514';
  end if;
  if new.reply_to is null then return new; end if;
  select * into v_parent from public.memory_comments where id = new.reply_to;
  if not found or v_parent.memory_id is distinct from new.memory_id
    or v_parent.reply_to is not null or v_parent.deleted_at is not null then
    raise exception '답글을 달 수 없는 댓글입니다.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger memory_comments_check_reply before insert or update of reply_to, memory_id
  on public.memory_comments for each row execute function public.check_memory_comment_reply();

-- 기존 create_memory/update_memory를 한 거래 안에서 호출해 파일·사진 처리와 새 표시값을 함께 저장한다.
create function public.create_memory_enhanced(
  p_room_id uuid, p_caption text, p_photo_paths text[],
  p_voice_path text, p_voice_duration_sec integer, p_voice_levels real[],
  p_handwriting_path text, p_handwriting_duration_ms integer,
  p_video_path text, p_video_duration_ms integer,
  p_handwriting_pen text, p_handwriting_paper text,
  p_video_trim_start_ms integer, p_video_trim_end_ms integer, p_video_poster_ms integer
) returns uuid language plpgsql security invoker set search_path to 'public' as $$
declare v_id uuid;
begin
  v_id := public.create_memory(p_room_id, p_caption, p_photo_paths, p_voice_path,
    p_voice_duration_sec, p_voice_levels, p_handwriting_path, p_handwriting_duration_ms,
    p_video_path, p_video_duration_ms);
  update public.memories set
    handwriting_pen = p_handwriting_pen,
    handwriting_paper = p_handwriting_paper,
    video_trim_start_ms = p_video_trim_start_ms,
    video_trim_end_ms = p_video_trim_end_ms,
    video_poster_ms = p_video_poster_ms
  where id = v_id;
  return v_id;
end;
$$;

create function public.update_memory_enhanced(
  p_memory_id uuid, p_caption text, p_photo_paths text[],
  p_voice_path text, p_voice_duration_sec integer, p_voice_levels real[],
  p_handwriting_path text, p_handwriting_duration_ms integer,
  p_video_path text, p_video_duration_ms integer,
  p_handwriting_pen text, p_handwriting_paper text,
  p_video_trim_start_ms integer, p_video_trim_end_ms integer, p_video_poster_ms integer
) returns void language plpgsql security invoker set search_path to 'public' as $$
begin
  -- 예전 영상에 구간이 있으면 기존 update_memory가 영상 경로를 바꾸는 순간
  -- CHECK가 먼저 실행된다. 같은 거래 안에서 표시값을 비운 뒤 파일 변경을 적용한다.
  update public.memories set
    video_trim_start_ms = null,
    video_trim_end_ms = null,
    video_poster_ms = null
  where id = p_memory_id and author_id = auth.uid();
  perform public.update_memory(p_memory_id, p_caption, p_photo_paths, p_voice_path,
    p_voice_duration_sec, p_voice_levels, p_handwriting_path, p_handwriting_duration_ms,
    p_video_path, p_video_duration_ms);
  update public.memories set
    handwriting_pen = p_handwriting_pen,
    handwriting_paper = p_handwriting_paper,
    video_trim_start_ms = p_video_trim_start_ms,
    video_trim_end_ms = p_video_trim_end_ms,
    video_poster_ms = p_video_poster_ms
  where id = p_memory_id and author_id = auth.uid();
end;
$$;

revoke all on function public.create_memory_enhanced(uuid, text, text[], text, integer, real[], text, integer, text, integer, text, text, integer, integer, integer) from public, anon;
revoke all on function public.update_memory_enhanced(uuid, text, text[], text, integer, real[], text, integer, text, integer, text, text, integer, integer, integer) from public, anon;
grant execute on function public.create_memory_enhanced(uuid, text, text[], text, integer, real[], text, integer, text, integer, text, text, integer, integer, integer) to authenticated;
grant execute on function public.update_memory_enhanced(uuid, text, text[], text, integer, real[], text, integer, text, integer, text, text, integer, integer, integer) to authenticated;
