-- public 스키마 RLS. 정책이 is_room_member() 등 03_functions.sql 의 함수에 기대므로 그 뒤에 돌린다.
-- guardian_verifications 는 RLS 를 켜고 정책을 하나도 두지 않는다 = service_role 외 아무도 접근 못 함(의도).

alter table public.blocks                   enable row level security;
alter table public.daily_streaks            enable row level security;
alter table public.guardian_verifications   enable row level security;
alter table public.heart_message_favorites  enable row level security;
alter table public.heart_message_hides      enable row level security;
alter table public.heart_messages           enable row level security;
alter table public.invitations              enable row level security;
alter table public.memories                 enable row level security;
alter table public.memory_comments          enable row level security;
alter table public.memory_hides             enable row level security;
alter table public.memory_likes             enable row level security;
alter table public.memory_photos            enable row level security;
alter table public.memory_saves             enable row level security;
alter table public.notifications            enable row level security;
alter table public.push_subscriptions       enable row level security;
alter table public.reports                  enable row level security;
alter table public.room_members             enable row level security;
alter table public.rooms                    enable row level security;
alter table public.users                    enable row level security;
alter table public.withdrawal_reasons       enable row level security;

create policy blocks_delete on public.blocks as permissive for delete to authenticated
  using ((blocker_id = ( SELECT auth.uid() AS uid)));

create policy blocks_insert on public.blocks as permissive for insert to authenticated
  with check ((blocker_id = ( SELECT auth.uid() AS uid)));

create policy blocks_select on public.blocks as permissive for select to authenticated
  using ((blocker_id = ( SELECT auth.uid() AS uid)));

create policy daily_streaks_select on public.daily_streaks as permissive for select to authenticated
  using (owns_room_member(room_member_id));

create policy heart_message_favorites_delete on public.heart_message_favorites as permissive for delete to public
  using ((user_id = ( SELECT auth.uid() AS uid)));

create policy heart_message_favorites_insert on public.heart_message_favorites as permissive for insert to public
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM heart_messages m
  WHERE ((m.id = heart_message_favorites.message_id) AND ((m.sender_id = ( SELECT auth.uid() AS uid)) OR (m.receiver_id = ( SELECT auth.uid() AS uid))))))));

create policy heart_message_favorites_select on public.heart_message_favorites as permissive for select to public
  using (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM heart_messages m
  WHERE ((m.id = heart_message_favorites.message_id) AND ((m.sender_id = ( SELECT auth.uid() AS uid)) OR (m.receiver_id = ( SELECT auth.uid() AS uid))))))));

create policy heart_message_hides_delete on public.heart_message_hides as permissive for delete to public
  using ((user_id = ( SELECT auth.uid() AS uid)));

create policy heart_message_hides_insert on public.heart_message_hides as permissive for insert to public
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM heart_messages h
  WHERE ((h.id = heart_message_hides.message_id) AND ((h.sender_id = ( SELECT auth.uid() AS uid)) OR (h.receiver_id = ( SELECT auth.uid() AS uid))))))));

create policy heart_message_hides_select on public.heart_message_hides as permissive for select to public
  using ((user_id = ( SELECT auth.uid() AS uid)));

create policy heart_messages_delete on public.heart_messages as permissive for delete to authenticated
  using ((sender_id = ( SELECT auth.uid() AS uid)));

create policy heart_messages_insert on public.heart_messages as permissive for insert to authenticated
  with check (((sender_id = ( SELECT auth.uid() AS uid)) AND is_room_member(room_id)));

create policy heart_messages_select on public.heart_messages as permissive for select to authenticated
  using (((sender_id = ( SELECT auth.uid() AS uid)) OR ((receiver_id = ( SELECT auth.uid() AS uid)) AND (NOT has_blocked(sender_id)))));

create policy heart_messages_update on public.heart_messages as permissive for update to authenticated
  using ((sender_id = ( SELECT auth.uid() AS uid)))
  with check ((sender_id = ( SELECT auth.uid() AS uid)));

create policy invitations_delete on public.invitations as permissive for delete to authenticated
  using (((inviter_id = ( SELECT auth.uid() AS uid)) OR is_room_admin(room_id)));

create policy invitations_insert on public.invitations as permissive for insert to authenticated
  with check (((inviter_id = ( SELECT auth.uid() AS uid)) AND is_room_member(room_id)));

create policy invitations_select on public.invitations as permissive for select to authenticated
  using (((inviter_id = ( SELECT auth.uid() AS uid)) OR is_room_member(room_id)));

create policy memories_delete on public.memories as permissive for delete to authenticated
  using ((author_id = ( SELECT auth.uid() AS uid)));

create policy memories_insert on public.memories as permissive for insert to authenticated
  with check (((author_id = ( SELECT auth.uid() AS uid)) AND is_room_member(room_id)));

create policy memories_select on public.memories as permissive for select to authenticated
  using ((is_room_member(room_id) AND (NOT has_blocked(author_id))));

create policy memories_update on public.memories as permissive for update to authenticated
  using ((author_id = ( SELECT auth.uid() AS uid)))
  with check ((author_id = ( SELECT auth.uid() AS uid)));

create policy memory_comments_insert on public.memory_comments as permissive for insert to authenticated
  with check (((author_id = ( SELECT auth.uid() AS uid)) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM memories m
  WHERE ((m.id = memory_comments.memory_id) AND is_room_member(m.room_id) AND (m.deleted_at IS NULL))))));

create policy memory_comments_select on public.memory_comments as permissive for select to authenticated
  using (((EXISTS ( SELECT 1
   FROM memories m
  WHERE ((m.id = memory_comments.memory_id) AND is_room_member(m.room_id)))) AND (NOT has_blocked(author_id))));

create policy memory_comments_update on public.memory_comments as permissive for update to authenticated
  using ((author_id = ( SELECT auth.uid() AS uid)))
  with check ((author_id = ( SELECT auth.uid() AS uid)));

create policy memory_hides_delete on public.memory_hides as permissive for delete to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));

create policy memory_hides_insert on public.memory_hides as permissive for insert to authenticated
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM memories m
  WHERE ((m.id = memory_hides.memory_id) AND is_room_member(m.room_id))))));

create policy memory_hides_select on public.memory_hides as permissive for select to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));

create policy memory_likes_delete on public.memory_likes as permissive for delete to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));

create policy memory_likes_insert on public.memory_likes as permissive for insert to authenticated
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM memories m
  WHERE ((m.id = memory_likes.memory_id) AND is_room_member(m.room_id) AND (m.deleted_at IS NULL))))));

create policy memory_likes_select on public.memory_likes as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM memories m
  WHERE ((m.id = memory_likes.memory_id) AND is_room_member(m.room_id) AND (NOT has_blocked(m.author_id))))));

create policy memory_photos_delete on public.memory_photos as permissive for delete to authenticated
  using ((EXISTS ( SELECT 1
   FROM memories m
  WHERE ((m.id = memory_photos.memory_id) AND (m.author_id = ( SELECT auth.uid() AS uid))))));

create policy memory_photos_insert on public.memory_photos as permissive for insert to authenticated
  with check ((EXISTS ( SELECT 1
   FROM memories m
  WHERE ((m.id = memory_photos.memory_id) AND (m.author_id = ( SELECT auth.uid() AS uid)) AND is_room_member(m.room_id)))));

create policy memory_photos_select on public.memory_photos as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM memories m
  WHERE ((m.id = memory_photos.memory_id) AND is_room_member(m.room_id) AND (NOT has_blocked(m.author_id))))));

create policy memory_saves_delete on public.memory_saves as permissive for delete to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));

create policy memory_saves_insert on public.memory_saves as permissive for insert to authenticated
  with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM memories m
  WHERE ((m.id = memory_saves.memory_id) AND is_room_member(m.room_id) AND (m.deleted_at IS NULL))))));

create policy memory_saves_select on public.memory_saves as permissive for select to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));

create policy notifications_select on public.notifications as permissive for select to public
  using ((recipient_id = ( SELECT auth.uid() AS uid)));

create policy notifications_update on public.notifications as permissive for update to public
  using ((recipient_id = ( SELECT auth.uid() AS uid)))
  with check ((recipient_id = ( SELECT auth.uid() AS uid)));

create policy push_subscriptions_delete on public.push_subscriptions as permissive for delete to public
  using ((user_id = ( SELECT auth.uid() AS uid)));

create policy push_subscriptions_insert on public.push_subscriptions as permissive for insert to public
  with check ((user_id = ( SELECT auth.uid() AS uid)));

create policy push_subscriptions_select on public.push_subscriptions as permissive for select to public
  using ((user_id = ( SELECT auth.uid() AS uid)));

create policy push_subscriptions_update on public.push_subscriptions as permissive for update to public
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check ((user_id = ( SELECT auth.uid() AS uid)));

create policy reports_insert on public.reports as permissive for insert to authenticated
  with check ((reporter_id = ( SELECT auth.uid() AS uid)));

create policy reports_select on public.reports as permissive for select to authenticated
  using ((reporter_id = ( SELECT auth.uid() AS uid)));

create policy room_members_insert on public.room_members as permissive for insert to authenticated
  with check (((user_id = ( SELECT auth.uid() AS uid)) OR is_room_admin(room_id)));

create policy room_members_select on public.room_members as permissive for select to authenticated
  using (((user_id = ( SELECT auth.uid() AS uid)) OR is_room_member(room_id)));

create policy room_members_update on public.room_members as permissive for update to authenticated
  using (((user_id = ( SELECT auth.uid() AS uid)) OR is_room_admin(room_id)))
  with check (((user_id = ( SELECT auth.uid() AS uid)) OR is_room_admin(room_id)));

create policy rooms_delete on public.rooms as permissive for delete to authenticated
  using ((owner_id = ( SELECT auth.uid() AS uid)));

create policy rooms_insert on public.rooms as permissive for insert to authenticated
  with check ((owner_id = ( SELECT auth.uid() AS uid)));

create policy rooms_select on public.rooms as permissive for select to authenticated
  using (((owner_id = ( SELECT auth.uid() AS uid)) OR is_room_member(id)));

create policy rooms_update on public.rooms as permissive for update to authenticated
  using (is_room_admin(id))
  with check (is_room_admin(id));

create policy users_delete on public.users as permissive for delete to authenticated
  using ((id = ( SELECT auth.uid() AS uid)));

create policy users_insert on public.users as permissive for insert to authenticated
  with check ((id = ( SELECT auth.uid() AS uid)));

create policy users_select on public.users as permissive for select to authenticated
  using (((id = ( SELECT auth.uid() AS uid)) OR shares_room_with(id)));

create policy users_update on public.users as permissive for update to authenticated
  using ((id = ( SELECT auth.uid() AS uid)))
  with check ((id = ( SELECT auth.uid() AS uid)));

create policy withdrawal_reasons_insert on public.withdrawal_reasons as permissive for insert to authenticated
  with check (true);
