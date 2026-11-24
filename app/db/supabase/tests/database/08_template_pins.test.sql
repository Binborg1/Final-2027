-- Pinned questions: a pin names its template section (0 to 7), pins a question of the
-- same teacher to a template of the same teacher, and teachers see only their own.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'teacher-a@example.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'teacher-b@example.test', 'authenticated', 'authenticated');
insert into public.teachers (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Teacher A'),
  ('22222222-2222-2222-2222-222222222222', 'Teacher B');
insert into public.courses (id, teacher_id, curriculum_course_id, level, title)
values ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'sk-63', 10, 'Science 10');
insert into public.chapters (id, teacher_id, course_id, title)
values ('eeeeeeee-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001', 'Motion');
insert into public.questions (id, teacher_id, chapter_id, type, stem, answer, marks) values
  ('eeeeeeee-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000002',
   'short', 'What does a flat position-time line mean?', '{"rubric": [{"text": "At rest", "marks": 3}]}', 3);
insert into public.templates (id, teacher_id, kind, name, format) values
  ('eeeeeeee-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'exam', 'Unit test', '{"v": 1}'),
  ('eeeeeeee-0000-0000-0000-000000000012', '22222222-2222-2222-2222-222222222222', 'exam', 'B''s test', '{"v": 1}');

insert into public.template_pins (template_id, question_id, teacher_id, section)
values ('eeeeeeee-0000-0000-0000-000000000011', 'eeeeeeee-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 1);
select is((select section::int from public.template_pins where template_id = 'eeeeeeee-0000-0000-0000-000000000011'), 1, 'a pin names its section');
select throws_ok(
  $$update public.template_pins set section = 8 where template_id = 'eeeeeeee-0000-0000-0000-000000000011'$$,
  '23514', null, 'a template has at most 8 sections');
select throws_ok(
  $$insert into public.template_pins (template_id, question_id, teacher_id) values
    ('eeeeeeee-0000-0000-0000-000000000012', 'eeeeeeee-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111')$$,
  '23503', null, 'a question cannot be pinned to another teacher''s template');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.template_pins), 0, 'teacher B sees none of teacher A''s pins');
with gone as (delete from public.template_pins returning 1)
select is((select count(*)::int from gone), 0, 'teacher B cannot remove teacher A''s pins');
reset role;

delete from public.templates where id = 'eeeeeeee-0000-0000-0000-000000000011';
select is((select count(*)::int from public.template_pins), 0, 'deleting a template removes its pins');
select is((select count(*)::int from public.questions where id = 'eeeeeeee-0000-0000-0000-000000000003'), 1, 'the pinned question stays in the bank');

select * from finish();
rollback;
