-- Development step 5: Live mode.
--
-- A session runs the whole set at once on one shared clock: lobby, then open
-- (students answer), closed (time is up; Funza marks short answers), revealed
-- (each phone sees its own result), ended (results). Only the server changes the
-- state; phones never touch the database (their requests go through the API with
-- the secret key).
--
-- 1. Sessions get a title, where they came from, the whole-set clock and a revision
--    number that every change raises (phones drop replies older than what they have).
-- 2. Each live question keeps a snapshot of the question and its answer key, so an
--    edit in the bank can't change a running quiz, and deleting a bank question no
--    longer deletes live answers.
-- 3. Funza's own mark is kept beside the teacher's, for Undo.
-- 4. Teachers may remove their own students and change the marks of their own
--    answers. Everything else on student rows stays server-only.
-- 5. Rate-limit counters for the public live endpoints (join, state, answer).
-- 6. set_live_marks() applies marks in bulk; end_live_session() ends a session,
--    keeps per-question counts and, if the answers were revealed, teaches the bank.
--
-- Only adds things (and relaxes one foreign key), so the deployed app keeps working.

-- 1. Sessions ------------------------------------------------------------------------

alter table public.live_sessions
  alter column timer_s set default 300,
  alter column ask_student_no set default true,
  add column title text not null default 'Live session' check (char_length(title) between 1 and 300),
  add column chapter_id uuid,
  -- The approved version the questions came from, when there is one.
  add column resource_version_id uuid,
  add column opened_at timestamptz,
  add column ends_at timestamptz,
  add column closed_at timestamptz,
  add column revealed_at timestamptz,
  add column rev integer not null default 0 check (rev >= 0);

alter table public.live_sessions
  add foreign key (chapter_id, teacher_id) references public.chapters (id, teacher_id)
    on delete set null (chapter_id),
  add foreign key (resource_version_id, teacher_id) references public.resource_versions (id, teacher_id)
    on delete set null (resource_version_id),
  add constraint live_sessions_open_has_clock
    check (state in ('lobby', 'ended') or (opened_at is not null and ends_at is not null)),
  add constraint live_sessions_clock_order
    check (ends_at is null or opened_at is null or ends_at >= opened_at),
  add constraint live_sessions_closed_has_time
    check (state not in ('closed', 'revealed') or closed_at is not null),
  add constraint live_sessions_revealed_has_time
    check (state <> 'revealed' or revealed_at is not null);

create index live_sessions_chapter_id_idx on public.live_sessions (chapter_id, teacher_id);
create index live_sessions_resource_version_id_idx on public.live_sessions (resource_version_id, teacher_id);

-- 2. Live questions --------------------------------------------------------------------

-- The question as it was when the session started:
--   {type, stem, options, answer, marks, outcomeRef}
-- type is one a phone can answer (mcq, tf, calc = a number, short); answer is the
-- key, in the bank's shape. It never reaches a phone before Reveal.
alter table public.live_questions add column content jsonb;

update public.live_questions lq
set content = jsonb_build_object(
  'type', q.type, 'stem', q.stem, 'options', q.options,
  'answer', q.answer, 'marks', q.marks, 'outcomeRef', q.outcome_ref)
from public.questions q
where q.id = lq.question_id;

alter table public.live_questions
  alter column content set not null,
  alter column question_id drop not null,
  add constraint live_questions_content_shape check (
    jsonb_typeof(content) = 'object'
    and content ->> 'type' in ('mcq', 'tf', 'calc', 'short')
    and char_length(coalesce(content ->> 'stem', '')) between 1 and 5000
    and jsonb_typeof(content -> 'answer') = 'object'
    and jsonb_typeof(content -> 'marks') = 'number'
  ),
  add constraint live_questions_position_key unique (session_id, position),
  -- Funza's marking of short answers: none yet, running, done or failed.
  add column mark_state text not null default 'none' check (mark_state in ('none', 'running', 'done', 'failed')),
  add column mark_started_at timestamptz,
  -- Funza's one-line note for the class, or why marking failed.
  add column mark_note text check (char_length(mark_note) <= 300),
  drop constraint live_questions_question_id_teacher_id_fkey;

-- Deleting a bank question keeps the live question (and its answers) with its snapshot.
alter table public.live_questions
  add constraint live_questions_question_id_teacher_id_fkey
  foreign key (question_id, teacher_id) references public.questions (id, teacher_id)
  on delete set null (question_id);

-- 3. Answers ---------------------------------------------------------------------------

-- Funza's mark for a short answer, kept when the teacher changes it ("Funza said
-- Partly") so the change can be undone.
alter table public.answers add column ai_marks numeric(6, 2) check (ai_marks >= 0);

-- 4. What a teacher may change on student rows -----------------------------------------

-- Removing a student deletes them; their answers go with them.
grant delete on public.participants to authenticated;
create policy "Teachers remove their own participants" on public.participants
  for delete to authenticated using (teacher_id = (select auth.uid()));

-- A teacher changes marks, never what a student answered.
grant update (correct, marks, marked_by, ai_marks) on public.answers to authenticated;
create policy "Teachers mark their own answers" on public.answers
  for update to authenticated
  using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));

-- 5. Rate limits -----------------------------------------------------------------------

-- Fixed windows per key, such as "join-ip:<hash>". The keys are hashes, so no
-- network address is stored. Unlogged: a counter lost in a crash doesn't matter.
-- Server only: row-level security is on with no policies.
create unlogged table public.rate_limits (
  key text not null check (char_length(key) between 1 and 200),
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
grant select, insert, update, delete on public.rate_limits to service_role;

-- Counts one hit against p_key and says whether it is still within p_limit for the
-- current window of p_window_s seconds.
create function public.rate_hit(p_key text, p_limit integer, p_window_s integer default 60)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  w timestamptz;
  n integer;
begin
  if p_limit < 1 or p_window_s not between 1 and 3600 then
    raise exception 'Invalid rate limit.' using errcode = 'invalid_parameter_value';
  end if;
  w := to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s);
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into n;
  return n <= p_limit;
end;
$$;

revoke execute on function public.rate_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_hit(text, integer, integer) to service_role;

-- Old windows are cleared every ten minutes.
select cron.schedule(
  'funza-prune-rate-limits',
  '*/10 * * * *',
  $$delete from public.rate_limits where window_start < now() - interval '10 minutes'$$
);

-- 6. Marks and the end of a session ----------------------------------------------------

-- Applies marks to answers of one session, as the signed-in teacher (row-level
-- security and the column grant apply). p_marks is [{id, marks}].
--   p_by = 'ai'      Funza's marks. A mark the teacher changed stays; Funza's is kept beside it.
--   p_by = 'teacher' the teacher's mark.
--   p_by = 'code'    an exact mark recomputed by the app (Undo on an exact question).
--   p_by = 'undo'    back to Funza's mark (or unmarked if Funza never marked it).
-- Marks are whole numbers from 0 to the question's marks; full marks count as correct.
create function public.set_live_marks(p_session uuid, p_by text, p_marks jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  if p_by not in ('ai', 'teacher', 'code', 'undo') then
    raise exception 'Unknown marker.' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_typeof(coalesce(p_marks, '[]'::jsonb)) <> 'array' then
    raise exception 'The marks must be a list.' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (
    select 1 from public.live_sessions s
    where s.id = p_session and s.state in ('closed', 'revealed')
  ) then
    raise exception 'Marks change only after time is up and before the session ends.'
      using errcode = 'check_violation';
  end if;

  with m as (
    select * from jsonb_to_recordset(coalesce(p_marks, '[]'::jsonb)) as m(id uuid, marks numeric)
  ),
  calc as (
    select
      a.id,
      (q.content ->> 'marks')::numeric as max_marks,
      case
        when p_by = 'ai' and a.marked_by = 'teacher' then a.marks
        when p_by = 'undo' then a.ai_marks
        else least(greatest(round(m.marks), 0), (q.content ->> 'marks')::numeric)
      end as new_marks,
      case
        when p_by = 'ai' and a.marked_by = 'teacher' then 'teacher'
        when p_by = 'undo' then case when a.ai_marks is null then null else 'ai' end
        else p_by
      end as new_by,
      case
        when p_by = 'ai' then least(greatest(round(m.marks), 0), (q.content ->> 'marks')::numeric)
        else a.ai_marks
      end as new_ai
    from public.answers a
    join m on m.id = a.id
    join public.live_questions q on q.id = a.live_question_id
    where a.session_id = p_session
  )
  update public.answers a
  set marks = c.new_marks,
      marked_by = c.new_by,
      ai_marks = c.new_ai,
      correct = case when c.new_marks is null then null else c.new_marks >= c.max_marks end
  from calc c
  where a.id = c.id;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.set_live_marks(uuid, text, jsonb) from public, anon;
grant execute on function public.set_live_marks(uuid, text, jsonb) to authenticated;

-- Ends a session, as the signed-in teacher. Writes each question's answer and
-- correct counts and, if the answers were revealed, adds them to the bank question
-- (its difficulty appears after 10 answers). Running it again does nothing.
create function public.end_live_session(p_session uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  s public.live_sessions%rowtype;
begin
  select * into s from public.live_sessions
  where id = p_session and teacher_id = (select auth.uid())
  for update;
  if not found then
    raise exception 'That session doesn''t exist.' using errcode = 'no_data_found';
  end if;
  if s.state = 'ended' then
    return;
  end if;

  update public.live_questions lq
  set answer_count = c.n, correct_count = c.ok
  from (
    select q.id, count(a.id)::int as n, (count(a.id) filter (where a.correct))::int as ok
    from public.live_questions q
    left join public.answers a on a.live_question_id = q.id
    where q.session_id = p_session
    group by q.id
  ) c
  where lq.id = c.id;

  if s.revealed_at is not null then
    update public.questions b
    set answer_count = b.answer_count + t.n,
        correct_count = b.correct_count + t.ok,
        times_used = b.times_used + 1,
        last_used_at = now()
    from (
      select question_id, sum(answer_count)::int as n, sum(correct_count)::int as ok
      from public.live_questions
      where session_id = p_session and question_id is not null
      group by question_id
    ) t
    where b.id = t.question_id;
  end if;

  update public.live_sessions
  set state = 'ended', ended_at = now(), current_question_id = null, rev = rev + 1
  where id = p_session;
end;
$$;

revoke execute on function public.end_live_session(uuid) from public, anon;
grant execute on function public.end_live_session(uuid) to authenticated;
