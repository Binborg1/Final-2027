-- Development step 5: Live mode. Sessions keep a whole-set clock, live questions keep
-- a snapshot of the question, teachers may remove students and change marks (and
-- nothing else on student rows), the rate-limit counters are server-only, and
-- set_live_marks() and end_live_session() work as the signed-in teacher.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'teacher-a@example.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'teacher-b@example.test', 'authenticated', 'authenticated');
insert into public.teachers (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Teacher A'),
  ('22222222-2222-2222-2222-222222222222', 'Teacher B');

insert into public.courses (id, teacher_id, curriculum_course_id, level, title)
values ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'sk-63', 10, 'Science 10');
insert into public.chapters (id, teacher_id, course_id, title)
values ('cccccccc-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 'Motion');
insert into public.questions (id, teacher_id, chapter_id, type, stem, options, answer, marks) values
  ('cccccccc-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000002',
   'mcq', 'Which force keeps a puck sliding?', '[{"id": "a", "text": "None"}, {"id": "b", "text": "Friction"}]', '{"correctId": "a"}', 1),
  ('cccccccc-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000002',
   'short', 'What does a flat position-time line mean?', null, '{"rubric": [{"text": "At rest", "marks": 3}]}', 3);

insert into public.live_sessions (id, teacher_id, course_id, chapter_id, code, title)
values ('cccccccc-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000002', 'LIVE22', 'Motion check');

-- Sessions and live questions ---------------------------------------------------------

select results_eq(
  $$select timer_s, ask_student_no, state, rev from public.live_sessions where id = 'cccccccc-0000-0000-0000-000000000010'$$,
  $$values (300, true, 'lobby'::text, 0)$$,
  'a new session runs 5 minutes for the whole set, asks for the student number and starts in the lobby'
);
select throws_ok(
  $$insert into public.live_questions (teacher_id, session_id, position, content)
    values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000010', 9,
            '{"type": "fill", "stem": "Speed is ___", "answer": {"answer": "distance over time"}, "marks": 1}')$$,
  '23514', null,
  'a live question must be a type a phone can answer'
);
select throws_ok(
  $$insert into public.live_questions (teacher_id, session_id, position, content)
    values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000010', 9,
            '{"type": "tf", "stem": "Speed is a vector.", "marks": 1}')$$,
  '23514', null,
  'a live question keeps its answer key'
);

insert into public.live_questions (id, teacher_id, session_id, question_id, position, content) values
  ('cccccccc-0000-0000-0000-000000000011', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000010',
   'cccccccc-0000-0000-0000-000000000003', 1,
   '{"type": "mcq", "stem": "Which force keeps a puck sliding?", "options": [{"id": "a", "text": "None"}, {"id": "b", "text": "Friction"}], "answer": {"correctId": "a"}, "marks": 1}'),
  ('cccccccc-0000-0000-0000-000000000012', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000010',
   'cccccccc-0000-0000-0000-000000000004', 2,
   '{"type": "short", "stem": "What does a flat position-time line mean?", "answer": {"rubric": [{"text": "At rest", "marks": 3}]}, "marks": 3}'),
  ('cccccccc-0000-0000-0000-000000000013', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000010',
   null, 3,
   '{"type": "calc", "stem": "A cart moves 24 m in 6 s. Speed in m/s?", "answer": {"answer": "4 m/s"}, "marks": 2}');

select throws_ok(
  $$insert into public.live_questions (teacher_id, session_id, position, content)
    values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000010', 1,
            '{"type": "tf", "stem": "Speed is a vector.", "answer": {"tf": false}, "marks": 1}')$$,
  '23505', null,
  'two live questions cannot share a position'
);
select throws_ok(
  $$update public.live_sessions set state = 'open' where id = 'cccccccc-0000-0000-0000-000000000010'$$,
  '23514', null,
  'a session cannot open without its clock'
);
select throws_ok(
  $$update public.live_sessions set state = 'open', opened_at = now(), ends_at = now() - interval '1 minute'
    where id = 'cccccccc-0000-0000-0000-000000000010'$$,
  '23514', null,
  'a session cannot end before it opens'
);

update public.live_sessions set state = 'open', opened_at = now(), ends_at = now() + interval '5 minutes'
where id = 'cccccccc-0000-0000-0000-000000000010';

select throws_ok(
  $$update public.live_sessions set state = 'closed' where id = 'cccccccc-0000-0000-0000-000000000010'$$,
  '23514', null,
  'a closed session records when it closed'
);

-- The server adds students and their answers ------------------------------------------

set local role service_role;
insert into public.participants (id, teacher_id, session_id, name, token_hash) values
  ('cccccccc-0000-0000-0000-000000000020', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000010', 'Sam', repeat('a', 64)),
  ('cccccccc-0000-0000-0000-000000000021', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000010', 'Ari', repeat('b', 64)),
  ('cccccccc-0000-0000-0000-000000000022', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000010', 'Kai', repeat('c', 64));
insert into public.answers (id, teacher_id, session_id, participant_id, live_question_id, response, correct, marks, marked_by) values
  ('cccccccc-0000-0000-0000-000000000030', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000010',
   'cccccccc-0000-0000-0000-000000000020', 'cccccccc-0000-0000-0000-000000000011', '{"choice": "a"}', true, 1, 'code'),
  ('cccccccc-0000-0000-0000-000000000031', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000010',
   'cccccccc-0000-0000-0000-000000000021', 'cccccccc-0000-0000-0000-000000000011', '{"choice": "b"}', false, 0, 'code');
insert into public.answers (id, teacher_id, session_id, participant_id, live_question_id, response) values
  ('cccccccc-0000-0000-0000-000000000032', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000010',
   'cccccccc-0000-0000-0000-000000000020', 'cccccccc-0000-0000-0000-000000000012', '{"text": "It is at rest"}'),
  ('cccccccc-0000-0000-0000-000000000033', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000010',
   'cccccccc-0000-0000-0000-000000000021', 'cccccccc-0000-0000-0000-000000000012', '{"text": "It moves"}');
reset role;

-- What a teacher may change on student rows ------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$update public.answers set marks = 1 where id = 'cccccccc-0000-0000-0000-000000000030'$$,
  'a teacher can change a mark'
);
select throws_ok(
  $$update public.answers set response = '{}' where id = 'cccccccc-0000-0000-0000-000000000030'$$,
  '42501', null,
  'a teacher cannot change what a student answered'
);
select throws_ok(
  $$select public.set_live_marks('cccccccc-0000-0000-0000-000000000010', 'teacher', '[]')$$,
  '23514', null,
  'marks cannot change while students are still answering'
);
select lives_ok(
  $$delete from public.participants where id = 'cccccccc-0000-0000-0000-000000000022'$$,
  'a teacher removes one of their own students'
);

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
delete from public.participants where teacher_id = '11111111-1111-1111-1111-111111111111';
update public.answers set marks = 0 where id = 'cccccccc-0000-0000-0000-000000000030';
reset role;

select is(
  (select count(*)::int from public.participants where session_id = 'cccccccc-0000-0000-0000-000000000010'),
  2,
  'teacher B removes none of teacher A''s students'
);
select is(
  (select marks::int from public.answers where id = 'cccccccc-0000-0000-0000-000000000030'),
  1,
  'teacher B changes none of teacher A''s marks'
);

-- Rate limits ----------------------------------------------------------------------------

set local role anon;
select throws_ok($$select public.rate_hit('join-ip:x', 10)$$, '42501', null, 'a browser cannot count rate-limit hits');
reset role;
set local role authenticated;
select throws_ok($$select public.rate_hit('join-ip:x', 10)$$, '42501', null, 'a teacher cannot count rate-limit hits');
reset role;

set local role service_role;
select results_eq(
  $$select public.rate_hit('test:a', 3) from generate_series(1, 4)$$,
  $$values (true), (true), (true), (false)$$,
  'the server allows 3 hits in a window and refuses the fourth'
);
select is(public.rate_hit('test:b', 3), true, 'each key counts on its own');
reset role;
select is(
  (select count(*)::int from cron.job where jobname = 'funza-prune-rate-limits'),
  1,
  'old rate-limit windows are cleared on a schedule'
);

-- Marks ------------------------------------------------------------------------------------

update public.live_sessions set state = 'closed', closed_at = now(), ends_at = now()
where id = 'cccccccc-0000-0000-0000-000000000010';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(
  public.set_live_marks('cccccccc-0000-0000-0000-000000000010', 'ai',
    '[{"id": "cccccccc-0000-0000-0000-000000000032", "marks": 5}, {"id": "cccccccc-0000-0000-0000-000000000033", "marks": 1}]'),
  2,
  'Funza marks the two short answers'
);
select results_eq(
  $$select marks::int, ai_marks::int, marked_by, correct from public.answers where id = 'cccccccc-0000-0000-0000-000000000032'$$,
  $$values (3, 3, 'ai'::text, true)$$,
  'a mark is capped at the question''s marks, and full marks count as correct'
);
select results_eq(
  $$select marks::int, ai_marks::int, marked_by, correct from public.answers where id = 'cccccccc-0000-0000-0000-000000000033'$$,
  $$values (1, 1, 'ai'::text, false)$$,
  'part marks are not correct'
);
select is(
  public.set_live_marks('cccccccc-0000-0000-0000-000000000010', 'teacher', '[{"id": "cccccccc-0000-0000-0000-000000000033", "marks": 3}]'),
  1,
  'the teacher changes a mark'
);
select results_eq(
  $$select marks::int, ai_marks::int, marked_by, correct from public.answers where id = 'cccccccc-0000-0000-0000-000000000033'$$,
  $$values (3, 1, 'teacher'::text, true)$$,
  'the teacher''s mark is kept beside Funza''s'
);
select is(
  public.set_live_marks('cccccccc-0000-0000-0000-000000000010', 'ai', '[{"id": "cccccccc-0000-0000-0000-000000000033", "marks": 0}]'),
  1,
  'Funza marks the answer again'
);
select results_eq(
  $$select marks::int, ai_marks::int, marked_by from public.answers where id = 'cccccccc-0000-0000-0000-000000000033'$$,
  $$values (3, 0, 'teacher'::text)$$,
  'Funza never overwrites a mark the teacher changed'
);
select is(
  public.set_live_marks('cccccccc-0000-0000-0000-000000000010', 'undo', '[{"id": "cccccccc-0000-0000-0000-000000000033"}]'),
  1,
  'the teacher undoes their change'
);
select results_eq(
  $$select marks::int, ai_marks::int, marked_by, correct from public.answers where id = 'cccccccc-0000-0000-0000-000000000033'$$,
  $$values (0, 0, 'ai'::text, false)$$,
  'Undo goes back to Funza''s mark'
);
select throws_ok(
  $$select public.set_live_marks('cccccccc-0000-0000-0000-000000000010', 'robot', '[]')$$,
  '22023', null,
  'only Funza, the teacher, code or Undo can mark'
);

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok(
  $$select public.set_live_marks('cccccccc-0000-0000-0000-000000000010', 'teacher', '[{"id": "cccccccc-0000-0000-0000-000000000033", "marks": 0}]')$$,
  '23514', null,
  'teacher B cannot mark teacher A''s answers'
);
select throws_ok(
  $$select public.end_live_session('cccccccc-0000-0000-0000-000000000010')$$,
  'P0002', null,
  'teacher B cannot end teacher A''s session'
);
reset role;

set local role anon;
select throws_ok(
  $$select public.end_live_session('cccccccc-0000-0000-0000-000000000010')$$,
  '42501', null,
  'a browser without a session cannot end a session'
);
reset role;

-- Ending a session ----------------------------------------------------------------------

update public.live_sessions
set state = 'revealed', revealed_at = now(), current_question_id = 'cccccccc-0000-0000-0000-000000000011'
where id = 'cccccccc-0000-0000-0000-000000000010';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$select public.end_live_session('cccccccc-0000-0000-0000-000000000010')$$,
  'the teacher ends the session'
);
reset role;

select results_eq(
  $$select answer_count, correct_count from public.live_questions
    where session_id = 'cccccccc-0000-0000-0000-000000000010' order by position$$,
  $$values (2, 1), (2, 1), (0, 0)$$,
  'each question keeps its answer and correct counts'
);
select results_eq(
  $$select answer_count, correct_count, times_used, last_used_at is not null from public.questions
    where id = 'cccccccc-0000-0000-0000-000000000003'$$,
  $$values (2, 1, 1, true)$$,
  'a revealed session adds its counts to the bank question'
);
select results_eq(
  $$select state, ended_at is not null, current_question_id is null, rev from public.live_sessions
    where id = 'cccccccc-0000-0000-0000-000000000010'$$,
  $$values ('ended'::text, true, true, 1)$$,
  'the session is ended'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$select public.end_live_session('cccccccc-0000-0000-0000-000000000010')$$,
  'ending it again does nothing'
);
select throws_ok(
  $$select public.set_live_marks('cccccccc-0000-0000-0000-000000000010', 'teacher', '[{"id": "cccccccc-0000-0000-0000-000000000033", "marks": 3}]')$$,
  '23514', null,
  'marks cannot change once the session has ended'
);
reset role;
select is(
  (select answer_count from public.questions where id = 'cccccccc-0000-0000-0000-000000000003'),
  2,
  'ending twice counts nothing twice'
);

-- A session ended without Reveal teaches the bank nothing.
insert into public.live_sessions (id, teacher_id, course_id, code, state, opened_at, ends_at)
values ('cccccccc-0000-0000-0000-000000000040', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001',
        'LIVE33', 'open', now(), now() + interval '3 minutes');
insert into public.live_questions (id, teacher_id, session_id, question_id, position, content)
values ('cccccccc-0000-0000-0000-000000000041', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000040',
        'cccccccc-0000-0000-0000-000000000003', 1,
        '{"type": "mcq", "stem": "Which force keeps a puck sliding?", "options": [{"id": "a", "text": "None"}], "answer": {"correctId": "a"}, "marks": 1}');
insert into public.participants (id, teacher_id, session_id, name, token_hash)
values ('cccccccc-0000-0000-0000-000000000042', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000040', 'Lee', repeat('d', 64));
insert into public.answers (teacher_id, session_id, participant_id, live_question_id, response, correct, marks, marked_by)
values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000040', 'cccccccc-0000-0000-0000-000000000042',
        'cccccccc-0000-0000-0000-000000000041', '{"choice": "a"}', true, 1, 'code');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok($$select public.end_live_session('cccccccc-0000-0000-0000-000000000040')$$, 'a session can end without Reveal');
reset role;
select results_eq(
  $$select answer_count, correct_count from public.live_questions where id = 'cccccccc-0000-0000-0000-000000000041'$$,
  $$values (1, 1)$$,
  'a session ended without Reveal still keeps its own counts'
);
select is(
  (select answer_count from public.questions where id = 'cccccccc-0000-0000-0000-000000000003'),
  2,
  'but adds nothing to the bank'
);

-- Deleting from Prepare keeps live history -----------------------------------------------

delete from public.questions where id = 'cccccccc-0000-0000-0000-000000000003';
select results_eq(
  $$select question_id is null, content ->> 'stem' from public.live_questions where id = 'cccccccc-0000-0000-0000-000000000011'$$,
  $$values (true, 'Which force keeps a puck sliding?'::text)$$,
  'deleting a bank question keeps the live question and its snapshot'
);
select is(
  (select count(*)::int from public.answers where live_question_id = 'cccccccc-0000-0000-0000-000000000011'),
  2,
  'and its answers'
);

delete from public.chapters where id = 'cccccccc-0000-0000-0000-000000000002';
select is(
  (select chapter_id from public.live_sessions where id = 'cccccccc-0000-0000-0000-000000000010'),
  null,
  'deleting a chapter keeps its sessions, unlinked'
);

select * from finish();
rollback;
