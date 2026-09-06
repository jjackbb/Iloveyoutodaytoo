-- 트리거 10개. 03_functions.sql 을 먼저 돌려야 한다.

CREATE TRIGGER heart_messages_notify AFTER INSERT ON public.heart_messages FOR EACH ROW EXECUTE FUNCTION notify_receiver_of_heart();
CREATE TRIGGER heart_messages_unlock_on_reply AFTER INSERT ON public.heart_messages FOR EACH ROW EXECUTE FUNCTION unlock_on_reply();
CREATE TRIGGER trg_touch_streak AFTER INSERT ON public.heart_messages FOR EACH ROW EXECUTE FUNCTION touch_streak();
CREATE TRIGGER memories_notify AFTER INSERT ON public.memories FOR EACH ROW EXECUTE FUNCTION notify_room_members_of_memory();
CREATE TRIGGER memory_comments_notify AFTER INSERT ON public.memory_comments FOR EACH ROW EXECUTE FUNCTION notify_author_of_comment();
CREATE TRIGGER room_members_guard_role BEFORE UPDATE ON public.room_members FOR EACH ROW EXECUTE FUNCTION room_members_guard_role();
CREATE TRIGGER room_members_notify AFTER INSERT ON public.room_members FOR EACH ROW EXECUTE FUNCTION notify_room_of_new_member();
CREATE TRIGGER trg_create_streak AFTER INSERT ON public.room_members FOR EACH ROW EXECUTE FUNCTION create_streak_for_member();
CREATE TRIGGER trg_room_owner_member AFTER INSERT ON public.rooms FOR EACH ROW EXECUTE FUNCTION add_owner_as_member();
CREATE TRIGGER trg_guardian_consent BEFORE INSERT OR UPDATE OF birth_date, guardian_consented_at ON public.users FOR EACH ROW EXECUTE FUNCTION enforce_guardian_consent();

-- auth 스키마에 붙어 있는 트리거. public 만 훑으면 안 잡히지만,
-- 이게 없으면 가입해도 public.users 행이 안 생긴다 — 반드시 함께 복원할 것.
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
