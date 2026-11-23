# Planner da Bre V2 — Architecture

## Product decisions
- Full visual redesign; preserve the V1 deployment and data until V2 is reviewed.
- Cloud-first persistence with Supabase (PostgreSQL + Auth).
- Authentication: Google OAuth and email/password.
- Initial product is optimized for Brenda's personal study workflow, while every row is scoped to an authenticated user for safe future multi-user support.
- Frontend direction: React + TypeScript; modular components, pages, domain services and typed data access.

## Existing V1 facts inspected
- V1 is a single HTML file with embedded CSS/JavaScript.
- It persists a JSON object in localStorage under `sga_sedf_2027_data` (fallback `sedf_2027_db`).
- Main collections include `materias`, nested `topicos`, `registrosEstudo`, `simulados` and `jurisprudencia`.
- Topic records currently store `questoesTotal` and `questoesAcertos`; study session records separately store `qTotal` and `qAcertos`. V2 must not sum both sources.
- Study sessions currently include `materiaId`, `data`, `plataforma`, `tempo`, `qTotal`, `qAcertos` and `obs`.
- The Tec Concursos import handler currently inserts a hard-coded simulated exam record. It is not a real parser.
- Google Calendar export currently uses fixed dates/times rather than the editable study cycle.
- V1 backup exports JSON but has no matching import/recovery flow.

## V2 domain model
- `profiles`: one row per Supabase Auth user.
- `study_settings`: exam and personal planning settings.
- `subjects` and `topics`: syllabus hierarchy, topic status, priority, annotations and checklist.
- `study_sessions`: time spent studying; never the source of question totals.
- `question_attempts`: the single source of truth for answered-question totals and accuracy. A row may represent a batch, allowing manual entry and imported aggregates.
- `revisions`: scheduled/completed revision events with outcome.
- `study_plans` and `study_plan_items`: editable cycles and calendar slots.
- `mock_exams`: mock exam metadata and aggregate results.
- `error_notebook`: mistakes, explanations, tags and resolution state.
- `jurisprudence_entries`: saved case law and notes.
- `import_jobs`: import audit trail and validation results.

## Analytics rules
1. Study hours come only from `study_sessions.duration_minutes`; the dashboard uses the `get_study_summary()` SQL function to aggregate in the database without client pagination limits.
2. Question totals and accuracy come only from `question_attempts`.
3. Mock-exam analytics are reported separately unless an explicit analytics query intentionally includes them; do not silently duplicate mock-exam questions into question attempts.
4. A topic with zero attempts has unknown accuracy, not 100%.
5. Progress is calculated from topic status, not question counts.

## Security
- Supabase Auth identifies the user.
- Every user-owned row includes `user_id`.
- Row Level Security is enabled on all user-owned tables.
- Initial policies allow authenticated users to access only rows where `user_id = auth.uid()`; profiles are readable/updatable only by their owner. The dashboard aggregate function runs as SECURITY INVOKER so underlying table RLS remains effective.
- Never put a service-role key or database password in frontend code or Git.
- The Supabase publishable key is designed for client use, but only alongside correctly configured RLS.

## Migration and rollout
1. Keep V1 and its GitHub Pages deployment unchanged.
2. Build V2 only on `feature/planner-bre-v2`.
3. Export a V1 JSON backup before any data migration.
4. Validate and normalize the JSON in a dry run; preserve legacy IDs in migration metadata where useful.
5. Import subjects/topics first, then sessions, mock exams and jurisprudence, then question-attempt history where its provenance can be identified.
6. Do not fabricate question-attempt history from ambiguous legacy counters. Preserve uncertain legacy aggregates as migration notes until the user confirms the intended interpretation.
7. Verify row counts and sample records before enabling V2 as the daily planner.

## Implementation status

### Implemented on `feature/planner-bre-v2`
- React 18 + TypeScript + Vite application shell and responsive visual system.
- Supabase client, email/password authentication, Google OAuth entry point and password-recovery flow.
- Typed data services and study dashboard, including subjects, topics, sessions, question batches, revisions and weekly planning.
- Mock exams with validation and chronological performance trend.
- Error notebook and jurisprudence records with search, filters and editing.
- V1 JSON import preview and additive migration through `import_legacy_v1_backup`. The server validates normalized sections, rebuilds subject/topic relationships from legacy IDs, records an import audit row, and writes all imported records in one transaction. A failed data write rolls back all imported rows while preserving a failed audit record; retrying that fingerprint is allowed after failure, while a completed fingerprint is rejected. The import remains additive and does not replace existing V2 records.
- V1 migration intentionally imports topic-level accumulated question totals as question-attempt batches; session-level `qTotal`/`qAcertos` are not imported to avoid double counting. Legacy mock exams are imported with zero blank answers because V1 did not store that value separately. Planning/cycle, visual theme, settings and attachments are not imported.
- V2 JSON backup export, paginated in batches of 500, and transactional restore through the `restore_planner_backup` RPC.
- Automated frontend/service tests and CI checks using a temporary PostgreSQL 15 environment with minimal Supabase-compatible objects.

### Remaining before a production decision
- Run the documented authentication, RLS, export and restore checklist in a separate Supabase development project. This has not been done against the hosted project.
- Inspect an anonymized Tec Concursos export before implementing a real parser.
- Implement Google Calendar export from saved plan items, honoring the local timezone.
- Review dependency audit findings and update dependencies deliberately; do not apply force upgrades without compatibility review.
- Consider whether export needs a consistent database snapshot if writes can occur during a backup. Current export paginates each table independently; it is not a cross-table transactional snapshot.
- Complete manual accessibility and responsive-browser review.

## Production gate
- The new import migration and atomic import smoke test pass in CI's temporary PostgreSQL 15 environment. This is not a hosted Supabase validation.
- No hosted migration has been applied, no personal data has been imported, and no production authentication/RLS/runtime test has been performed.
- Validate V2 in a separate, disposable Supabase development project using `docs/SUPABASE_DEV_VALIDATION.md`.
- Verify row counts, representative records, authentication and RLS with at least two test accounts.
- Obtain explicit approval before applying migrations to the hosted project, importing personal data, merging branches or deploying V2.
