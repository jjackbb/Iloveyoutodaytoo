-- 예약 작업(pg_cron). 03_functions.sql 뒤에 돌린다.
-- 2026-09-06 적용. 이 파일이 곧 마이그레이션이다 — DB에 넣기 전에 여기 먼저 적는다.

-- 보호자 인증 행 24시간 정리 (개인정보 최소보관)
-- 가입을 끝내지 않고 버려진 행에도 보호자 전화번호가 남는다.
-- guardian_verifications 테이블 주석에 적어둔 숙제를 여기서 이행한다.

create extension if not exists pg_cron;

-- 지우는 규칙을 함수로 둔다. 크론 정의에 SQL을 박아두면 나중에 규칙만 고치기 어렵다.
create or replace function public.purge_guardian_verifications()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_deleted integer;
begin
  -- created_at 기준이다. verified_at/consumed_at 이 아니라 **행이 생긴 시각**이라야
  -- 인증을 시도만 하고 버려진 행까지 함께 지워진다.
  delete from public.guardian_verifications
   where created_at < now() - interval '24 hours';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

-- 아무도 직접 부를 수 없게 한다. 크론(postgres 역할)만 돈다.
revoke all on function public.purge_guardian_verifications() from public, anon, authenticated;

-- 매일 03:00 KST (18:00 UTC). 같은 이름의 작업이 있으면 먼저 걷어낸다.
select cron.unschedule('purge-guardian-verifications')
 where exists (select 1 from cron.job where jobname = 'purge-guardian-verifications');

select cron.schedule(
  'purge-guardian-verifications',
  '0 18 * * *',
  $cron$select public.purge_guardian_verifications();$cron$
);

-- 검증(2026-09-06): 25시간 전 행과 1시간 전 행을 넣고 돌렸더니
-- 25시간 전 것만 지워지고 1시간 전 것은 남았다. 시험용 행은 치웠다.
