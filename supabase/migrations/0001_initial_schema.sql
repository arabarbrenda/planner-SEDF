-- Planner da Bre V2
-- Migration 0001: initial relational schema and row-level security.
-- Apply in Supabase SQL Editor or via Supabase CLI after reviewing.
-- No production data is modified by this migration.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.study_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  exam_title text not null default 'SEDF',
  exam_date date,
  plan_start_date date,
  daily_goal_minutes integer check (daily_goal_minutes is null or daily_goal_minutes >= 0),
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  icon text,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists subjects_user_sort_idx on public.subjects(user_id, sort_order);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null,
  parent_topic_id uuid,
  name text not null,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','review','completed')),
  priority text check (priority in ('low','medium','high')),
  annotations text not null default '',
  checklist jsonb not null default '{"theory":false,"law":false,"questions":false,"errors":false,"revision":false}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (subject_id, user_id) references public.subjects(id, user_id) on delete cascade,
  foreign key (parent_topic_id, user_id) references public.topics(id, user_id) on delete cascade
);
create index if not exists topics_user_subject_sort_idx on public.topics(user_id, subject_id, sort_order);

-- Study time is recorded separately from question performance.
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid,
  topic_id uuid,
  studied_on date not null default current_date,
  duration_minutes integer not null check (duration_minutes > 0),
  platform text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects(id, user_id) on delete set null (subject_id),
  foreign key (topic_id, user_id) references public.topics(id, user_id) on delete set null (topic_id)
);
create index if not exists study_sessions_user_date_idx on public.study_sessions(user_id, studied_on desc);

-- One row can represent a batch of questions (manual entry or imported report).
-- Analytics must use this table as the single source of question totals.
create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid,
  topic_id uuid,
  attempted_on date not null default current_date,
  platform text,
  source text not null default 'manual' check (source in ('manual','tec_import','mock_exam','other')),
  total_questions integer not null check (total_questions >= 0),
  correct_answers integer not null check (correct_answers >= 0),
  incorrect_answers integer not null default 0 check (incorrect_answers >= 0),
  blank_answers integer not null default 0 check (blank_answers >= 0),
  notes text not null default '',
  external_reference text,
  created_at timestamptz not null default now(),
  check (correct_answers + incorrect_answers + blank_answers <= total_questions),
  foreign key (subject_id, user_id) references public.subjects(id, user_id) on delete set null (subject_id),
  foreign key (topic_id, user_id) references public.topics(id, user_id) on delete set null (topic_id)
);
create index if not exists question_attempts_user_date_idx on public.question_attempts(user_id, attempted_on desc);
create index if not exists question_attempts_user_topic_idx on public.question_attempts(user_id, topic_id);

create table if not exists public.revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null,
  scheduled_for date not null,
  completed_at timestamptz,
  revision_type text not null default 'standard',
  result text check (result in ('easy','medium','hard','again')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  foreign key (topic_id, user_id) references public.topics(id, user_id) on delete cascade
);
create index if not exists revisions_user_due_idx on public.revisions(user_id, scheduled_for) where completed_at is null;

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  is_active boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.study_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null,
  subject_id uuid,
  topic_id uuid,
  weekday smallint check (weekday between 0 and 6),
  start_time time,
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  sort_order integer not null default 0,
  notes text not null default '',
  foreign key (plan_id, user_id) references public.study_plans(id, user_id) on delete cascade,
  foreign key (subject_id, user_id) references public.subjects(id, user_id) on delete set null (subject_id),
  foreign key (topic_id, user_id) references public.topics(id, user_id) on delete set null (topic_id)
);
create index if not exists study_plan_items_plan_idx on public.study_plan_items(user_id, plan_id, weekday, sort_order);

create table if not exists public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  exam_date date not null default current_date,
  examining_board text,
  source text not null default 'manual' check (source in ('manual','tec_import','other')),
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  total_questions integer not null default 0 check (total_questions >= 0),
  correct_answers integer not null default 0 check (correct_answers >= 0),
  incorrect_answers integer not null default 0 check (incorrect_answers >= 0),
  blank_answers integer not null default 0 check (blank_answers >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  check (correct_answers + incorrect_answers + blank_answers <= total_questions)
);
create index if not exists mock_exams_user_date_idx on public.mock_exams(user_id, exam_date desc);

create table if not exists public.error_notebook (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid,
  topic_id uuid,
  question_reference text,
  question_text text not null default '',
  user_answer text,
  correct_answer text,
  explanation text not null default '',
  tags text[] not null default '{}',
  status text not null default 'open' check (status in ('open','reviewing','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects(id, user_id) on delete set null (subject_id),
  foreign key (topic_id, user_id) references public.topics(id, user_id) on delete set null (topic_id)
);

create table if not exists public.jurisprudence_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  court text,
  case_reference text,
  judgment_date date,
  summary text not null default '',
  source_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null,
  file_name text,
  status text not null default 'pending' check (status in ('pending','validated','completed','failed')),
  rows_imported integer not null default 0 check (rows_imported >= 0),
  error_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Enable row-level security and owner-only policies on every user-owned table.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles','study_settings','subjects','topics','study_sessions',
    'question_attempts','revisions','study_plans','study_plan_items',
    'mock_exams','error_notebook','jurisprudence_entries','import_jobs'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "study_settings_owner_all" on public.study_settings;
create policy "study_settings_owner_all" on public.study_settings for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'subjects','topics','study_sessions','question_attempts','revisions',
    'study_plans','study_plan_items','mock_exams','error_notebook',
    'jurisprudence_entries','import_jobs'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      table_name || '_owner_all', table_name
    );
  end loop;
end $$;

-- updated_at triggers
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles','study_settings','subjects','topics','study_plans',
    'error_notebook','jurisprudence_entries'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute procedure public.set_updated_at()',
      table_name
    );
  end loop;
end $$;
