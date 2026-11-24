-- Development step 4: courses, Make and the question bank in the database.
--
-- Only adds things, so the app already deployed keeps working while this is applied.
--
-- 1. Chapters seeded from the curriculum can't be added twice to one course: seeding
--    again (setup, then opening the course page) does nothing.
-- 2. Each bank question carries a fingerprint of its content. Approving a new
--    version links unchanged questions to the bank rows they already have instead of
--    copying them again.
-- 3. approve_version() approves a version and copies its questions into the bank in
--    one transaction, as the signed-in teacher (row-level security applies). The app
--    runs the review checks on the server before calling it.

-- 1. Seeded chapters are unique per course ---------------------------------------

create unique index chapters_course_source_ref_key on public.chapters (course_id, source_ref)
  where source_ref is not null;

-- 2. Question fingerprints ---------------------------------------------------------

-- A SHA-256 (hex) of the question's content, computed by the app: type, stem,
-- options, answer, worked solution and outcome. Marks and difficulty are left out,
-- so changing the marks keeps the same bank question.
alter table public.questions
  add column fingerprint text check (char_length(fingerprint) between 1 and 100);

create unique index questions_teacher_fingerprint_key on public.questions (teacher_id, fingerprint)
  where fingerprint is not null;

-- 3. Approve a version and fill the bank -------------------------------------------

-- p_questions is a JSON array of
--   {position, chapter_id, type, stem, options, answer, marks, outcome_ref, fingerprint}
-- built by the app from the version's question parts (empty for notes and slides).
-- Returns how many bank questions the version now links to.
create function public.approve_version(p_version uuid, p_questions jsonb default '[]')
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  v_resource uuid;
  linked integer := 0;
begin
  if me is null then
    raise exception 'Sign in to approve.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(coalesce(p_questions, '[]'::jsonb)) <> 'array' then
    raise exception 'The questions must be a list.' using errcode = 'invalid_parameter_value';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) e
    where coalesce(e ->> 'fingerprint', '') = '' or coalesce(e ->> 'chapter_id', '') = ''
  ) then
    raise exception 'Every question needs a fingerprint and a chapter.' using errcode = 'invalid_parameter_value';
  end if;

  update public.resource_versions v
  set approved_at = now(), approved_by = me
  where v.id = p_version and v.teacher_id = me and v.approved_at is null
  returning v.resource_id into v_resource;

  if v_resource is null then
    raise exception 'That version doesn''t exist or is already approved.' using errcode = 'check_violation';
  end if;

  with input as (
    -- One row per fingerprint: a question repeated in one version is banked once.
    select distinct on (q.fingerprint)
      q.position, q.chapter_id, q.type, q.stem, q.options, q.answer, coalesce(q.marks, 1) as marks, q.outcome_ref, q.fingerprint
    from jsonb_to_recordset(coalesce(p_questions, '[]'::jsonb)) as q(
      position integer, chapter_id uuid, type text, stem text, options jsonb, answer jsonb,
      marks integer, outcome_ref text, fingerprint text
    )
    order by q.fingerprint, q.position
  ),
  saved as (
    insert into public.questions as b (teacher_id, chapter_id, type, stem, options, answer, marks, outcome_ref, fingerprint)
    select me, i.chapter_id, i.type, i.stem, i.options, i.answer, i.marks, i.outcome_ref, i.fingerprint
    from input i
    -- Already in the bank: keep that row. A retired one is back in use, in its old
    -- chapter if it still has one.
    on conflict (teacher_id, fingerprint) where fingerprint is not null do update
      set chapter_id = coalesce(b.chapter_id, excluded.chapter_id),
          retired = false,
          updated_at = now()
    returning b.id, b.fingerprint
  )
  insert into public.version_questions (version_id, question_id, teacher_id, position)
  select p_version, s.id, me, coalesce(i.position, 0)
  from saved s
  join input i on i.fingerprint = s.fingerprint;

  get diagnostics linked = row_count;

  update public.resources r
  set status = 'approved', current_version_id = p_version
  where r.id = v_resource and r.teacher_id = me;

  return linked;
end;
$$;

comment on function public.approve_version(uuid, jsonb) is
  'Approves one of the signed-in teacher''s versions and links its questions to the bank, copying the new ones. The app checks the review first.';

revoke execute on function public.approve_version(uuid, jsonb) from public, anon;
grant execute on function public.approve_version(uuid, jsonb) to authenticated;
