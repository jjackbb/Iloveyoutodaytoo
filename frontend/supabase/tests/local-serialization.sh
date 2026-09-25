#!/usr/bin/env bash
# 로컬 격리 DB에서 "저장 순간의 활성 참여자 수" 직렬화를 두 세션으로 검사한다.
#   실행: (frontend/) supabase db reset && bash supabase/tests/local-serialization.sh
# 원격 DB에는 돌리지 않는다 — 로컬 컨테이너(supabase_db_oneuldo-local)에만 붙는다.
set -u
DB=supabase_db_oneuldo-local
psql_run() { docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -At "$@"; }

A=aaaaaaaa-0000-0000-0000-00000000000a
B=bbbbbbbb-0000-0000-0000-00000000000b
C=cccccccc-0000-0000-0000-00000000000c
R1=11111111-0000-0000-0000-000000000001
R2=22222222-0000-0000-0000-000000000002
R3=33333333-0000-0000-0000-000000000003

psql_run >/dev/null <<SQL
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data)
values
 ('$A', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sa@id.oneuldo.local', '{"name":"SA","username":"sera","birth_date":"1990-01-01"}', '{"provider":"email"}'),
 ('$B', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sb@id.oneuldo.local', '{"name":"SB","username":"serb","birth_date":"1990-01-01"}', '{"provider":"email"}'),
 ('$C', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sc@id.oneuldo.local', '{"name":"SC","username":"serc","birth_date":"1990-01-01"}', '{"provider":"email"}');
insert into public.rooms (id, name, owner_id) values ('$R1', 'R1', '$A'), ('$R2', 'R2', '$A'), ('$R3', 'R3', '$A');
insert into public.invitations (room_id, inviter_id, relationship_label, invite_token, invite_message)
values ('$R1', '$A', '딸', 'ser-r1', 'x'), ('$R2', '$A', '딸', 'ser-r2', 'x');
-- R3 는 A+B 둘이서 시작한다(나가기 검사용)
insert into public.room_members (room_id, user_id, relationship_label) values ('$R3', '$B', '딸');
insert into storage.objects (bucket_id, name, owner_id) values
 ('video', '$R1/s1.mp4', '$A'), ('video', '$R2/s2.mp4', '$A'), ('video', '$R3/s3.mp4', '$A');
SQL

as_user() { # $1 = user id
  echo "set role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$1\",\"role\":\"authenticated\"}', false);"
}

fail=0
check() { # name actual expected
  if [ "$2" = "$3" ]; then echo "PASS  $1"; else echo "FAIL  $1 — 받음 $2 / 기대 $3"; fail=1; fi
}

# ① 초대 수락이 먼저 방을 잠그고 3초 버티는 동안 A가 저장 → 기다렸다가 room
( { as_user "$B"; echo "begin; select public.accept_invitation('ser-r1'); select pg_sleep(3); commit;"; } | psql_run >/dev/null ) &
sleep 1
start=$(date +%s)
{ as_user "$A"; echo "select public.create_memory('$R1', '동시1', '{}', p_video_path => '$R1/s1.mp4', p_video_duration_ms => 1000);"; } | psql_run >/dev/null
waited=$(( $(date +%s) - start ))
wait
check "직렬화①: 초대 수락 진행 중 저장은 기다림(≥1초)" "$([ $waited -ge 1 ] && echo yes || echo no)" "yes"
check "직렬화①: 수락이 먼저 끝났으므로 room" "$(psql_run -c "select visibility from public.memories where description='동시1'")" "room"

# ② 저장이 먼저 방을 잠그고 3초 버티는 동안 C가 수락 → 저장은 private 로 확정
( { as_user "$A"; echo "begin; select public.create_memory('$R2', '동시2', '{}', p_video_path => '$R2/s2.mp4', p_video_duration_ms => 1000); select pg_sleep(3); commit;"; } | psql_run >/dev/null ) &
sleep 1
{ as_user "$C"; echo "select public.accept_invitation('ser-r2');"; } | psql_run >/dev/null
wait
check "직렬화②: 저장이 먼저면 나중 입장과 무관하게 private" "$(psql_run -c "select visibility from public.memories where description='동시2'")" "private"
check "직렬화②: C는 그 뒤 활성 참여자" "$(psql_run -c "select status from public.room_members where room_id='$R2' and user_id='$C'")" "active"
check "직렬화②: C는 그 추억을 못 읽음" "$( { as_user "$C"; echo "select count(*) from public.memories where description='동시2';"; } | psql_run | tail -1)" "0"

# ③ B가 나가는 중(방 잠금)에 A가 저장 → 나가기가 먼저 끝나면 private
( { as_user "$B"; echo "begin; update public.room_members set status='left', left_at=now() where room_id='$R3' and user_id='$B'; select pg_sleep(3); commit;"; } | psql_run >/dev/null ) &
sleep 1
{ as_user "$A"; echo "select public.create_memory('$R3', '동시3', '{}', p_video_path => '$R3/s3.mp4', p_video_duration_ms => 1000);"; } | psql_run >/dev/null
wait
check "직렬화③: 나가기가 먼저 끝나면 다시 혼자 = private" "$(psql_run -c "select visibility from public.memories where description='동시3'")" "private"

exit $fail
