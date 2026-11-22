-- Student data is deleted 30 days after a session (NFR-15, Q14).
--
-- Every night the job below finds the sessions that ended (or, if never ended,
-- started) more than 30 days ago. For each one it keeps the anonymous counts per
-- question on live_questions, then deletes the participants, which takes their
-- names, student numbers and answers with them (answers cascade). A session left
-- open that long is ended too.

create extension if not exists pg_cron with schema pg_catalog;

create function public.purge_student_data(older_than interval default interval '30 days') returns integer
language plpgsql
set search_path = ''
as $$
declare
  due uuid[];
begin
  select coalesce(array_agg(s.id), '{}') into due
  from public.live_sessions s
  where s.students_purged_at is null
    and coalesce(s.ended_at, s.created_at) < now() - older_than;

  if cardinality(due) = 0 then
    return 0;
  end if;

  update public.live_questions lq
  set answer_count = c.answers, correct_count = c.correct
  from (
    select q.id, count(a.id)::integer as answers, (count(a.id) filter (where a.correct))::integer as correct
    from public.live_questions q
    left join public.answers a on a.live_question_id = q.id
    where q.session_id = any (due)
    group by q.id
  ) c
  where lq.id = c.id;

  delete from public.participants p where p.session_id = any (due);

  update public.live_sessions s
  set students_purged_at = now(),
      state = 'ended',
      ended_at = coalesce(s.ended_at, now()),
      current_question_id = null
  where s.id = any (due);

  return cardinality(due);
end;
$$;

comment on function public.purge_student_data(interval) is
  'Deletes student names, numbers and answers of sessions older than the given age (30 days by default), keeping anonymous counts per question. Run nightly by pg_cron.';

-- Only the database owner (and so the cron job) may run it.
revoke execute on function public.purge_student_data(interval) from public, anon, authenticated;

-- 08:15 UTC is 02:15 in Saskatchewan, which keeps Central Standard Time all year.
select cron.schedule('funza-purge-student-data', '15 8 * * *', $$select public.purge_student_data()$$);

-- pg_cron keeps every run's log forever; keep two weeks.
select cron.schedule(
  'funza-prune-cron-history',
  '30 8 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '14 days'$$
);
