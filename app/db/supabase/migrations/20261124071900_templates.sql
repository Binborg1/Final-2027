-- Templates (FR-20, FR-21), built early. A template is a teacher's own format: how
-- their quizzes and tests, exams, notes or slides are laid out, learned from an
-- example or set up by hand. Funza follows it to make new materials on any chapter.
--
-- 1. Four categories: 'quiz' (quizzes and tests), 'exam', 'notes', 'slides'.
-- 2. summary: one sentence about the template, shown in lists. learned_from: the
--    names of the examples it was learned from (never their text; files aren't kept).
-- 3. format must be a JSON object of a reasonable size; the app checks its shape.
-- 4. A resource uses only a template of its own category (a test may use a quiz
--    template; slides are resources of kind 'presentation').
--
-- Only adds things (and widens one check), so the deployed app keeps working.

alter table public.templates
  drop constraint templates_kind_check,
  add constraint templates_kind_check check (kind in ('quiz', 'exam', 'notes', 'slides')),
  add column summary text not null default '' check (char_length(summary) <= 160),
  add column learned_from jsonb not null default '[]'
    check (case when jsonb_typeof(learned_from) = 'array' then jsonb_array_length(learned_from) <= 5 else false end),
  add constraint templates_format_shape
    check (case when jsonb_typeof(format) = 'object' then octet_length(format::text) <= 40000 else false end);

comment on column public.templates.summary is 'One sentence about the template, shown in lists.';
comment on column public.templates.learned_from is 'The examples it was learned from: [{kind, name}], names only.';

-- A resource uses a built-in template or one of its teacher's own, of its own category.
create or replace function public.check_resource_template() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.template_id is not null and not exists (
    select 1 from public.templates t
    where t.id = new.template_id
      and (t.built_in or t.teacher_id = new.teacher_id)
      and t.kind = case new.kind when 'test' then 'quiz' when 'presentation' then 'slides' else new.kind end
  ) then
    raise exception 'That template doesn''t exist, or is for another kind of material.' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;
