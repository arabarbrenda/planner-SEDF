-- Run as postgres, then switch to the authenticated role for all assertions.
\set ON_ERROR_STOP on

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

-- A user must not insert a row owned by another user.
do $test$
begin
  begin
    insert into public.subjects (user_id, name)
    values ('11111111-1111-4111-8111-111111111111', 'forbidden cross-user insert');
    raise exception 'RLS unexpectedly allowed cross-user insert';
  exception
    when insufficient_privilege then
      null;
  end;
end
$test$;

-- The same authenticated role can insert a row for its own identity.
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
insert into public.subjects (user_id, name)
values (auth.uid(), 'RLS visible subject');

do $test$
declare
  summary record;
begin
  if (select count(*) from public.subjects) <> 2 then
    raise exception 'Owner should see exactly its two subjects';
  end if;
  select * into summary from public.get_study_summary();
  if summary.subject_count <> 2
    or summary.study_minutes <> 30
    or summary.total_questions <> 10
    or summary.correct_answers <> 7 then
    raise exception 'Owner aggregate summary leaked or returned unexpected values';
  end if;
end
$test$;

set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $test$
declare
  summary record;
begin
  if (select count(*) from public.subjects) <> 1 then
    raise exception 'Second user should see only its own subject';
  end if;
  select * into summary from public.get_study_summary();
  if summary.subject_count <> 1
    or summary.study_minutes <> 0
    or summary.total_questions <> 0
    or summary.correct_answers <> 0 then
    raise exception 'Second user aggregate summary leaked another owner data';
  end if;
end
$test$;

reset role;
