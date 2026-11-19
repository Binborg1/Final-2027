-- Funza curriculum database (PostgreSQL 14+).
--
-- The same data as src/data/curriculum/sk.json, for when Funza moves to a hosted
-- database. Load it with:
--   psql "$DATABASE_URL" -f scripts/curriculum/schema.sql
--   node scripts/curriculum/export-sql.mjs        # writes .cache/curriculum/sk-seed.sql
--   psql "$DATABASE_URL" -f .cache/curriculum/sk-seed.sql
--
-- Rules the schema enforces: wording is stored verbatim with a SHA-256 fingerprint,
-- every row links to its official page, and a person's check is a separate record
-- tied to the exact wording it checked.

create table if not exists curriculum_import (
  id           serial primary key,
  jurisdiction text not null check (jurisdiction = 'SK'),
  imported_on  date not null,
  importer     text not null,
  source_site  text not null,
  source_csv   text not null
);

create table if not exists course (
  id            text primary key,                 -- "sk-<curriculum id>"
  curriculum_id integer not null unique,          -- id on curriculum.gov.sk.ca
  import_id     integer not null references curriculum_import (id),
  name          text not null,
  subject       text,
  levels        integer[] not null check (levels <@ array[10, 20, 30]),
  version       text,                             -- e.g. "2026 PRELIMINARY"
  preliminary   boolean not null default false,
  renewal       boolean not null default false,
  url           text not null check (url like 'https://curriculum.gov.sk.ca/%'),
  outcomes_url  text not null check (outcomes_url like 'https://curriculum.gov.sk.ca/%'),
  page_sha256   text,
  csv_files     text[] not null default '{}',
  problem       text
);

create table if not exists unit (
  id        text primary key,
  course_id text not null references course (id) on delete cascade,
  oc_id     integer not null,
  name      text not null,
  level     integer check (level in (10, 20, 30)),
  url       text not null,
  position  integer not null
);

create table if not exists outcome (
  id           text primary key,                  -- "sk-<curriculum id>-<outcome id>"
  course_id    text not null references course (id) on delete cascade,
  unit_id      text references unit (id) on delete set null,
  oc_id        integer not null,
  code         text not null,
  statement    text not null,                     -- verbatim
  printed_with text,
  level        integer check (level in (10, 20, 30)),
  url          text not null check (url like 'https://curriculum.gov.sk.ca/%'),
  fingerprint  text not null check (fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  status       text not null check (status in ('verified', 'source-checked', 'cross-checked', 'imported')),
  csv          text not null check (csv in ('match', 'prefix', 'mismatch', 'missing', 'no-file')),
  guidance     text[] not null default '{}',
  notes        text[] not null default '{}',
  position     integer not null
);

create table if not exists indicator (
  id         text primary key,
  outcome_id text not null references outcome (id) on delete cascade,
  label      text not null,
  text       text not null,                       -- verbatim
  status     text not null default 'imported' check (status in ('verified', 'imported')),
  position   integer not null
);

-- A person comparing an outcome with its official page. Tied to the wording checked:
-- if the wording changes, the fingerprint no longer matches and the check no longer counts.
-- No foreign key on purpose: re-seeding an import must never delete people's checks.
create table if not exists outcome_check (
  id          serial primary key,
  outcome_id  text not null,
  fingerprint text not null,
  checked_by  text not null,
  checked_at  timestamptz not null default now(),
  result      text not null check (result in ('matches', 'differs')),
  note        text
);

create index if not exists outcome_course_idx on outcome (course_id);
create index if not exists outcome_code_idx on outcome (code);
create index if not exists indicator_outcome_idx on indicator (outcome_id);
create index if not exists outcome_search_idx on outcome using gin (to_tsvector('english', code || ' ' || statement));
