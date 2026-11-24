-- Development step 4: seeded chapters are unique per course, and approve_version()
-- approves a version and fills the question bank in one go, as the signed-in teacher.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'teacher-a@example.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'teacher-b@example.test', 'authenticated', 'authenticated');
insert into public.teachers (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Teacher A'),
  ('22222222-2222-2222-2222-222222222222', 'Teacher B');

insert into public.courses (id, teacher_id, curriculum_course_id, level, title) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'sk-63', 10, 'Science 10'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'sk-63', 10, 'Science 10 (second class)');
insert into public.chapters (id, teacher_id, course_id, title, source_kind, source_ref, outcome_refs) values
  ('bbbbbbbb-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001',
   'Force and Motion in Our World', 'unit', 'sk-63-u110469', array['sk-63-110477']);
insert into public.resources (id, teacher_id, course_id, title, kind) values
  ('bbbbbbbb-0000-0000-0000-000000000020', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 'Motion quiz', 'quiz');
insert into public.resource_versions (id, teacher_id, resource_id, number, content) values
  ('bbbbbbbb-0000-0000-0000-000000000021', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000020', 1, '{"v": 1}'),
  ('bbbbbbbb-0000-0000-0000-000000000022', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000020', 2, '{"v": 2}'),
  ('bbbbbbbb-0000-0000-0000-000000000023', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000020', 3, '{"v": 3}');
update public.resources set current_version_id = 'bbbbbbbb-0000-0000-0000-000000000021'
where id = 'bbbbbbbb-0000-0000-0000-000000000020';

-- Seeded chapters ------------------------------------------------------------------

select throws_ok(
  $$insert into public.chapters (teacher_id, course_id, title, source_kind, source_ref)
    values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 'Again', 'unit', 'sk-63-u110469')$$,
  '23505', null,
  'a curriculum unit is seeded into a course only once'
);
select lives_ok(
  $$insert into public.chapters (teacher_id, course_id, title, source_kind, source_ref)
    values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000002', 'Force and Motion', 'unit', 'sk-63-u110469')$$,
  'another course can be seeded from the same unit'
);

-- Approving ------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is(
  public.approve_version('bbbbbbbb-0000-0000-0000-000000000021', $$[
    {"position": 1, "chapter_id": "bbbbbbbb-0000-0000-0000-000000000010", "type": "mcq", "stem": "Which is a vector?",
     "options": [{"id": "a", "text": "Velocity"}, {"id": "b", "text": "Speed"}], "answer": {"correctId": "a"},
     "marks": 1, "outcome_ref": "sk-63-110477", "fingerprint": "fp-1"},
    {"position": 2, "chapter_id": "bbbbbbbb-0000-0000-0000-000000000010", "type": "tf", "stem": "Speed has a direction.",
     "answer": {"tf": false}, "marks": 1, "outcome_ref": "sk-63-110477", "fingerprint": "fp-2"}
  ]$$::jsonb),
  2,
  'approving links the version to its two questions'
);
select isnt(
  (select approved_at from public.resource_versions where id = 'bbbbbbbb-0000-0000-0000-000000000021'),
  null,
  'the version is approved'
);
select is(
  (select status from public.resources where id = 'bbbbbbbb-0000-0000-0000-000000000020'),
  'approved',
  'the resource shows as approved'
);
select is(
  (select count(*)::int from public.questions where fingerprint in ('fp-1', 'fp-2') and chapter_id = 'bbbbbbbb-0000-0000-0000-000000000010'),
  2,
  'both questions are in the chapter''s bank'
);
select is(
  (select count(*)::int from public.version_questions where version_id = 'bbbbbbbb-0000-0000-0000-000000000021'),
  2,
  'the version links to its bank questions'
);
select throws_ok(
  $$select public.approve_version('bbbbbbbb-0000-0000-0000-000000000021', '[]')$$,
  '23514', null,
  'an approved version can''t be approved again'
);

-- A new version keeps the unchanged question and adds the new one.
select is(
  public.approve_version('bbbbbbbb-0000-0000-0000-000000000022', $$[
    {"position": 1, "chapter_id": "bbbbbbbb-0000-0000-0000-000000000010", "type": "mcq", "stem": "Which is a vector?",
     "options": [{"id": "a", "text": "Velocity"}, {"id": "b", "text": "Speed"}], "answer": {"correctId": "a"},
     "marks": 2, "outcome_ref": "sk-63-110477", "fingerprint": "fp-1"},
    {"position": 2, "chapter_id": "bbbbbbbb-0000-0000-0000-000000000010", "type": "calc", "stem": "A car goes 100 m in 5 s. Its speed?",
     "answer": {"answer": "20 m/s"}, "marks": 2, "outcome_ref": "sk-63-110477", "fingerprint": "fp-3"}
  ]$$::jsonb),
  2,
  'the next version links to its two questions'
);
select is(
  (select count(*)::int from public.questions where teacher_id = '11111111-1111-1111-1111-111111111111'),
  3,
  'an unchanged question is reused, not copied again'
);

-- Refusals -------------------------------------------------------------------------

select throws_ok(
  $$select public.approve_version('bbbbbbbb-0000-0000-0000-000000000023', '[{"position": 1, "type": "tf", "stem": "x", "answer": {"tf": true}}]')$$,
  '22023', null,
  'every question needs a fingerprint and a chapter'
);

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok(
  $$select public.approve_version('bbbbbbbb-0000-0000-0000-000000000023', '[]')$$,
  '23514', null,
  'a teacher can''t approve another teacher''s version'
);

select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(
  (select approved_at from public.resource_versions where id = 'bbbbbbbb-0000-0000-0000-000000000023'),
  null,
  'the refused version is still a draft'
);

set local role anon;
select throws_ok(
  $$select public.approve_version('bbbbbbbb-0000-0000-0000-000000000023', '[]')$$,
  '42501', null,
  'a browser with no session can''t call it'
);

select * from finish();
rollback;
