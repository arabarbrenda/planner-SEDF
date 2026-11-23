-- Apply after bootstrap and the application migration, using the postgres superuser.
\set ON_ERROR_STOP on

insert into auth.users (id, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', '{"full_name":"Test User One"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', '{"full_name":"Test User Two"}'::jsonb)
on conflict (id) do nothing;

insert into public.subjects (id, user_id, name)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Direito')
on conflict (id) do nothing;

insert into public.subjects (id, user_id, name)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'Subject of user two')
on conflict (id) do nothing;

insert into public.topics (id, user_id, subject_id, name)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Constitucional')
on conflict (id) do nothing;

-- The composite foreign key must reject a topic whose subject belongs to another user.
do $test$
begin
  begin
    insert into public.topics (user_id, subject_id, name)
    values ('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Invalid cross-user topic');
    raise exception 'Cross-user subject reference was unexpectedly accepted';
  exception when foreign_key_violation then
    null;
  end;
end
$test$;

insert into public.study_plans (id, user_id, name, is_active)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', '11111111-1111-4111-8111-111111111111', 'Plan one', true);

-- The partial unique index must enforce one active plan per user.
do $test$
begin
  begin
    insert into public.study_plans (user_id, name, is_active)
    values ('11111111-1111-4111-8111-111111111111', 'Duplicate active plan', true);
    raise exception 'Duplicate active plan was unexpectedly accepted';
  exception when unique_violation then
    null;
  end;
end
$test$;

insert into public.study_sessions (user_id, subject_id, topic_id, duration_minutes)
values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 30);

insert into public.question_attempts (user_id, subject_id, topic_id, total_questions, correct_answers, incorrect_answers)
values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 10, 7, 3);

-- Deleting a topic should preserve the session and clear its topic reference.
delete from public.topics where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
do $test$
begin
  if not exists (
    select 1 from public.study_sessions
    where user_id = '11111111-1111-4111-8111-111111111111'
      and topic_id is null
      and subject_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) then
    raise exception 'Deleting a topic did not preserve the session as expected';
  end if;
end
$test$;
