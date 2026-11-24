-- Who can see what (NFR-9). Teacher B must not read or change teacher A's rows,
-- a browser without a session gets nothing, and student rows and AI usage are
-- written only by the server.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'teacher-a@example.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'teacher-b@example.test', 'authenticated', 'authenticated');

-- The shape of the schema ---------------------------------------------------

select is(
  (select count(*)::int from pg_tables where schemaname = 'public'),
  19,
  'the schema has 15 tables, 3 join tables and the rate-limit counters'
);
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'row-level security is on for every table'
);
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and column_name = 'teacher_id'),
  17,
  'every table but teachers (whose id is the teacher) and the rate-limit counters carries teacher_id'
);

-- A built-in template, added by the database owner.
insert into public.templates (id, kind, name, built_in)
values ('77777777-0000-0000-0000-000000000001', 'exam', 'Quiz', true);

-- A browser without a session -------------------------------------------------

set local role anon;
select throws_ok('select count(*) from public.teachers', '42501', null, 'anon cannot read teachers');
select throws_ok('select count(*) from public.courses', '42501', null, 'anon cannot read courses');
select throws_ok('select count(*) from public.questions', '42501', null, 'anon cannot read the question bank');
select throws_ok('select count(*) from public.live_sessions', '42501', null, 'anon cannot read live sessions');
select throws_ok('select count(*) from public.participants', '42501', null, 'anon cannot read participants');
select throws_ok('select count(*) from public.answers', '42501', null, 'anon cannot read answers');
select throws_ok('select count(*) from public.templates', '42501', null, 'anon cannot read templates');
select throws_ok('select count(*) from public.rate_limits', '42501', null, 'anon cannot read the rate-limit counters');
reset role;

-- Teacher A builds a course -------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.teachers (id, name) values ('11111111-1111-1111-1111-111111111111', 'Teacher A')$$,
  'a teacher creates their own row on first sign-in'
);
select throws_ok(
  $$insert into public.teachers (id, name) values ('22222222-2222-2222-2222-222222222222', 'Not mine')$$,
  '42501', null,
  'a teacher cannot create a row for someone else'
);

insert into public.courses (id, teacher_id, curriculum_course_id, level, title)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'sk-63', 30, 'Chemistry 30');
insert into public.chapters (id, teacher_id, course_id, title, source_kind, source_ref, outcome_refs)
values ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001',
        'Unit 1', 'unit', 'sk-63-u110469', array['sk-63-162290']);
insert into public.sources (teacher_id, chapter_id, kind, title, text)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', 'notes', 'My notes', 'Typed notes');
insert into public.questions (id, teacher_id, chapter_id, type, stem, answer, outcome_ref)
values ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002',
        'tf', 'Water boils at 100 °C at sea level.', '{"value": true}', 'sk-63-162290');
insert into public.resources (id, teacher_id, course_id, title, kind)
values ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Quiz 1', 'quiz');
insert into public.resource_versions (teacher_id, resource_id, number, content)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', 1, '{}');
insert into public.live_sessions (id, teacher_id, course_id, code)
values ('aaaaaaaa-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'K7QM4P');

select is((select count(*)::int from public.courses), 1, 'teacher A sees their course');
select is((select count(*)::int from public.templates), 1, 'teacher A sees the built-in template');

-- Student rows, AI usage and Google tokens are written only by the server.
select throws_ok(
  $$insert into public.participants (teacher_id, session_id, name, token_hash)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000005', 'Sam', repeat('a', 64))$$,
  '42501', null,
  'a teacher cannot write participants'
);
select throws_ok(
  $$insert into public.ai_usage (teacher_id, task, model) values ('11111111-1111-1111-1111-111111111111', 'draft', 'gemini')$$,
  '42501', null,
  'a teacher cannot write AI usage'
);
select throws_ok(
  $$select refresh_token from public.google_connections$$,
  '42501', null,
  'a teacher cannot read a stored Google refresh token'
);
select lives_ok($$select google_email from public.google_connections$$, 'a teacher can read which Google account is connected');
select throws_ok(
  $$insert into public.templates (kind, name, built_in) values ('exam', 'Fake built-in', true)$$,
  '42501', null,
  'a teacher cannot add a built-in template'
);
select throws_ok('select count(*) from public.rate_limits', '42501', null, 'a teacher cannot read the rate-limit counters');
reset role;

-- The server writes a student and an AI usage row with the secret key.
set local role service_role;
insert into public.participants (teacher_id, session_id, name, token_hash)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000005', 'Sam', repeat('a', 64));
insert into public.ai_usage (teacher_id, task, model) values ('11111111-1111-1111-1111-111111111111', 'draft', 'gemini');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.participants), 1, 'teacher A reads their own participants');
select is((select count(*)::int from public.ai_usage), 1, 'teacher A reads their own AI usage');

-- Teacher B sees none of it ---------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into public.teachers (id, name) values ('22222222-2222-2222-2222-222222222222', 'Teacher B');

select is((select count(*)::int from public.teachers), 1, 'teacher B sees only their own teacher row');
select is((select count(*)::int from public.courses), 0, 'teacher B sees none of A''s courses');
select is((select count(*)::int from public.chapters), 0, 'teacher B sees none of A''s chapters');
select is((select count(*)::int from public.sources), 0, 'teacher B sees none of A''s sources');
select is((select count(*)::int from public.questions), 0, 'teacher B sees none of A''s bank');
select is((select count(*)::int from public.resource_versions), 0, 'teacher B sees none of A''s versions');
select is((select count(*)::int from public.live_sessions), 0, 'teacher B sees none of A''s sessions');
select is((select count(*)::int from public.participants), 0, 'teacher B sees none of A''s students');
select is((select count(*)::int from public.ai_usage), 0, 'teacher B sees none of A''s AI usage');

with changed as (update public.courses set title = 'Taken' returning 1)
select is(count(*)::int, 0, 'teacher B cannot rename A''s course') from changed;
with removed as (delete from public.courses returning 1)
select is(count(*)::int, 0, 'teacher B cannot delete A''s course') from removed;
with changed as (update public.templates set name = 'Changed' where built_in returning 1)
select is(count(*)::int, 0, 'teacher B cannot change a built-in template') from changed;

select throws_ok(
  $$insert into public.courses (teacher_id, title) values ('11111111-1111-1111-1111-111111111111', 'Planted')$$,
  '42501', null,
  'teacher B cannot create a course owned by A'
);
select throws_ok(
  $$insert into public.chapters (teacher_id, course_id, title)
    values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001', 'Planted')$$,
  '23503', null,
  'teacher B cannot hang a chapter under A''s course'
);
select throws_ok(
  $$insert into public.resources (teacher_id, course_id, title, kind)
    values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001', 'Planted', 'quiz')$$,
  '23503', null,
  'teacher B cannot add a resource to A''s course'
);
reset role;

select is(
  (select title from public.courses where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'Chemistry 30',
  'A''s course is unchanged'
);

select * from finish();
rollback;
