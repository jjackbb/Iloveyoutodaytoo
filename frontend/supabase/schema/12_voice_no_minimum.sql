-- 2026-09-25 준비: 음성 녹음의 3초 하한 제거.
-- 기존 01_tables.sql 은 2026-09-06 스키마 스냅샷으로 보존한다.
-- 적용 전에는 대상 프로젝트와 현재 제약 정의를 확인한다.
-- 이 변경은 11_handwriting_pair_not_null.sql 뒤에 적용한다.
-- 길이 컬럼은 정수 초라 1초 미만의 실제 녹음은 0초로 저장될 수 있다.
-- 빈 녹음 파일은 브라우저에서 막고, DB는 0~60초 메타데이터를 허용한다.

begin;

-- 예상한 3초 제약이 아니면 다른 변경을 덮지 않도록 중단한다.
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'heart_messages'
      and c.conname = 'duration_matches_type'
      and pg_get_constraintdef(c.oid) like '%duration_sec >= 3%'
  ) then
    raise exception 'heart_messages.duration_matches_type 정의가 예상과 달라 변경을 멈춥니다';
  end if;

  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'memories'
      and c.conname = 'memories_voice_pair'
      and pg_get_constraintdef(c.oid) like '%voice_duration_sec >= 3%'
  ) then
    raise exception 'memories.memories_voice_pair 정의가 예상과 달라 변경을 멈춥니다';
  end if;

  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'memory_comments'
      and c.conname = 'memory_comments_kind'
      and pg_get_constraintdef(c.oid) like '%voice_duration_sec >= 3%'
  ) then
    raise exception 'memory_comments.memory_comments_kind 정의가 예상과 달라 변경을 멈춥니다';
  end if;
end $$;

-- 예전 CHECK는 길이가 NULL일 때 UNKNOWN으로 통과할 수 있었다.
-- 그런 행이 있으면 원인을 확인한 뒤 별도로 고쳐야 하므로 변경을 멈춘다.
do $$
begin
  if exists (
    select 1 from public.heart_messages
    where type = 'voice'::public.message_type and duration_sec is null
  ) then
    raise exception 'heart_messages에 길이가 없는 음성 행이 있어 먼저 확인해야 합니다';
  end if;

  if exists (
    select 1 from public.memories
    where voice_path is not null and voice_duration_sec is null
  ) then
    raise exception 'memories에 길이가 없는 음성 행이 있어 먼저 확인해야 합니다';
  end if;

  if exists (
    select 1 from public.memory_comments
    where voice_path is not null and voice_duration_sec is null
  ) then
    raise exception 'memory_comments에 길이가 없는 음성 행이 있어 먼저 확인해야 합니다';
  end if;
end $$;

alter table public.heart_messages
  drop constraint duration_matches_type;
alter table public.heart_messages
  add constraint duration_matches_type check (
    (type = 'text'::public.message_type and duration_sec is null)
    or (type = 'voice'::public.message_type
        and duration_sec is not null and duration_sec between 0 and 60)
    or (type = 'video'::public.message_type and duration_sec between 2 and 3)
  );

alter table public.memories
  drop constraint memories_voice_pair;
alter table public.memories
  add constraint memories_voice_pair check (
    (voice_path is null and voice_duration_sec is null)
    or (voice_path is not null and voice_duration_sec is not null
        and voice_duration_sec between 0 and 60)
  );

alter table public.memory_comments
  drop constraint memory_comments_kind;
alter table public.memory_comments
  add constraint memory_comments_kind check (
    (body is not null and voice_path is null and voice_duration_sec is null)
    or (body is null and voice_path is not null and voice_duration_sec is not null
        and voice_duration_sec between 0 and 60)
  );

commit;
