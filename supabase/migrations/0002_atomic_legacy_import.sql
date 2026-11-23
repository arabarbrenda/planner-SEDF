-- Atomic V1 legacy import. The client sends normalized arrays; ownership and
-- legacy-ID mapping are enforced here. A failed import rolls back every data row.
create or replace function public.import_legacy_v1_backup(
  p_fingerprint text,
  p_original_file_name text,
  p_backup jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $legacy$
declare
  v_user_id uuid := auth.uid();
  v_job_id uuid;
  v_item jsonb;
  v_subject_id uuid;
  v_topic_id uuid;
  v_legacy_id text;
  v_subject_map jsonb := '{}'::jsonb;
  v_topic_map jsonb := '{}'::jsonb;
  v_rows integer := 0;
  v_total integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid backup fingerprint';
  end if;
  if jsonb_typeof(p_backup) <> 'object' then
    raise exception 'Invalid normalized V1 backup';
  end if;
  if jsonb_typeof(p_backup -> 'subjects') is distinct from 'array'
     or jsonb_typeof(p_backup -> 'topics') is distinct from 'array'
     or jsonb_typeof(p_backup -> 'sessions') is distinct from 'array'
     or jsonb_typeof(p_backup -> 'question_attempts') is distinct from 'array'
     or jsonb_typeof(p_backup -> 'mock_exams') is distinct from 'array'
     or jsonb_typeof(p_backup -> 'jurisprudence') is distinct from 'array' then
    raise exception 'Invalid normalized V1 backup sections';
  end if;

  insert into public.import_jobs (
    user_id, source, file_name, status, rows_imported, error_details
  ) values (
    v_user_id, 'v1_backup', p_fingerprint, 'pending', 0,
    jsonb_build_object('original_file_name', coalesce(p_original_file_name, 'backup.json'))
  )
  on conflict (user_id, source, file_name) where file_name is not null
  do update set
    status = 'pending',
    rows_imported = 0,
    error_details = jsonb_build_object('original_file_name', coalesce(p_original_file_name, 'backup.json')),
    completed_at = null
  where public.import_jobs.status = 'failed'
  returning id into v_job_id;

  if v_job_id is null then
    raise exception 'Este backup já foi importado ou há uma tentativa em andamento.';
  end if;

  begin
    for v_item in select value from jsonb_array_elements(p_backup -> 'subjects')
    loop
      if jsonb_typeof(v_item) <> 'object' or nullif(btrim(v_item ->> 'name'), '') is null then
        raise exception 'Invalid legacy subject';
      end if;
      insert into public.subjects(user_id, name, icon, priority, sort_order)
      values (
        v_user_id, btrim(v_item ->> 'name'), nullif(v_item ->> 'icon', ''),
        case when v_item ->> 'priority' in ('low','high') then v_item ->> 'priority' else 'medium' end,
        coalesce(nullif(v_item ->> 'sort_order','')::integer, 0)
      ) returning id into v_subject_id;
      v_legacy_id := nullif(v_item ->> 'legacy_id', '');
      if v_legacy_id is not null then
        if v_subject_map ? v_legacy_id then raise exception 'Duplicate legacy subject ID'; end if;
        v_subject_map := v_subject_map || jsonb_build_object(v_legacy_id, v_subject_id);
      end if;
      v_rows := v_rows + 1;
    end loop;

    for v_item in select value from jsonb_array_elements(p_backup -> 'topics')
    loop
      v_legacy_id := nullif(v_item ->> 'subject_legacy_id', '');
      if v_legacy_id is null or not (v_subject_map ? v_legacy_id) then
        raise exception 'Legacy topic references an unknown subject';
      end if;
      v_subject_id := (v_subject_map ->> v_legacy_id)::uuid;
      if nullif(btrim(v_item ->> 'name'), '') is null then raise exception 'Invalid legacy topic'; end if;
      insert into public.topics(user_id, subject_id, name, status, annotations, checklist, sort_order)
      values (
        v_user_id, v_subject_id, btrim(v_item ->> 'name'),
        case when v_item ->> 'status' in ('in_progress','review','completed') then v_item ->> 'status' else 'not_started' end,
        coalesce(v_item ->> 'annotations',''),
        coalesce(v_item -> 'checklist', '{"theory":false,"law":false,"questions":false,"errors":false,"revision":false}'::jsonb),
        coalesce(nullif(v_item ->> 'sort_order','')::integer, 0)
      ) returning id into v_topic_id;
      v_legacy_id := nullif(v_item ->> 'legacy_id', '');
      if v_legacy_id is not null then
        if v_topic_map ? v_legacy_id then raise exception 'Duplicate legacy topic ID'; end if;
        v_topic_map := v_topic_map || jsonb_build_object(v_legacy_id, v_topic_id);
      end if;
      v_rows := v_rows + 1;
    end loop;

    for v_item in select value from jsonb_array_elements(p_backup -> 'sessions')
    loop
      v_legacy_id := nullif(v_item ->> 'subject_legacy_id', '');
      v_subject_id := case when v_legacy_id is null then null
        when v_subject_map ? v_legacy_id then (v_subject_map ->> v_legacy_id)::uuid
        else null end;
      if v_legacy_id is not null and v_subject_id is null then raise exception 'Legacy session references an unknown subject'; end if;
      insert into public.study_sessions(user_id, subject_id, studied_on, duration_minutes, platform, notes)
      values (
        v_user_id, v_subject_id, (v_item ->> 'studied_on')::date,
        (v_item ->> 'duration_minutes')::integer, nullif(v_item ->> 'platform',''),
        coalesce(v_item ->> 'notes','')
      );
      v_rows := v_rows + 1;
    end loop;

    for v_item in select value from jsonb_array_elements(p_backup -> 'question_attempts')
    loop
      v_legacy_id := nullif(v_item ->> 'subject_legacy_id', '');
      v_subject_id := case when v_legacy_id is null then null
        when v_subject_map ? v_legacy_id then (v_subject_map ->> v_legacy_id)::uuid
        else null end;
      if v_legacy_id is not null and v_subject_id is null then raise exception 'Legacy question batch references an unknown subject'; end if;
      v_legacy_id := nullif(v_item ->> 'topic_legacy_id', '');
      v_topic_id := case when v_legacy_id is null then null
        when v_topic_map ? v_legacy_id then (v_topic_map ->> v_legacy_id)::uuid
        else null end;
      if v_legacy_id is not null and v_topic_id is null then raise exception 'Legacy question batch references an unknown topic'; end if;
      insert into public.question_attempts(
        user_id, subject_id, topic_id, source, total_questions, correct_answers,
        incorrect_answers, blank_answers, notes
      ) values (
        v_user_id, v_subject_id, v_topic_id, 'other',
        (v_item ->> 'total_questions')::integer, (v_item ->> 'correct_answers')::integer,
        greatest(0, (v_item ->> 'total_questions')::integer - (v_item ->> 'correct_answers')::integer),
        0, coalesce(v_item ->> 'notes','Importado dos totais acumulados da V1.')
      );
      v_rows := v_rows + 1;
    end loop;

    for v_item in select value from jsonb_array_elements(p_backup -> 'mock_exams')
    loop
      insert into public.mock_exams(
        user_id, title, exam_date, examining_board, total_questions, correct_answers,
        incorrect_answers, blank_answers, duration_minutes, notes
      ) values (
        v_user_id, btrim(v_item ->> 'title'), (v_item ->> 'exam_date')::date,
        nullif(v_item ->> 'examining_board',''), (v_item ->> 'total_questions')::integer,
        (v_item ->> 'correct_answers')::integer,
        (v_item ->> 'incorrect_answers')::integer, 0,
        nullif(v_item ->> 'duration_minutes','')::integer, coalesce(v_item ->> 'notes','')
      );
      v_rows := v_rows + 1;
    end loop;

    for v_item in select value from jsonb_array_elements(p_backup -> 'jurisprudence')
    loop
      insert into public.jurisprudence_entries(
        user_id, title, court, case_reference, judgment_date, summary, source_url, tags
      ) values (
        v_user_id, btrim(v_item ->> 'title'), nullif(v_item ->> 'court',''),
        nullif(v_item ->> 'case_reference',''), nullif(v_item ->> 'judgment_date','')::date,
        coalesce(v_item ->> 'summary',''), nullif(v_item ->> 'source_url',''),
        coalesce(array(select jsonb_array_elements_text(coalesce(v_item -> 'tags','[]'::jsonb))), '{}'::text[])
      );
      v_rows := v_rows + 1;
    end loop;

    update public.import_jobs
    set status = 'completed', rows_imported = v_rows,
        error_details = jsonb_build_object('original_file_name', coalesce(p_original_file_name, 'backup.json')),
        completed_at = now()
    where id = v_job_id and user_id = v_user_id;

    return jsonb_build_object('success', true, 'rows_imported', v_rows, 'job_id', v_job_id);
  exception when others then
    get stacked diagnostics v_legacy_id = message_text;
    update public.import_jobs
    set status = 'failed', rows_imported = 0,
        error_details = jsonb_build_object(
          'original_file_name', coalesce(p_original_file_name, 'backup.json'),
          'message', v_legacy_id
        ),
        completed_at = now()
    where id = v_job_id and user_id = v_user_id;
    return jsonb_build_object('success', false, 'rows_imported', 0, 'job_id', v_job_id, 'error', v_legacy_id);
  end;
end;
$legacy$;

revoke all on function public.import_legacy_v1_backup(text, text, jsonb) from public, anon;
grant execute on function public.import_legacy_v1_backup(text, text, jsonb) to authenticated;
