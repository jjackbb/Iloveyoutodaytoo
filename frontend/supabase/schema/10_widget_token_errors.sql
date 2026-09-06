-- 2026-09-06 적용. 09 뒤에 돌린다.
--
-- 무효 토큰은 "빈 결과"가 아니라 오류(SQLSTATE 28000)로 알린다.
-- 전에는 widget_latest 가 무효 토큰과 "표현 없음"을 둘 다 빈 배열로 돌려줘서,
-- 위젯이 죽은 토큰(로그아웃·탈퇴)인데도 "아직 아무도 안 남겼어요"를 보여줄 판이었다.
-- 이 함수는 widget_latest · widget_knock 이 맨 처음 부르므로 여기서 던지면 둘 다 막힌다.
-- API 라우트(/api/widget/*)는 28000 을 HTTP 401 로 옮기고, 위젯은 "앱에서 로그인해 주세요"를 띄운다.

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

  if v_uid is null then
    raise exception '위젯 토큰이 유효하지 않습니다.' using errcode = '28000';
  end if;
  return v_uid;
end;
$function$;
revoke all on function public.widget_user_from_token(text) from public, anon, authenticated;
