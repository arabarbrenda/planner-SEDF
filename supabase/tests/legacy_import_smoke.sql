-- Run after schema_smoke.sql and both migrations, as authenticated user one.
\set ON_ERROR_STOP on
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

-- A failure after the subject insert must roll back all data, while preserving
-- a failed job that can safely be retried with the same fingerprint.
select public.import_legacy_v1_backup(
  repeat('a',64), 'legacy.json',
  $backup$
  {
    "subjects":[{"legacy_id":"s1","name":"Should roll back","priority":"high"}],
    "topics":[],"sessions":[{"studied_on":"not-a-date","duration_minutes":30}],
    "question_attempts":[],"mock_exams":[],"jurisprudence":[]
  }
  $backup$::jsonb
);
do $test$
begin
  if exists (select 1 from public.subjects where name = 'Should roll back' and user_id = auth.uid()) then
    raise exception 'Failed legacy import left a partial subject behind';
  end if;
  if not exists (select 1 from public.import_jobs where user_id = auth.uid() and file_name = repeat('a',64) and status = 'failed') then
    raise exception 'Failed legacy import was not recorded';
  end if;
end
$test$;

-- Retrying the failed fingerprint succeeds and preserves relationships.
select public.import_legacy_v1_backup(
  repeat('a',64), 'legacy.json',
  $backup$
  {
    "subjects":[{"legacy_id":"s1","name":"Direito","priority":"high"}],
    "topics":[{"legacy_id":"t1","subject_legacy_id":"s1","name":"Constitucional","status":"in_progress","annotations":"Notas"}],
    "sessions":[{"subject_legacy_id":"s1","studied_on":"2026-11-23","duration_minutes":45,"platform":"Gran","notes":"Sessão"}],
    "question_attempts":[{"subject_legacy_id":"s1","topic_legacy_id":"t1","total_questions":10,"correct_answers":7}],
    "mock_exams":[{"title":"Simulado V1","exam_date":"2026-11-23","total_questions":10,"correct_answers":8,"incorrect_answers":2,"notes":"Importado"}],
    "jurisprudence":[{"title":"Tema repetitivo","court":"STJ","summary":"Tese","tags":["Direito"]}]
  }
  $backup$::jsonb
);

do $test$
declare
  v_subject uuid;
  v_topic uuid;
begin
  select id into v_subject from public.subjects where user_id = auth.uid() and name = 'Direito';
  select id into v_topic from public.topics where user_id = auth.uid() and subject_id = v_subject and name = 'Constitucional';
  if v_subject is null or v_topic is null then raise exception 'Legacy subject/topic mapping failed'; end if;
  if not exists (select 1 from public.study_sessions where user_id = auth.uid() and subject_id = v_subject and duration_minutes = 45) then
    raise exception 'Legacy session relationship failed';
  end if;
  if not exists (select 1 from public.question_attempts where user_id = auth.uid() and subject_id = v_subject and topic_id = v_topic and total_questions = 10 and correct_answers = 7) then
    raise exception 'Legacy question batch relationship failed';
  end if;
  if not exists (select 1 from public.mock_exams where user_id = auth.uid() and title = 'Simulado V1') then
    raise exception 'Legacy mock exam import failed';
  end if;
  if not exists (select 1 from public.jurisprudence_entries where user_id = auth.uid() and title = 'Tema repetitivo') then
    raise exception 'Legacy jurisprudence import failed';
  end if;
end
$test$;

-- A completed fingerprint cannot be imported a second time.
do $test$
begin
  begin
    perform public.import_legacy_v1_backup(
      repeat('a',64), 'legacy.json',
      '{"subjects":[],"topics":[],"sessions":[],"question_attempts":[],"mock_exams":[],"jurisprudence":[]}'::jsonb
    );
    raise exception 'Completed legacy backup was unexpectedly accepted twice';
  exception when raise_exception then
    if sqlerrm not like 'Este backup já foi importado%' then raise; end if;
  end;
end
$test$;

reset role;
