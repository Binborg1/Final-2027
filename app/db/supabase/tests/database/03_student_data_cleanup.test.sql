-- Student names, numbers and answers are deleted 30 days after a session (NFR-15).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role)
values ('11111111-1111-1111-1111-111111111111', 'teacher-a@example.test', 'authenticated', 'authenticated');
insert into public.teachers (id, name) values ('11111111-1111-1111-1111-111111111111', 'Teacher A');
insert into public.courses (id, teacher_id, title)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Science 10');
insert into public.chapters (id, teacher_id, course_id, title)
values ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Motion');
insert into public.questions (id, teacher_id, chapter_id, type, stem, answer)
values ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002',
        'tf', 'Speed is a vector.', '{"value": false}');

-- An old session (ended 31 days ago), a recent one (5 days ago), and one left open for 40 days.
insert into public.live_sessions (id, teacher_id, course_id, code, state, created_at, ended_at) values
  ('aaaaaaaa-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
   'AAAAAA', 'ended', now() - interval '31 days', now() - interval '31 days'),
  ('aaaaaaaa-0000-0000-0000-000000000020', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
   'BBBBBB', 'ended', now() - interval '5 days', now() - interval '5 days'),
  ('aaaaaaaa-0000-0000-0000-000000000030', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
   'CCCCCC', 'lobby', now() - interval '40 days', null);

insert into public.live_questions (id, teacher_id, session_id, question_id, position) values
  ('aaaaaaaa-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000003', 1),
  ('aaaaaaaa-0000-0000-0000-000000000021', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000020', 'aaaaaaaa-0000-0000-0000-000000000003', 1);

insert into public.participants (id, teacher_id, session_id, name, student_no, token_hash) values
  ('aaaaaaaa-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000010', 'Sam', '200123', repeat('a', 64)),
  ('aaaaaaaa-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000010', 'Ari', null, repeat('b', 64)),
  ('aaaaaaaa-0000-0000-0000-000000000022', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000020', 'Kai', null, repeat('c', 64));

insert into public.answers (teacher_id, session_id, participant_id, live_question_id, response, correct) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000011', '{"value": false}', true),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000011', '{"value": true}', false),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000020', 'aaaaaaaa-0000-0000-0000-000000000022', 'aaaaaaaa-0000-0000-0000-000000000021', '{"value": false}', true);

select is(public.purge_student_data(), 2, 'the job purges the two sessions older than 30 days');

select is(
  (select count(*)::int from public.participants where session_id = 'aaaaaaaa-0000-0000-0000-000000000010'),
  0,
  'names and student numbers of the old session are deleted'
);
select is(
  (select count(*)::int from public.answers where session_id = 'aaaaaaaa-0000-0000-0000-000000000010'),
  0,
  'answers of the old session are deleted'
);
select results_eq(
  $$select answer_count, correct_count from public.live_questions where id = 'aaaaaaaa-0000-0000-0000-000000000011'$$,
  $$values (2, 1)$$,
  'anonymous counts per question are kept'
);
select is(
  (select count(*)::int from public.answers where session_id = 'aaaaaaaa-0000-0000-0000-000000000020'),
  1,
  'a recent session keeps its answers'
);
select results_eq(
  $$select state, ended_at is not null, students_purged_at is not null from public.live_sessions where id = 'aaaaaaaa-0000-0000-0000-000000000030'$$,
  $$values ('ended'::text, true, true)$$,
  'a session left open for over 30 days is ended and purged'
);
select is(public.purge_student_data(), 0, 'running it again purges nothing');

select is(
  (select count(*)::int from cron.job where jobname = 'funza-purge-student-data' and schedule = '15 8 * * *'),
  1,
  'the clean-up runs nightly'
);

set local role authenticated;
select throws_ok('select public.purge_student_data()', '42501', null, 'teachers cannot run the clean-up themselves');
reset role;

select * from finish();
rollback;
