-- Chapter sources: a private Storage bucket where each teacher reaches only their own folder.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'teacher-a@example.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'teacher-b@example.test', 'authenticated', 'authenticated');

select is((select public from storage.buckets where id = 'sources'), false, 'the sources bucket is private');
select is((select file_size_limit from storage.buckets where id = 'sources'), 20971520::bigint, 'files are at most 20 MB');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('sources', '11111111-1111-1111-1111-111111111111/chapter/notes.pdf')$$,
  'a teacher can add a file to their own folder'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('sources', '22222222-2222-2222-2222-222222222222/chapter/notes.pdf')$$,
  '42501', null,
  'a teacher can''t add a file to another teacher''s folder'
);

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'sources'),
  0,
  'another teacher can''t see the file'
);

set local role anon;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'sources'),
  0,
  'a browser with no session sees nothing'
);

select * from finish();
rollback;
