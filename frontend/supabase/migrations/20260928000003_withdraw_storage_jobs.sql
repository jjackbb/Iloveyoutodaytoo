-- 탈퇴 거래 안에서 삭제 대상 파일을 먼저 기록한다.
-- 계정 삭제 뒤 Storage 요청이 실패하거나 서버가 중단돼도 관리자 재시도 목록이 남는다.
create or replace function public.withdraw_account(p_reason text default null, p_detail text default null)
 returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_room record;
  v_heir uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  -- 보유자가 본인인 실제 객체만 대상이다. 나만 보던 추억과 나 혼자만 있었던
  -- 방의 첨부, 프로필 사진을 계정 삭제 전에 한 거래에서 기록한다.
  with private_paths as (
    select 'media'::text bucket_id, p.storage_path object_name
      from public.memory_photos p
      join public.memories m on m.id = p.memory_id
     where m.author_id = v_uid and m.visibility = 'private'
    union all
    select 'voice', m.voice_path from public.memories m
     where m.author_id = v_uid and m.visibility = 'private' and m.voice_path is not null
    union all
    select 'handwriting', m.handwriting_path from public.memories m
     where m.author_id = v_uid and m.visibility = 'private' and m.handwriting_path is not null
    union all
    select 'video', m.video_path from public.memories m
     where m.author_id = v_uid and m.visibility = 'private' and m.video_path is not null
    union all
    select 'voice', c.voice_path from public.memory_comments c
      join public.memories m on m.id = c.memory_id
     where m.author_id = v_uid and m.visibility = 'private' and c.voice_path is not null
  ), doomed_rooms as (
    select r.id from public.rooms r
     where r.owner_id = v_uid
       and not exists (
         select 1 from public.room_members member
          where member.room_id = r.id and member.user_id <> v_uid
       )
  )
  insert into public.storage_deletion_jobs
    (requested_by, bucket_id, object_name, reason)
  select v_uid, o.bucket_id, o.name, 'account_withdrawn'
    from storage.objects o
   where o.owner_id = v_uid::text
     and (
       (o.bucket_id = 'avatars' and split_part(o.name, '/', 1) = v_uid::text)
       or (o.bucket_id in ('voice', 'media', 'covers', 'handwriting', 'video')
           and exists (select 1 from doomed_rooms r
                        where split_part(o.name, '/', 1) = r.id::text))
       or exists (select 1 from private_paths p
                   where p.bucket_id = o.bucket_id and p.object_name = o.name)
     )
  on conflict on constraint storage_deletion_jobs_object_key do update
     set reason = 'account_withdrawn'
   where storage_deletion_jobs.requested_by = v_uid;

  if p_reason is not null and length(trim(p_reason)) > 0 then
    insert into public.withdrawal_reasons (reason, detail)
    values (left(trim(p_reason), 200), nullif(left(trim(coalesce(p_detail, '')), 1000), ''));
  end if;

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

revoke execute on function public.withdraw_account(text, text) from public, anon;
grant execute on function public.withdraw_account(text, text) to authenticated, service_role;
