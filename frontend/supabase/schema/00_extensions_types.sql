-- 확장
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;
create extension if not exists "uuid-ossp" with schema extensions;

-- 열거형(enum)
create type public.auth_provider as enum ('email', 'kakao', 'google', 'phone');
create type public.media_type as enum ('photo', 'video');
create type public.member_role as enum ('admin', 'member');
create type public.member_status as enum ('active', 'left');
create type public.message_type as enum ('text', 'voice', 'video');
create type public.notification_type as enum ('memory_created', 'comment_created', 'member_joined', 'heart_received');
create type public.relationship_type as enum ('family', 'lover', 'friend', 'self');
