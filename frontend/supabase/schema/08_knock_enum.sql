-- 2026-09-06 적용. 위젯 톡톡(WIDGET-01)의 알림 종류.
--
-- 왜 파일이 따로인가: Postgres 는 enum 에 값을 더한 **같은 트랜잭션 안에서 그 값을
-- 쓰지 못한다**("unsafe use of new value"). 뒤 파일(09)의 CHECK 제약이 'knock' 을
-- 쓰므로, 값 추가는 먼저 따로 커밋해야 한다. 순서를 바꾸면 09 가 통째로 실패한다.

alter type public.notification_type add value if not exists 'knock';
