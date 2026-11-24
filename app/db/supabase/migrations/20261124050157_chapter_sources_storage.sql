-- Chapter sources in Supabase Storage (development step 4, item 2).
--
-- A private bucket for the notes, PDFs and past exams a teacher attaches to a
-- chapter. Each teacher's files live under a folder named after their id
-- ("<teacher id>/<chapter id>/<file>"), and row-level security on storage.objects
-- lets a teacher reach only their own folder. The extracted text is kept in
-- public.sources, so Funza reads it once.
--
-- Only adds things, so the app already deployed keeps working while this is applied.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sources', 'sources', false, 20971520, array['application/pdf', 'text/plain', 'text/markdown'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Teachers add files to their own sources folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sources' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Teachers read their own source files" on storage.objects
  for select to authenticated
  using (bucket_id = 'sources' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Teachers delete their own source files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'sources' and (storage.foldername(name))[1] = (select auth.uid())::text);
