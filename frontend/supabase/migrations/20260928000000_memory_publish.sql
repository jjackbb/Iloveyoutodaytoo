-- 2026-09-28 '나만 보기' 추억을 공개로 바꾸기.
--
-- 사용자 결정(2026-09-28): 작성자는 자기 '나만 보기'(private) 추억을 방 공개(room)로 바꿀 수 있다.
-- 한 장씩(⋯ 메뉴)과 여러 장 한꺼번에(편집) 모두. 반대로 공개 → 나만 보기는 없다.
-- 저장 순간 활성 참여자 수로 정하는 첫 분류(20260926 memories_before_write)는 그대로다.
-- 앞선 결정 "저장 뒤 공개 범위 불변"(2026-09-26)을 이 방향에 한해 사용자가 바꿨다.
--
-- 공개로 바꿔도 알림은 보내지 않는다(새 글이 아니다). 읽기·파일 서명은 can_read_memory 가
-- visibility 를 보므로 따로 고칠 것이 없다.

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
    -- 저장 뒤에는 방·작성자를 바꾸지 않는다.
    -- 공개 범위는 작성자가 지금 그 방의 참여자일 때 private → room 으로 여는 것만 받는다
    -- (2026-09-28 사용자 결정). room → private 되돌리기나 남의 글 바꾸기는 조용히 원래 값으로 둔다.
    if not (old.visibility = 'private' and new.visibility = 'room'
            and old.author_id = auth.uid() and public.is_room_member(old.room_id)) then
      new.visibility := old.visibility;
    end if;
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

-- 여러 장을 한 번에 연다. 하나라도 내 글이 아니거나(남의 글·없는 글·내가 떠난 방) 읽을 수 없으면
-- 아무것도 바꾸지 않고 거절한다. 이미 공개인 글은 건너뛴다. 바꾼 개수를 돌려준다.
-- 호출자 권한(security invoker)으로 돈다 — RLS(memories_select·memories_update)가 한 번 더 막는다.
create or replace function public.publish_memories(p_memory_ids uuid[])
 returns integer language plpgsql set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if p_memory_ids is null or cardinality(p_memory_ids) = 0 then
    return 0;
  end if;
  if exists (
    select 1
      from unnest(p_memory_ids) as req(id)
      left join public.memories m on m.id = req.id
     where m.id is null
        or m.author_id is distinct from v_uid
        or not public.is_room_member(m.room_id)
  ) then
    raise exception '내가 남긴 추억만 공개로 바꿀 수 있습니다.' using errcode = '42501';
  end if;

  update public.memories
     set visibility = 'room'
   where id = any(p_memory_ids)
     and visibility = 'private';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.publish_memories(uuid[]) from public, anon;
grant execute on function public.publish_memories(uuid[]) to authenticated;
