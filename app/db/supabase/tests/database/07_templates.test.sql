-- Templates: four categories, a short summary, example names only, a JSON format of a
-- reasonable size, teachers see and change only their own (plus built-in ones), and a
-- resource uses only a template of its own category.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'teacher-a@example.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'teacher-b@example.test', 'authenticated', 'authenticated');
insert into public.teachers (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Teacher A'),
  ('22222222-2222-2222-2222-222222222222', 'Teacher B');
insert into public.courses (id, teacher_id, curriculum_course_id, level, title)
values ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'sk-63', 10, 'Science 10');

-- Categories, summary, learned_from, format ---------------------------------------------

insert into public.templates (id, teacher_id, kind, name, summary, learned_from, format) values
  ('dddddddd-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'quiz', 'Weekly quiz', 'Two parts.', '[{"kind": "file", "name": "quiz.pdf"}]', '{"v": 1}'),
  ('dddddddd-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'exam', 'Unit test', '', '[]', '{"v": 1}'),
  ('dddddddd-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'notes', 'Cornell notes', '', '[]', '{"v": 1}'),
  ('dddddddd-0000-0000-0000-000000000014', '11111111-1111-1111-1111-111111111111', 'slides', 'Lesson deck', '', '[]', '{"v": 1}');
select is((select count(*)::int from public.templates where teacher_id = '11111111-1111-1111-1111-111111111111'), 4,
  'a template can be for quizzes and tests, exams, notes or slides');
select throws_ok(
  $$insert into public.templates (teacher_id, kind, name) values ('11111111-1111-1111-1111-111111111111', 'test', 'Nope')$$,
  '23514', null, 'tests share the quiz category');
select throws_ok(
  $$insert into public.templates (teacher_id, kind, name) values ('11111111-1111-1111-1111-111111111111', 'presentation', 'Nope')$$,
  '23514', null, 'slides are the slides category');
select throws_ok(
  $$insert into public.templates (teacher_id, kind, name, summary) values ('11111111-1111-1111-1111-111111111111', 'quiz', 'Long', repeat('x', 161))$$,
  '23514', null, 'a summary is one short sentence');
select throws_ok(
  $$insert into public.templates (teacher_id, kind, name, learned_from) values ('11111111-1111-1111-1111-111111111111', 'quiz', 'Bad', '{"name": "x"}')$$,
  '23514', null, 'learned_from is a list');
select throws_ok(
  $$insert into public.templates (teacher_id, kind, name, learned_from) values ('11111111-1111-1111-1111-111111111111', 'quiz', 'Many',
    '[{"name":"1"},{"name":"2"},{"name":"3"},{"name":"4"},{"name":"5"},{"name":"6"}]')$$,
  '23514', null, 'a template is learned from at most five examples');
select throws_ok(
  $$insert into public.templates (teacher_id, kind, name, format) values ('11111111-1111-1111-1111-111111111111', 'quiz', 'Bad', '[1, 2]')$$,
  '23514', null, 'a format is a JSON object');
select throws_ok(
  $$insert into public.templates (teacher_id, kind, name, format) values ('11111111-1111-1111-1111-111111111111', 'quiz', 'Huge',
    jsonb_build_object('pad', repeat('x', 40001)))$$,
  '23514', null, 'a format has a size limit');

-- Who can see and change a template -----------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.templates), 0, 'teacher B sees none of teacher A''s templates');
with changed as (update public.templates set name = 'Mine now' returning 1)
select is((select count(*)::int from changed), 0, 'teacher B cannot change teacher A''s templates');
with gone as (delete from public.templates returning 1)
select is((select count(*)::int from gone), 0, 'teacher B cannot delete teacher A''s templates');
select throws_ok(
  $$insert into public.templates (teacher_id, kind, name) values ('11111111-1111-1111-1111-111111111111', 'quiz', 'Planted')$$,
  '42501', null, 'teacher B cannot add a template for teacher A');
select throws_ok(
  $$insert into public.templates (kind, name, built_in) values ('exam', 'Fake built-in', true)$$,
  '42501', null, 'a teacher cannot add a built-in template');
reset role;

-- A resource uses a template of its own category ----------------------------------------

insert into public.resources (id, teacher_id, course_id, title, kind) values
  ('dddddddd-0000-0000-0000-000000000021', '11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-000000000001', 'Test on motion', 'test');
update public.resources set template_id = 'dddddddd-0000-0000-0000-000000000011' where id = 'dddddddd-0000-0000-0000-000000000021';
select is((select template_id from public.resources where id = 'dddddddd-0000-0000-0000-000000000021'),
  'dddddddd-0000-0000-0000-000000000011'::uuid, 'a test may use a quizzes-and-tests template');
select throws_ok(
  $$update public.resources set template_id = 'dddddddd-0000-0000-0000-000000000012' where id = 'dddddddd-0000-0000-0000-000000000021'$$,
  '23503', null, 'a test cannot use an exam template');

delete from public.templates where id = 'dddddddd-0000-0000-0000-000000000011';
select is((select template_id from public.resources where id = 'dddddddd-0000-0000-0000-000000000021'), null,
  'deleting a template leaves the materials made from it, without the link');

select * from finish();
rollback;
