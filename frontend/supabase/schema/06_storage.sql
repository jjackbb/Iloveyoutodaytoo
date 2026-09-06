-- 스토리지 버킷 4개와 정책 7개.
-- 버킷은 전부 비공개(public=false)다. 파일은 서명 URL로만 나간다.
-- 정책이 path_uuid() · is_room_member() · shares_room_with() 에 기대므로 03_functions.sql 뒤에 돌린다.

-- 버킷 (id | 공개 | 용량 상한 | 허용 MIME)
--   avatars | 비공개 |  5 MB | image/jpeg, image/png, image/webp
--   covers  | 비공개 |  5 MB | image/jpeg, image/png, image/webp
--   media   | 비공개 | 50 MB | image/jpeg, image/png, image/webp, image/heic, video/mp4, video/webm, video/quicktime
--   voice   | 비공개 | 10 MB | audio/webm, audio/mpeg, audio/mp4, audio/ogg, audio/wav

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', false,  5242880, array['image/jpeg','image/png','image/webp']),
  ('covers',  'covers',  false,  5242880, array['image/jpeg','image/png','image/webp']),
  ('media',   'media',   false, 52428800, array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/webm','video/quicktime']),
  ('voice',   'voice',   false, 10485760, array['audio/webm','audio/mpeg','audio/mp4','audio/ogg','audio/wav'])
on conflict (id) do nothing;

-- 정책
create policy avatars_delete on storage.objects as permissive for delete to authenticated
  using (((bucket_id = 'avatars'::text) AND (path_uuid(name) = auth.uid())));

create policy avatars_select on storage.objects as permissive for select to authenticated
  using (((bucket_id = 'avatars'::text) AND ((path_uuid(name) = auth.uid()) OR shares_room_with(path_uuid(name)))));

create policy avatars_update on storage.objects as permissive for update to authenticated
  using (((bucket_id = 'avatars'::text) AND (path_uuid(name) = auth.uid())));

create policy avatars_write on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = 'avatars'::text) AND (path_uuid(name) = auth.uid())));

create policy media_voice_delete on storage.objects as permissive for delete to authenticated
  using (((bucket_id = ANY (ARRAY['media'::text, 'voice'::text, 'covers'::text])) AND (owner_id = (( SELECT auth.uid() AS uid))::text)));

create policy media_voice_insert on storage.objects as permissive for insert to authenticated
  with check (((bucket_id = ANY (ARRAY['media'::text, 'voice'::text, 'covers'::text])) AND is_room_member(path_uuid(name)) AND (owner_id = (( SELECT auth.uid() AS uid))::text)));

create policy media_voice_select on storage.objects as permissive for select to authenticated
  using (((bucket_id = ANY (ARRAY['media'::text, 'voice'::text, 'covers'::text])) AND is_room_member(path_uuid(name))));
