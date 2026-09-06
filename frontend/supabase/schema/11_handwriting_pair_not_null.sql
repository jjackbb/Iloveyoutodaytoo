-- 2026-09-07 적용. 09 뒤에 돌린다.
--
-- 손글씨 쌍 제약(memories_handwriting_pair)의 NULL 구멍을 막는다.
-- 09 의 제약은 duration 이 NULL 이면 `NULL >= 0` 이 NULL 이 되어 CHECK 가 **통과**했다 —
-- 경로만 있고 길이가 없는 행이 들어갈 수 있었다(검증 중 SQL 로 실제로 들어가는 것을 봤다).
-- 앱은 그런 값을 보내지 않지만, DB 가 말하게 두는 것이 이 프로젝트의 규칙이다.
--
-- ⚠️ 목소리 쪽 memories_voice_pair 도 같은 모양(voice_duration_sec >= 3)이라 같은 구멍이 있다.
--    그건 원래 있던 제약이라 여기서 손대지 않았다 — 따로 결정할 것.

alter table public.memories drop constraint memories_handwriting_pair;
alter table public.memories add constraint memories_handwriting_pair check (
  (handwriting_path is null and handwriting_duration_ms is null)
  or (handwriting_path is not null
      and handwriting_duration_ms is not null
      and handwriting_duration_ms >= 0 and handwriting_duration_ms <= 600000)
);
