-- Pinned questions (FR-20, T4): a teacher pins a bank question to one section of a
-- quiz, test or exam template, and every material made from that template includes
-- it unchanged; Funza writes the rest of that section around it.
--
-- template_pins gets the section (0 to 7, the template's section order) the question
-- belongs in. The table, its row-level security ("Teachers manage their own template
-- pins") and its composite foreign keys (template and question of the same teacher)
-- already exist from the initial schema.
--
-- Only adds things, so the deployed app keeps working.

alter table public.template_pins
  add column section smallint not null default 0 check (section between 0 and 7);

comment on column public.template_pins.section is 'The template section (0 = the first) the pinned question goes in.';

-- A question's pins are found when it is retired or deleted.
create index if not exists template_pins_question_id_idx on public.template_pins (question_id);
