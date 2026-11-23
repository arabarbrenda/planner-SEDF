-- Minimal Supabase-compatible objects for isolated PostgreSQL CI tests.
-- This is a test fixture only; it does not connect to the hosted Supabase project.
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$roles$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create or replace function auth.uid()
returns uuid
language sql
stable
as $fn$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$fn$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
