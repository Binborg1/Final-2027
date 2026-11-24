# The Funza database

Everything about the database lives here: the current schema, every migration and the tests of its security rules. The tables are described in section 11 of [requirements and architecture](../../docs/03_design/02_requirements_and_architecture/requirements_and_architecture.md).

| Path | What it is |
|---|---|
| `schema.sql` | The whole `public` schema as it stands after every migration: tables, constraints, triggers, functions, grants and row-level security policies. Generated; read it to see the database at a glance, never edit it. |
| `supabase/migrations/` | Every change to the schema, in order, one `.sql` file each. Each file is named by the version Supabase recorded when it was applied. |
| `supabase/tests/database/` | pgTAP tests: teacher B can't read or change teacher A's rows, a browser without a session gets nothing, the section 11 rules, and the 30-day clean-up. |
| `supabase/config.toml` | Settings for the local copy the Supabase CLI runs. The CLI needs this folder to be called `supabase/`. |

The curriculum is not in the database. It stays a JSON file (`src/data/curriculum/sk.json`), and rows refer to it by the dataset's text ids: courses such as `sk-63`, units such as `sk-63-u110469`, outcomes such as `sk-63-162290`. Outcome codes repeat across courses, so a row always stores the full id.

## Applied migrations

| Migration | What it does | Funza (development, `oitifuxpuxsbzubokukn`) | Production |
|---|---|---|---|
| `20261122011051_initial_schema` | The 15 tables and 3 join tables of Diagram 4, row-level security on every table, the section 11 rules (approved versions never change, one answer per student per question, open join codes unique, course deletion cascades, bank questions kept and retired) | Applied 21 Nov 2026, 19:10 CST | Project not created yet |
| `20261122011536_student_data_cleanup` | The nightly pg_cron job that deletes student names, numbers and answers 30 days after a session, keeping anonymous counts per question | Applied 21 Nov 2026, 19:15 CST | Project not created yet |
| `20261122011932_close_rls_auto_enable_rpc` | Takes EXECUTE on the hosted project's own `rls_auto_enable()` event-trigger function away from the API roles (a security advisor finding). Does nothing on a local database, where the function doesn't exist | Applied 21 Nov 2026, 19:19 CST | Project not created yet |
| `20261124050141_step4_courses_and_bank` | Seeded chapters unique per course; `questions.fingerprint` with a unique index per teacher; `approve_version()`, which approves a version and fills the question bank in one transaction as the signed-in teacher | Applied 23 Nov 2026, 23:01 CST | Project not created yet |
| `20261124050157_chapter_sources_storage` | The private `sources` Storage bucket (20 MB, PDF and text files) and row-level security on `storage.objects`, so each teacher reaches only their own folder | Applied 23 Nov 2026, 23:01 CST | Project not created yet |
| `20261124052904_live_mode` | Live mode: the whole-set clock and a revision number on `live_sessions`; an answer-key snapshot on each live question (deleting a bank question no longer deletes live answers); Funza's mark kept beside the teacher's (`answers.ai_marks`); teachers may remove their own students and change marks (column grant); server-only `rate_limits` counters with `rate_hit()` and a pg_cron job that prunes them every 10 minutes; `set_live_marks()` and `end_live_session()` | Applied 23 Nov 2026, 23:29 CST | Project not created yet |

Add a row whenever a migration is applied to a project, and fill in the Production column when it reaches `funza-prod`.

## Who can do what

| Role | Access |
|---|---|
| `anon` (a browser with no session) | Nothing. Students never use the database directly; their requests go through the API. |
| `authenticated` (a signed-in teacher) | Their own rows only (`teacher_id = auth.uid()`), in every teacher table. Built-in templates are readable by all. Participants, answers and AI usage are read-only; the Google refresh token column can't be read at all. |
| `service_role` (the server, with the secret key) | Everything. Used only for student writes, AI usage rows and scheduled work, after the API has checked who is asking. |

A child row points at its parent with `(parent_id, teacher_id)`, so it can only belong to a parent of the same teacher, even when the server writes it.

## Changing the schema

Run these from `app/`, with Docker running.

1. **Write a migration.** `supabase --workdir db migration new <what_it_does>`, then write the SQL. Never edit a migration that has been applied anywhere; fix it with a new one.
2. **Test it locally.** `npm run db:reset` applies every migration to a fresh local database, and `npm run db:test` runs the pgTAP tests. Add tests for any new rule or policy.
3. **Regenerate.** `npm run db:types` (the TypeScript types in `src/lib/db/types.ts`) and `npm run db:schema` (this folder's `schema.sql`). CI fails if the types don't match the migrations.
4. **Apply it to the Funza project.** Send the file's exact contents, named after the file without its timestamp (`20261122011536_student_data_cleanup.sql` becomes `student_data_cleanup`), or run `supabase db push` on a linked project.
5. **Record it.** Rename the file to the version Supabase recorded (shown by `supabase migration list` or in the dashboard), so the local history matches the project, and add a row to the table above.

Other commands: `npm run db:start` and `npm run db:stop` start and stop the local database.

## The nightly clean-up

`public.purge_student_data()` runs every night at 08:15 UTC (02:15 in Saskatchewan) through pg_cron, as job `funza-purge-student-data`. For sessions that ended more than 30 days ago (or started more than 30 days ago and were never ended), it saves the answer counts on `live_questions`, then deletes the participants, which removes their names, student numbers and answers. A second job, `funza-prune-cron-history`, keeps two weeks of pg_cron's run log. Teachers can't run the function themselves.
