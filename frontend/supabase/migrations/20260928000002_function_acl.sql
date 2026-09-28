-- E22: 로그인한 이용자에게만 필요한 SECURITY DEFINER 함수의 익명 실행 권한 제거.
-- 기본 PUBLIC EXECUTE를 먼저 거둬야 anon에게서만 REVOKE 해도 남는 상속 권한을 막는다.
-- RLS와 앱 서버는 authenticated 권한으로 이 함수들을 호출한다.

revoke execute on function public.accept_invitation(text, text) from public, anon;
revoke execute on function public.can_read_memory(uuid) from public, anon;
revoke execute on function public.can_read_storage_object(text, text) from public, anon;
revoke execute on function public.has_blocked(uuid) from public, anon;
revoke execute on function public.is_room_admin(uuid) from public, anon;
revoke execute on function public.is_room_member(uuid) from public, anon;
revoke execute on function public.issue_widget_token() from public, anon;
revoke execute on function public.mark_heart_read(uuid) from public, anon;
revoke execute on function public.owns_room_member(uuid) from public, anon;
revoke execute on function public.pin_memory(uuid, boolean) from public, anon;
revoke execute on function public.prune_push_subscription(text) from public, anon;
revoke execute on function public.push_targets_for_user(uuid) from public, anon;
revoke execute on function public.revoke_widget_tokens() from public, anon;
revoke execute on function public.shares_room_with(uuid) from public, anon;
revoke execute on function public.storage_object_pending_deletion(text, text) from public, anon;

grant execute on function public.accept_invitation(text, text) to authenticated, service_role;
grant execute on function public.can_read_memory(uuid) to authenticated, service_role;
grant execute on function public.can_read_storage_object(text, text) to authenticated, service_role;
grant execute on function public.has_blocked(uuid) to authenticated, service_role;
grant execute on function public.is_room_admin(uuid) to authenticated, service_role;
grant execute on function public.is_room_member(uuid) to authenticated, service_role;
grant execute on function public.issue_widget_token() to authenticated, service_role;
grant execute on function public.mark_heart_read(uuid) to authenticated, service_role;
grant execute on function public.owns_room_member(uuid) to authenticated, service_role;
grant execute on function public.pin_memory(uuid, boolean) to authenticated, service_role;
grant execute on function public.prune_push_subscription(text) to authenticated, service_role;
grant execute on function public.push_targets_for_user(uuid) to authenticated, service_role;
grant execute on function public.revoke_widget_tokens() to authenticated, service_role;
grant execute on function public.shares_room_with(uuid) to authenticated, service_role;
grant execute on function public.storage_object_pending_deletion(text, text) to authenticated, service_role;

-- preview_invitation, username_taken, widget_latest, widget_knock는 공개 초대·아이디
-- 확인·토큰 위젯 기능이므로 이 변경문에서 익명 실행 권한을 유지한다.
