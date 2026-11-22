-- Funza Teacher Studio: the first schema.
--
-- The 15 tables and 3 join tables of Diagram 4 in
-- docs/03_design/02_requirements_and_architecture/. Prepare: teachers, courses,
-- chapters, sources, templates, resources, resource_versions, publications and
-- questions (the bank). Live: live_sessions, live_questions, participants and
-- answers. Account: google_connections and ai_usage. Join tables:
-- resource_chapters, version_questions and template_pins.
--
-- Ownership. Every row carries teacher_id, so each row-level security policy is
-- one line. A child row points at its parent with (parent_id, teacher_id), so it
-- can only hang under a parent that belongs to the same teacher, even when the
-- server writes it with the secret key.
--
-- The curriculum stays a JSON file in the repo (src/data/curriculum/sk.json), not
-- tables. Rows refer to it by the dataset's text ids: curriculum courses such as
-- "sk-63", units such as "sk-63-u110469" and outcomes such as "sk-63-162290".
-- Outcome codes repeat across courses, so the full id is stored, never the bare
-- code. Some courses carry objectives read from a curriculum document instead of
-- web outcomes, so these columns hold opaque references, not only outcome ids.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Teachers and courses
-- ---------------------------------------------------------------------------

-- One row per teacher, created by the app on first sign-in. id is the Auth user.
create table public.teachers (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 200),
  school text not null default '' check (char_length(school) <= 200),
  grades smallint[] not null default '{}' check (grades <@ array[10, 11, 12]::smallint[]),
  subjects text[] not null default '{}' check (cardinality(subjects) <= 40),
  -- Null until the teacher finishes first-time setup.
  setup_done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A teacher's course, such as "Chemistry 30, period 2".
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  -- The curriculum course in sk.json, such as "sk-63". Null for a course of the teacher's own.
  curriculum_course_id text check (char_length(curriculum_course_id) between 1 and 64),
  -- Several curricula span levels ("Band 10, 20, 30"): 10, 20 and 30 are Grades 10, 11 and 12.
  level smallint check (level in (10, 20, 30)),
  title text not null check (char_length(title) between 1 and 200),
  position integer not null default 0,
  -- The random link of the course page (FR-24), and whether it is open.
  share_slug text unique check (share_slug ~ '^[A-Za-z0-9_-]{16,64}$'),
  share_on boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, teacher_id),
  constraint courses_curriculum_needs_level check (curriculum_course_id is null or level is not null)
);

-- A chapter of a course. Chapters are seeded from the curriculum, and the official
-- grouping differs by subject, so the seed is recorded as a kind and a reference:
--   unit    : a curriculum unit                         source_ref "sk-63-u110469"
--   module  : a Practical and Applied Arts module, one outcome each  source_ref = its outcome id
--   outcome : one chapter per outcome, for courses without units    source_ref = its outcome id
--   custom  : made, merged or renamed by the teacher      source_ref null
-- outcome_refs lists the curriculum references the chapter covers, in order.
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  course_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  position integer not null default 0,
  source_kind text not null default 'custom' check (source_kind in ('unit', 'module', 'outcome', 'custom')),
  source_ref text check (char_length(source_ref) between 1 and 200),
  outcome_refs text[] not null default '{}' check (cardinality(outcome_refs) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, teacher_id),
  foreign key (course_id, teacher_id) references public.courses (id, teacher_id) on delete cascade,
  constraint chapters_source_ref_matches_kind check ((source_kind = 'custom') = (source_ref is null))
);

-- Notes, PDFs and past exams attached to a chapter (FR-5). The file is in Storage;
-- its text is extracted once and kept, so later drafts don't read the file again.
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  chapter_id uuid not null,
  kind text not null check (kind in ('notes', 'pdf', 'past_exam')),
  title text not null check (char_length(title) between 1 and 300),
  file_path text check (char_length(file_path) between 1 and 1024),
  text text,
  created_at timestamptz not null default now(),
  foreign key (chapter_id, teacher_id) references public.chapters (id, teacher_id) on delete cascade,
  constraint sources_has_content check (file_path is not null or text is not null)
);

-- ---------------------------------------------------------------------------
-- Prepare: templates, the question bank, resources and versions
-- ---------------------------------------------------------------------------

-- Exam and notes templates. Built-in templates (Quiz, Unit test, Midterm, Final)
-- belong to no teacher and every teacher can read them; that is the only kind of
-- row without a teacher_id.
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.teachers (id) on delete cascade,
  kind text not null check (kind in ('exam', 'notes')),
  name text not null check (char_length(name) between 1 and 200),
  built_in boolean not null default false,
  -- Sections, counts, marks, time, the question mix and the cover page.
  format jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, teacher_id),
  constraint templates_built_in_has_no_owner check (built_in = (teacher_id is null))
);

-- The question bank: every approved question, kept per chapter (FR-27). Deleting a
-- chapter keeps its questions, unlinked and retired.
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  chapter_id uuid,
  type text not null check (type in ('mcq', 'tf', 'fill', 'match', 'calc', 'short', 'long')),
  stem text not null check (char_length(stem) between 1 and 5000),
  options jsonb,
  -- The answer key. It never reaches a phone before Reveal.
  answer jsonb not null,
  marks integer not null default 1 check (marks between 0 and 100),
  -- The curriculum reference it assesses, such as "sk-63-162290".
  outcome_ref text check (char_length(outcome_ref) between 1 and 200),
  -- Anonymous counts from live sessions. Difficulty is the share answered correctly,
  -- shown only after at least 10 answers.
  answer_count integer not null default 0 check (answer_count >= 0),
  correct_count integer not null default 0,
  difficulty real generated always as (
    case when answer_count >= 10 then correct_count::real / answer_count end
  ) stored,
  times_used integer not null default 0 check (times_used >= 0),
  last_used_at timestamptz,
  retired boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, teacher_id),
  foreign key (chapter_id, teacher_id) references public.chapters (id, teacher_id) on delete set null (chapter_id),
  constraint questions_counts_valid check (correct_count between 0 and answer_count),
  constraint questions_unlinked_are_retired check (chapter_id is not null or retired)
);

create table public.template_pins (
  template_id uuid not null,
  question_id uuid not null,
  teacher_id uuid not null,
  position integer not null default 0,
  primary key (template_id, question_id),
  foreign key (template_id, teacher_id) references public.templates (id, teacher_id) on delete cascade,
  foreign key (question_id, teacher_id) references public.questions (id, teacher_id) on delete cascade
);

-- Notes, slides, quizzes, tests and exams. kind uses the app's ResourceKind values.
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  course_id uuid not null,
  template_id uuid references public.templates (id) on delete set null,
  kind text not null check (kind in ('notes', 'presentation', 'quiz', 'test', 'exam')),
  title text not null check (char_length(title) between 1 and 300),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'published')),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, teacher_id),
  foreign key (course_id, teacher_id) references public.courses (id, teacher_id) on delete cascade
);

create table public.resource_chapters (
  resource_id uuid not null,
  chapter_id uuid not null,
  teacher_id uuid not null,
  primary key (resource_id, chapter_id),
  foreign key (resource_id, teacher_id) references public.resources (id, teacher_id) on delete cascade,
  foreign key (chapter_id, teacher_id) references public.chapters (id, teacher_id) on delete cascade
);

-- Every saved state of a resource. An approved version never changes: editing it
-- creates the next number.
create table public.resource_versions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  resource_id uuid not null,
  number integer not null check (number >= 1),
  content jsonb not null,
  approved_at timestamptz,
  approved_by uuid references public.teachers (id),
  created_at timestamptz not null default now(),
  unique (resource_id, number),
  unique (id, teacher_id),
  unique (id, resource_id),
  foreign key (resource_id, teacher_id) references public.resources (id, teacher_id) on delete cascade,
  constraint resource_versions_approval_complete check ((approved_at is null) = (approved_by is null))
);

-- The version a resource shows now; it must be one of that resource's own versions.
alter table public.resources
  add foreign key (current_version_id, id) references public.resource_versions (id, resource_id)
  on delete set null (current_version_id);

create table public.version_questions (
  version_id uuid not null,
  question_id uuid not null,
  teacher_id uuid not null,
  position integer not null default 0,
  primary key (version_id, question_id),
  foreign key (version_id, teacher_id) references public.resource_versions (id, teacher_id) on delete cascade,
  foreign key (question_id, teacher_id) references public.questions (id, teacher_id) on delete cascade
);

-- Where an approved version went: the course page, Google Classroom or print.
create table public.publications (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  version_id uuid not null,
  channel text not null check (channel in ('page', 'classroom', 'print')),
  external_id text check (char_length(external_id) between 1 and 500),
  published_at timestamptz not null default now(),
  foreign key (version_id, teacher_id) references public.resource_versions (id, teacher_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Live
-- ---------------------------------------------------------------------------

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  course_id uuid not null,
  -- Six characters with no look-alikes: no 0, O, 1 or I.
  code text not null check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  state text not null default 'lobby' check (state in ('lobby', 'open', 'closed', 'revealed', 'ended')),
  current_question_id uuid,
  timer_s integer not null default 30 check (timer_s between 5 and 3600),
  ask_student_no boolean not null default false,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  -- Set by the nightly job once student names, numbers and answers are deleted.
  students_purged_at timestamptz,
  unique (id, teacher_id),
  foreign key (course_id, teacher_id) references public.courses (id, teacher_id) on delete cascade,
  constraint live_sessions_ended_at_matches_state check ((state = 'ended') = (ended_at is not null))
);

-- A join code is unique among sessions that haven't ended, and can be reused after.
create unique index live_sessions_open_code_key on public.live_sessions (code) where state <> 'ended';

create table public.live_questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  session_id uuid not null,
  question_id uuid not null,
  position integer not null check (position >= 1),
  started_at timestamptz,
  ends_at timestamptz,
  revealed_at timestamptz,
  -- Anonymous counts, filled in before the answers are deleted.
  answer_count integer check (answer_count >= 0),
  correct_count integer,
  unique (id, teacher_id),
  unique (id, session_id),
  foreign key (session_id, teacher_id) references public.live_sessions (id, teacher_id) on delete cascade,
  foreign key (question_id, teacher_id) references public.questions (id, teacher_id) on delete cascade,
  constraint live_questions_counts_valid check (correct_count between 0 and answer_count)
);

alter table public.live_sessions
  add foreign key (current_question_id, id) references public.live_questions (id, session_id)
  on delete set null (current_question_id);

-- A student in one session. No account: the phone holds a random token and only
-- its hash is stored. Deleted 30 days after the session.
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  session_id uuid not null,
  name text not null check (char_length(name) between 1 and 60),
  student_no text check (char_length(student_no) between 1 and 30),
  token_hash text not null unique check (char_length(token_hash) between 32 and 128),
  joined_at timestamptz not null default now(),
  unique (id, teacher_id),
  unique (id, session_id),
  foreign key (session_id, teacher_id) references public.live_sessions (id, teacher_id) on delete cascade
);

-- One answer per participant per live question; a later save replaces it.
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  session_id uuid not null,
  participant_id uuid not null,
  live_question_id uuid not null,
  response jsonb not null,
  correct boolean,
  marks numeric(6, 2) check (marks >= 0),
  marked_by text check (marked_by in ('code', 'ai', 'teacher')),
  saved_at timestamptz not null default now(),
  constraint answers_one_per_question unique (participant_id, live_question_id),
  foreign key (session_id, teacher_id) references public.live_sessions (id, teacher_id) on delete cascade,
  -- The participant and the question must both belong to this session.
  foreign key (participant_id, session_id) references public.participants (id, session_id) on delete cascade,
  foreign key (live_question_id, session_id) references public.live_questions (id, session_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Account
-- ---------------------------------------------------------------------------

-- Release 2: the Classroom connection kept on the account. The server encrypts the
-- refresh token before storing it, and browsers can't read that column.
create table public.google_connections (
  teacher_id uuid primary key references public.teachers (id) on delete cascade,
  google_email text not null check (char_length(google_email) between 3 and 320),
  refresh_token text not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per AI call, for the daily allowance (FR-30). Only the server writes it,
-- so a teacher can't erase their own usage.
create table public.ai_usage (
  id bigint generated always as identity primary key,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  task text not null check (char_length(task) between 1 and 100),
  model text not null check (char_length(model) between 1 and 200),
  tokens_in integer not null default 0 check (tokens_in >= 0),
  tokens_out integer not null default 0 check (tokens_out >= 0),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Rules enforced by triggers
-- ---------------------------------------------------------------------------

create trigger teachers_set_updated_at before update on public.teachers
  for each row execute function public.set_updated_at();
create trigger courses_set_updated_at before update on public.courses
  for each row execute function public.set_updated_at();
create trigger chapters_set_updated_at before update on public.chapters
  for each row execute function public.set_updated_at();
create trigger templates_set_updated_at before update on public.templates
  for each row execute function public.set_updated_at();
create trigger questions_set_updated_at before update on public.questions
  for each row execute function public.set_updated_at();
create trigger resources_set_updated_at before update on public.resources
  for each row execute function public.set_updated_at();
create trigger google_connections_set_updated_at before update on public.google_connections
  for each row execute function public.set_updated_at();

-- An approved version never changes, and is never deleted on its own. It goes only
-- when its resource or course is deleted (a cascade, which runs one trigger deeper).
create function public.keep_approved_versions() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.approved_at is not null and (tg_op = 'UPDATE' or pg_trigger_depth() = 1) then
    raise exception 'Version % is approved and can''t change. Save the edit as a new version.', old.number
      using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger resource_versions_keep_approved before update or delete on public.resource_versions
  for each row execute function public.keep_approved_versions();

-- Nothing reaches students until the teacher approves it: only an approved version
-- can be published.
create function public.publish_only_approved() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.resource_versions v
    where v.id = new.version_id and v.teacher_id = new.teacher_id and v.approved_at is not null
  ) then
    raise exception 'Only an approved version can be published.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger publications_only_approved before insert or update on public.publications
  for each row execute function public.publish_only_approved();

-- A resource uses a built-in template or one of its teacher's own.
create function public.check_resource_template() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.template_id is not null and not exists (
    select 1 from public.templates t
    where t.id = new.template_id and (t.built_in or t.teacher_id = new.teacher_id)
  ) then
    raise exception 'That template doesn''t exist.' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger resources_check_template before insert or update of template_id on public.resources
  for each row execute function public.check_resource_template();

-- A question whose chapter is deleted stays in the bank, retired.
create function public.retire_unlinked_questions() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.chapter_id is null and old.chapter_id is not null then
    new.retired := true;
  end if;
  return new;
end;
$$;

create trigger questions_retire_unlinked before update of chapter_id on public.questions
  for each row execute function public.retire_unlinked_questions();

-- ---------------------------------------------------------------------------
-- Indexes: one per foreign key, plus the lists the app reads by teacher
-- ---------------------------------------------------------------------------

create index courses_teacher_id_idx on public.courses (teacher_id, position);
create index chapters_course_id_idx on public.chapters (course_id, teacher_id);
create index sources_chapter_id_idx on public.sources (chapter_id, teacher_id);
create index templates_teacher_id_idx on public.templates (teacher_id);
create index questions_teacher_id_idx on public.questions (teacher_id);
create index questions_chapter_id_idx on public.questions (chapter_id, teacher_id);
create index template_pins_template_id_idx on public.template_pins (template_id, teacher_id);
create index template_pins_question_id_idx on public.template_pins (question_id, teacher_id);
create index resources_course_id_idx on public.resources (course_id, teacher_id);
create index resources_template_id_idx on public.resources (template_id);
create index resources_current_version_id_idx on public.resources (current_version_id, id);
create index resource_chapters_resource_id_idx on public.resource_chapters (resource_id, teacher_id);
create index resource_chapters_chapter_id_idx on public.resource_chapters (chapter_id, teacher_id);
create index resource_versions_resource_id_idx on public.resource_versions (resource_id, teacher_id);
create index resource_versions_approved_by_idx on public.resource_versions (approved_by);
create index version_questions_version_id_idx on public.version_questions (version_id, teacher_id);
create index version_questions_question_id_idx on public.version_questions (question_id, teacher_id);
create index publications_version_id_idx on public.publications (version_id, teacher_id);
create index live_sessions_course_id_idx on public.live_sessions (course_id, teacher_id);
create index live_sessions_teacher_id_idx on public.live_sessions (teacher_id);
create index live_sessions_current_question_id_idx on public.live_sessions (current_question_id, id);
create index live_questions_session_id_idx on public.live_questions (session_id, teacher_id);
create index live_questions_question_id_idx on public.live_questions (question_id, teacher_id);
create index participants_session_id_idx on public.participants (session_id, teacher_id);
create index answers_session_id_idx on public.answers (session_id, teacher_id);
create index answers_participant_id_idx on public.answers (participant_id, session_id);
create index answers_live_question_id_idx on public.answers (live_question_id, session_id);
create index ai_usage_teacher_id_idx on public.ai_usage (teacher_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Access
--
-- New tables give the API roles nothing by default in this project, so each grant
-- is explicit. anon (a browser with no session) gets nothing: students never use
-- the database directly; their requests go through the API, which uses the secret
-- key. Teachers read and change only their own rows. Student rows (participants,
-- answers) and AI usage are read-only for the teacher; only the server writes them.
-- ---------------------------------------------------------------------------

alter table public.teachers enable row level security;
alter table public.courses enable row level security;
alter table public.chapters enable row level security;
alter table public.sources enable row level security;
alter table public.templates enable row level security;
alter table public.questions enable row level security;
alter table public.template_pins enable row level security;
alter table public.resources enable row level security;
alter table public.resource_chapters enable row level security;
alter table public.resource_versions enable row level security;
alter table public.version_questions enable row level security;
alter table public.publications enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_questions enable row level security;
alter table public.participants enable row level security;
alter table public.answers enable row level security;
alter table public.google_connections enable row level security;
alter table public.ai_usage enable row level security;

grant select, insert, update on public.teachers to authenticated;
grant select, insert, update, delete on
  public.courses, public.chapters, public.sources, public.templates, public.questions,
  public.template_pins, public.resources, public.resource_chapters, public.resource_versions,
  public.version_questions, public.publications, public.live_sessions, public.live_questions
  to authenticated;
grant select on public.participants, public.answers, public.ai_usage to authenticated;
grant select (teacher_id, google_email, scopes, created_at, updated_at) on public.google_connections to authenticated;

grant select, insert, update, delete on all tables in schema public to service_role;

create policy "Teachers see and change their own row" on public.teachers
  for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Teachers manage their own courses" on public.courses
  for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "Teachers manage their own chapters" on public.chapters
  for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "Teachers manage their own sources" on public.sources
  for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "Teachers manage their own questions" on public.questions
  for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "Teachers manage their own template pins" on public.template_pins
  for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "Teachers manage their own resources" on public.resources
  for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "Teachers manage their own resource chapters" on public.resource_chapters
  for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "Teachers manage their own versions" on public.resource_versions
  for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "Teachers manage their own version questions" on public.version_questions
  for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "Teachers manage their own publications" on public.publications
  for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "Teachers manage their own live sessions" on public.live_sessions
  for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "Teachers manage their own live questions" on public.live_questions
  for all to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));

-- Built-in templates are readable by every teacher; a teacher changes only their own.
create policy "Teachers read built-in and their own templates" on public.templates
  for select to authenticated using (built_in or teacher_id = (select auth.uid()));
create policy "Teachers add their own templates" on public.templates
  for insert to authenticated with check (teacher_id = (select auth.uid()));
create policy "Teachers change their own templates" on public.templates
  for update to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "Teachers delete their own templates" on public.templates
  for delete to authenticated using (teacher_id = (select auth.uid()));

create policy "Teachers read their own participants" on public.participants
  for select to authenticated using (teacher_id = (select auth.uid()));
create policy "Teachers read their own answers" on public.answers
  for select to authenticated using (teacher_id = (select auth.uid()));
create policy "Teachers read their own Google connection" on public.google_connections
  for select to authenticated using (teacher_id = (select auth.uid()));
create policy "Teachers read their own AI usage" on public.ai_usage
  for select to authenticated using (teacher_id = (select auth.uid()));
