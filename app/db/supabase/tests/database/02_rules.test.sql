-- The rules the schema enforces (requirements and architecture, section 11).
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'teacher-a@example.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'teacher-b@example.test', 'authenticated', 'authenticated');
insert into public.teachers (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Teacher A'),
  ('22222222-2222-2222-2222-222222222222', 'Teacher B');

insert into public.courses (id, teacher_id, curriculum_course_id, level, title)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'sk-526', 10, 'Accounting 10');
insert into public.chapters (id, teacher_id, course_id, title, source_kind, source_ref, outcome_refs)
values ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
        'Introduction to Accounting', 'module', 'sk-526-162290', array['sk-526-162290']);
insert into public.questions (id, teacher_id, chapter_id, type, stem, answer)
values ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002',
        'mcq', 'Which is an asset?', '{"optionId": "a"}');
insert into public.resources (id, teacher_id, course_id, title, kind)
values ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Quiz 1', 'quiz');
insert into public.resource_versions (id, teacher_id, resource_id, number, content)
values ('aaaaaaaa-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', 1, '{"v": 1}');
update public.resources set current_version_id = 'aaaaaaaa-0000-0000-0000-000000000006'
where id = 'aaaaaaaa-0000-0000-0000-000000000004';
insert into public.resource_chapters (resource_id, chapter_id, teacher_id)
values ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111');
insert into public.version_questions (version_id, question_id, teacher_id)
values ('aaaaaaaa-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111');

-- Curriculum references -------------------------------------------------------

select throws_ok(
  $$insert into public.courses (teacher_id, curriculum_course_id, title)
    values ('11111111-1111-1111-1111-111111111111', 'sk-63', 'Chemistry, no level')$$,
  '23514', null,
  'a curriculum course needs its level (10, 20 or 30)'
);
select throws_ok(
  $$insert into public.courses (teacher_id, curriculum_course_id, level, title)
    values ('11111111-1111-1111-1111-111111111111', 'sk-63', 11, 'Chemistry 11')$$,
  '23514', null,
  'levels are 10, 20 and 30'
);
select lives_ok(
  $$insert into public.chapters (teacher_id, course_id, title, source_kind, source_ref)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'One outcome', 'outcome', 'sk-526-162291')$$,
  'a chapter can be seeded from one outcome'
);
select throws_ok(
  $$insert into public.chapters (teacher_id, course_id, title, source_kind)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'No ref', 'unit')$$,
  '23514', null,
  'a seeded chapter names what it was seeded from'
);
select throws_ok(
  $$insert into public.chapters (teacher_id, course_id, title, source_kind, source_ref)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Custom', 'custom', 'sk-526-u1')$$,
  '23514', null,
  'a custom chapter has no curriculum source'
);

-- Approved versions never change ----------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.publications (teacher_id, version_id, channel)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000006', 'page')$$,
  '23514', null,
  'a draft version cannot be published'
);
select lives_ok(
  $$update public.resource_versions set content = '{"v": 2}' where id = 'aaaaaaaa-0000-0000-0000-000000000006'$$,
  'a draft version can be edited'
);
select lives_ok(
  $$update public.resource_versions set approved_at = now(), approved_by = '11111111-1111-1111-1111-111111111111'
    where id = 'aaaaaaaa-0000-0000-0000-000000000006'$$,
  'the teacher approves the version'
);
select throws_ok(
  $$update public.resource_versions set content = '{"v": 3}' where id = 'aaaaaaaa-0000-0000-0000-000000000006'$$,
  '23514', null,
  'an approved version cannot be edited'
);
select throws_ok(
  $$update public.resource_versions set approved_at = null, approved_by = null where id = 'aaaaaaaa-0000-0000-0000-000000000006'$$,
  '23514', null,
  'an approved version cannot be un-approved'
);
select throws_ok(
  $$delete from public.resource_versions where id = 'aaaaaaaa-0000-0000-0000-000000000006'$$,
  '23514', null,
  'an approved version cannot be deleted on its own'
);
select lives_ok(
  $$insert into public.publications (teacher_id, version_id, channel)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000006', 'page')$$,
  'an approved version can be published'
);
select lives_ok(
  $$insert into public.resource_versions (teacher_id, resource_id, number, content)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', 2, '{"v": 3}')$$,
  'an edit after approval is saved as the next version'
);
select throws_ok(
  $$insert into public.resource_versions (teacher_id, resource_id, number, content)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', 2, '{}')$$,
  '23505', null,
  'version numbers do not repeat within a resource'
);
reset role;

-- Templates ---------------------------------------------------------------------

insert into public.templates (id, teacher_id, kind, name)
values ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'exam', 'B''s midterm');
select throws_ok(
  $$update public.resources set template_id = 'bbbbbbbb-0000-0000-0000-000000000001' where id = 'aaaaaaaa-0000-0000-0000-000000000004'$$,
  '23503', null,
  'a resource cannot use another teacher''s template'
);

-- Live sessions -------------------------------------------------------------------

insert into public.live_sessions (id, teacher_id, course_id, code)
values ('aaaaaaaa-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'K7QM4P');
select throws_ok(
  $$insert into public.live_sessions (teacher_id, course_id, code)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'K7QM4P')$$,
  '23505', null,
  'a join code is unique among open sessions'
);
select throws_ok(
  $$insert into public.live_sessions (teacher_id, course_id, code)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'K7QM40')$$,
  '23514', null,
  'join codes leave out look-alike characters such as 0'
);
update public.live_sessions set state = 'ended', ended_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000010';
select lives_ok(
  $$insert into public.live_sessions (id, teacher_id, course_id, code)
    values ('aaaaaaaa-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'K7QM4P')$$,
  'a code can be reused once its session has ended'
);

insert into public.live_questions (id, teacher_id, session_id, question_id, position, content)
values ('aaaaaaaa-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000003', 1,
        '{"type": "mcq", "stem": "Which is an asset?", "options": [{"id": "a", "text": "Cash"}], "answer": {"correctId": "a"}, "marks": 1}');
insert into public.participants (id, teacher_id, session_id, name, token_hash)
values ('aaaaaaaa-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000011', 'Sam', repeat('a', 64));
insert into public.participants (id, teacher_id, session_id, name, token_hash)
values ('aaaaaaaa-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000010', 'Old', repeat('b', 64));
insert into public.answers (teacher_id, session_id, participant_id, live_question_id, response)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000011',
        'aaaaaaaa-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000012', '{"optionId": "b"}');

select throws_ok(
  $$insert into public.answers (teacher_id, session_id, participant_id, live_question_id, response)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000011',
            'aaaaaaaa-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000012', '{"optionId": "a"}')$$,
  '23505', null,
  'one answer per participant per live question'
);
select throws_ok(
  $$insert into public.answers (teacher_id, session_id, participant_id, live_question_id, response)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000011',
            'aaaaaaaa-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000012', '{"optionId": "a"}')$$,
  '23503', null,
  'a participant can only answer questions of their own session'
);

-- Difficulty appears only after 10 answers.
update public.questions set answer_count = 9, correct_count = 6 where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select is((select difficulty from public.questions where id = 'aaaaaaaa-0000-0000-0000-000000000003'), null, 'no difficulty under 10 answers');
update public.questions set answer_count = 10, correct_count = 7 where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select is((select difficulty from public.questions where id = 'aaaaaaaa-0000-0000-0000-000000000003'), 0.7::real, 'difficulty is the share answered correctly');

-- Deleting a course ---------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
delete from public.courses where id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;

select is(
  (select count(*)::int from public.chapters) + (select count(*)::int from public.resources)
    + (select count(*)::int from public.resource_versions) + (select count(*)::int from public.live_sessions)
    + (select count(*)::int from public.participants),
  0,
  'deleting a course deletes its chapters, resources, versions (approved too), sessions and students'
);
select results_eq(
  $$select chapter_id is null, retired from public.questions where id = 'aaaaaaaa-0000-0000-0000-000000000003'$$,
  $$values (true, true)$$,
  'its bank questions are kept, unlinked and retired'
);

select * from finish();
rollback;
