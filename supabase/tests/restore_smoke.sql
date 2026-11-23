-- Run after schema_smoke.sql and migration, as authenticated user one.
\set ON_ERROR_STOP on
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select public.restore_planner_backup($backup$
{
  "format": "planner-da-bre-v2",
  "version": 1,
  "data": {
    "study_settings": [],
    "subjects": [{"id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","user_id":"22222222-2222-4222-8222-222222222222","name":"Restored subject","priority":"medium","sort_order":0,"created_at":"2026-11-23T00:00:00Z","updated_at":"2026-11-23T00:00:00Z"}],
    "topics": [{"id":"ffffffff-ffff-4fff-8fff-ffffffffffff","user_id":"22222222-2222-4222-8222-222222222222","subject_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","name":"Restored topic","status":"not_started","annotations":"","checklist":{"theory":false,"law":false,"questions":false,"errors":false,"revision":false},"sort_order":0,"created_at":"2026-11-23T00:00:00Z","updated_at":"2026-11-23T00:00:00Z"}],
    "study_plans": [],
    "study_sessions": [{"id":"abababab-abab-4bab-8bab-abababababab","user_id":"22222222-2222-4222-8222-222222222222","subject_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","topic_id":"ffffffff-ffff-4fff-8fff-ffffffffffff","duration_minutes":25,"studied_on":"2026-11-23","notes":"","created_at":"2026-11-23T00:00:00Z"}],
    "question_attempts": [],
    "revisions": [],
    "study_plan_items": [],
    "mock_exams": [],
    "error_notebook": [],
    "jurisprudence_entries": []
  }
}
$backup$::jsonb);

do $test$
begin
  if not exists (select 1 from public.subjects where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' and user_id = auth.uid()) then
    raise exception 'Restore did not reassign imported subject to the authenticated user';
  end if;
  if not exists (select 1 from public.topics where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff' and user_id = auth.uid()) then
    raise exception 'Restore did not preserve the topic relationship';
  end if;
  if not exists (select 1 from public.study_sessions where id = 'abababab-abab-4bab-8bab-abababababab' and user_id = auth.uid()) then
    raise exception 'Restore did not preserve the study session';
  end if;
end
$test$;

-- Reimporting the same IDs is additive and idempotent.
do $test$
declare
  inserted bigint;
begin
  select r.inserted_rows into inserted
  from public.restore_planner_backup($backup$
  {
    "format":"planner-da-bre-v2","version":1,
    "data":{
      "study_settings":[],
      "subjects":[{"id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","user_id":"22222222-2222-4222-8222-222222222222","name":"Restored subject","priority":"medium","sort_order":0,"created_at":"2026-11-23T00:00:00Z","updated_at":"2026-11-23T00:00:00Z"}],
      "topics":[],"study_plans":[],"study_sessions":[],"question_attempts":[],
      "revisions":[],"study_plan_items":[],"mock_exams":[],"error_notebook":[],"jurisprudence_entries":[]
    }
  }
  $backup$::jsonb) r;
  if inserted <> 0 then
    raise exception 'Repeated restore should not insert duplicate IDs';
  end if;
end
$test$;

-- A broken relationship must roll back the entire restore call.
do $test$
begin
  begin
    perform * from public.restore_planner_backup($backup$
    {
      "format":"planner-da-bre-v2","version":1,
      "data":{
        "study_settings":[],
        "subjects":[{"id":"abababab-1111-4111-8111-111111111111","user_id":"22222222-2222-4222-8222-222222222222","name":"Must roll back","priority":"medium","sort_order":0,"created_at":"2026-11-23T00:00:00Z","updated_at":"2026-11-23T00:00:00Z"}],
        "topics":[{"id":"abababab-2222-4222-8222-222222222222","user_id":"22222222-2222-4222-8222-222222222222","subject_id":"abababab-3333-4333-8333-333333333333","name":"Broken topic"}],
        "study_plans":[],"study_sessions":[],"question_attempts":[],"revisions":[],
        "study_plan_items":[],"mock_exams":[],"error_notebook":[],"jurisprudence_entries":[]
      }
    }
    $backup$::jsonb);
    raise exception 'Invalid relationship was unexpectedly accepted';
  exception when foreign_key_violation then
    null;
  end;
  if exists (select 1 from public.subjects where id = 'abababab-1111-4111-8111-111111111111') then
    raise exception 'Restore failure did not roll back earlier inserts';
  end if;
end
$test$;

reset role;
