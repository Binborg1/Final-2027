


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."check_resource_template"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.template_id is not null and not exists (
    select 1 from public.templates t
    where t.id = new.template_id and (t.built_in or t.teacher_id = new.teacher_id)
  ) then
    raise exception 'That template doesn''t exist.' using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."check_resource_template"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."keep_approved_versions"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if old.approved_at is not null and (tg_op = 'UPDATE' or pg_trigger_depth() = 1) then
    raise exception 'Version % is approved and can''t change. Save the edit as a new version.', old.number
      using errcode = 'check_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


ALTER FUNCTION "public"."keep_approved_versions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_only_approved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if not exists (
    select 1 from public.resource_versions v
    where v.id = new.version_id and v.teacher_id = new.teacher_id and v.approved_at is not null
  ) then
    raise exception 'Only an approved version can be published.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."publish_only_approved"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_student_data"("older_than" interval DEFAULT '30 days'::interval) RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."purge_student_data"("older_than" interval) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."purge_student_data"("older_than" interval) IS 'Deletes student names, numbers and answers of sessions older than the given age (30 days by default), keeping anonymous counts per question. Run nightly by pg_cron.';



CREATE OR REPLACE FUNCTION "public"."retire_unlinked_questions"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.chapter_id is null and old.chapter_id is not null then
    new.retired := true;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."retire_unlinked_questions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_usage" (
    "id" bigint NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "task" "text" NOT NULL,
    "model" "text" NOT NULL,
    "tokens_in" integer DEFAULT 0 NOT NULL,
    "tokens_out" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_usage_model_check" CHECK ((("char_length"("model") >= 1) AND ("char_length"("model") <= 200))),
    CONSTRAINT "ai_usage_task_check" CHECK ((("char_length"("task") >= 1) AND ("char_length"("task") <= 100))),
    CONSTRAINT "ai_usage_tokens_in_check" CHECK (("tokens_in" >= 0)),
    CONSTRAINT "ai_usage_tokens_out_check" CHECK (("tokens_out" >= 0))
);


ALTER TABLE "public"."ai_usage" OWNER TO "postgres";


ALTER TABLE "public"."ai_usage" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."ai_usage_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "participant_id" "uuid" NOT NULL,
    "live_question_id" "uuid" NOT NULL,
    "response" "jsonb" NOT NULL,
    "correct" boolean,
    "marks" numeric(6,2),
    "marked_by" "text",
    "saved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "answers_marked_by_check" CHECK (("marked_by" = ANY (ARRAY['code'::"text", 'ai'::"text", 'teacher'::"text"]))),
    CONSTRAINT "answers_marks_check" CHECK (("marks" >= (0)::numeric))
);


ALTER TABLE "public"."answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chapters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "source_kind" "text" DEFAULT 'custom'::"text" NOT NULL,
    "source_ref" "text",
    "outcome_refs" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chapters_outcome_refs_check" CHECK (("cardinality"("outcome_refs") <= 300)),
    CONSTRAINT "chapters_source_kind_check" CHECK (("source_kind" = ANY (ARRAY['unit'::"text", 'module'::"text", 'outcome'::"text", 'custom'::"text"]))),
    CONSTRAINT "chapters_source_ref_check" CHECK ((("char_length"("source_ref") >= 1) AND ("char_length"("source_ref") <= 200))),
    CONSTRAINT "chapters_source_ref_matches_kind" CHECK ((("source_kind" = 'custom'::"text") = ("source_ref" IS NULL))),
    CONSTRAINT "chapters_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 200)))
);


ALTER TABLE "public"."chapters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "curriculum_course_id" "text",
    "level" smallint,
    "title" "text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "share_slug" "text",
    "share_on" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "courses_curriculum_course_id_check" CHECK ((("char_length"("curriculum_course_id") >= 1) AND ("char_length"("curriculum_course_id") <= 64))),
    CONSTRAINT "courses_curriculum_needs_level" CHECK ((("curriculum_course_id" IS NULL) OR ("level" IS NOT NULL))),
    CONSTRAINT "courses_level_check" CHECK (("level" = ANY (ARRAY[10, 20, 30]))),
    CONSTRAINT "courses_share_slug_check" CHECK (("share_slug" ~ '^[A-Za-z0-9_-]{16,64}$'::"text")),
    CONSTRAINT "courses_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 200)))
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_connections" (
    "teacher_id" "uuid" NOT NULL,
    "google_email" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "google_connections_google_email_check" CHECK ((("char_length"("google_email") >= 3) AND ("char_length"("google_email") <= 320)))
);


ALTER TABLE "public"."google_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."live_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "started_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "revealed_at" timestamp with time zone,
    "answer_count" integer,
    "correct_count" integer,
    CONSTRAINT "live_questions_answer_count_check" CHECK (("answer_count" >= 0)),
    CONSTRAINT "live_questions_counts_valid" CHECK ((("correct_count" >= 0) AND ("correct_count" <= "answer_count"))),
    CONSTRAINT "live_questions_position_check" CHECK (("position" >= 1))
);


ALTER TABLE "public"."live_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."live_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "state" "text" DEFAULT 'lobby'::"text" NOT NULL,
    "current_question_id" "uuid",
    "timer_s" integer DEFAULT 30 NOT NULL,
    "ask_student_no" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "students_purged_at" timestamp with time zone,
    CONSTRAINT "live_sessions_code_check" CHECK (("code" ~ '^[A-HJ-NP-Z2-9]{6}$'::"text")),
    CONSTRAINT "live_sessions_ended_at_matches_state" CHECK ((("state" = 'ended'::"text") = ("ended_at" IS NOT NULL))),
    CONSTRAINT "live_sessions_state_check" CHECK (("state" = ANY (ARRAY['lobby'::"text", 'open'::"text", 'closed'::"text", 'revealed'::"text", 'ended'::"text"]))),
    CONSTRAINT "live_sessions_timer_s_check" CHECK ((("timer_s" >= 5) AND ("timer_s" <= 3600)))
);


ALTER TABLE "public"."live_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "student_no" "text",
    "token_hash" "text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "participants_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 60))),
    CONSTRAINT "participants_student_no_check" CHECK ((("char_length"("student_no") >= 1) AND ("char_length"("student_no") <= 30))),
    CONSTRAINT "participants_token_hash_check" CHECK ((("char_length"("token_hash") >= 32) AND ("char_length"("token_hash") <= 128)))
);


ALTER TABLE "public"."participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."publications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "version_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "external_id" "text",
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "publications_channel_check" CHECK (("channel" = ANY (ARRAY['page'::"text", 'classroom'::"text", 'print'::"text"]))),
    CONSTRAINT "publications_external_id_check" CHECK ((("char_length"("external_id") >= 1) AND ("char_length"("external_id") <= 500)))
);


ALTER TABLE "public"."publications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "chapter_id" "uuid",
    "type" "text" NOT NULL,
    "stem" "text" NOT NULL,
    "options" "jsonb",
    "answer" "jsonb" NOT NULL,
    "marks" integer DEFAULT 1 NOT NULL,
    "outcome_ref" "text",
    "answer_count" integer DEFAULT 0 NOT NULL,
    "correct_count" integer DEFAULT 0 NOT NULL,
    "difficulty" real GENERATED ALWAYS AS (
CASE
    WHEN ("answer_count" >= 10) THEN (("correct_count")::real / ("answer_count")::double precision)
    ELSE NULL::double precision
END) STORED,
    "times_used" integer DEFAULT 0 NOT NULL,
    "last_used_at" timestamp with time zone,
    "retired" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "questions_answer_count_check" CHECK (("answer_count" >= 0)),
    CONSTRAINT "questions_counts_valid" CHECK ((("correct_count" >= 0) AND ("correct_count" <= "answer_count"))),
    CONSTRAINT "questions_marks_check" CHECK ((("marks" >= 0) AND ("marks" <= 100))),
    CONSTRAINT "questions_outcome_ref_check" CHECK ((("char_length"("outcome_ref") >= 1) AND ("char_length"("outcome_ref") <= 200))),
    CONSTRAINT "questions_stem_check" CHECK ((("char_length"("stem") >= 1) AND ("char_length"("stem") <= 5000))),
    CONSTRAINT "questions_times_used_check" CHECK (("times_used" >= 0)),
    CONSTRAINT "questions_type_check" CHECK (("type" = ANY (ARRAY['mcq'::"text", 'tf'::"text", 'fill'::"text", 'match'::"text", 'calc'::"text", 'short'::"text", 'long'::"text"]))),
    CONSTRAINT "questions_unlinked_are_retired" CHECK ((("chapter_id" IS NOT NULL) OR "retired"))
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resource_chapters" (
    "resource_id" "uuid" NOT NULL,
    "chapter_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL
);


ALTER TABLE "public"."resource_chapters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resource_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "resource_id" "uuid" NOT NULL,
    "number" integer NOT NULL,
    "content" "jsonb" NOT NULL,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "resource_versions_approval_complete" CHECK ((("approved_at" IS NULL) = ("approved_by" IS NULL))),
    CONSTRAINT "resource_versions_number_check" CHECK (("number" >= 1))
);


ALTER TABLE "public"."resource_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "course_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "current_version_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "resources_kind_check" CHECK (("kind" = ANY (ARRAY['notes'::"text", 'presentation'::"text", 'quiz'::"text", 'test'::"text", 'exam'::"text"]))),
    CONSTRAINT "resources_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'in_review'::"text", 'approved'::"text", 'published'::"text"]))),
    CONSTRAINT "resources_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 300)))
);


ALTER TABLE "public"."resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "chapter_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "file_path" "text",
    "text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sources_file_path_check" CHECK ((("char_length"("file_path") >= 1) AND ("char_length"("file_path") <= 1024))),
    CONSTRAINT "sources_has_content" CHECK ((("file_path" IS NOT NULL) OR ("text" IS NOT NULL))),
    CONSTRAINT "sources_kind_check" CHECK (("kind" = ANY (ARRAY['notes'::"text", 'pdf'::"text", 'past_exam'::"text"]))),
    CONSTRAINT "sources_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 300)))
);


ALTER TABLE "public"."sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teachers" (
    "id" "uuid" NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "school" "text" DEFAULT ''::"text" NOT NULL,
    "grades" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
    "subjects" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "setup_done_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "teachers_grades_check" CHECK (("grades" <@ ARRAY[(10)::smallint, (11)::smallint, (12)::smallint])),
    CONSTRAINT "teachers_name_check" CHECK (("char_length"("name") <= 200)),
    CONSTRAINT "teachers_school_check" CHECK (("char_length"("school") <= 200)),
    CONSTRAINT "teachers_subjects_check" CHECK (("cardinality"("subjects") <= 40))
);


ALTER TABLE "public"."teachers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."template_pins" (
    "template_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."template_pins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid",
    "kind" "text" NOT NULL,
    "name" "text" NOT NULL,
    "built_in" boolean DEFAULT false NOT NULL,
    "format" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "templates_built_in_has_no_owner" CHECK (("built_in" = ("teacher_id" IS NULL))),
    CONSTRAINT "templates_kind_check" CHECK (("kind" = ANY (ARRAY['exam'::"text", 'notes'::"text"]))),
    CONSTRAINT "templates_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 200)))
);


ALTER TABLE "public"."templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."version_questions" (
    "version_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."version_questions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_one_per_question" UNIQUE ("participant_id", "live_question_id");



ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_id_teacher_id_key" UNIQUE ("id", "teacher_id");



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_id_teacher_id_key" UNIQUE ("id", "teacher_id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_share_slug_key" UNIQUE ("share_slug");



ALTER TABLE ONLY "public"."google_connections"
    ADD CONSTRAINT "google_connections_pkey" PRIMARY KEY ("teacher_id");



ALTER TABLE ONLY "public"."live_questions"
    ADD CONSTRAINT "live_questions_id_session_id_key" UNIQUE ("id", "session_id");



ALTER TABLE ONLY "public"."live_questions"
    ADD CONSTRAINT "live_questions_id_teacher_id_key" UNIQUE ("id", "teacher_id");



ALTER TABLE ONLY "public"."live_questions"
    ADD CONSTRAINT "live_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_id_teacher_id_key" UNIQUE ("id", "teacher_id");



ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_id_session_id_key" UNIQUE ("id", "session_id");



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_id_teacher_id_key" UNIQUE ("id", "teacher_id");



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."publications"
    ADD CONSTRAINT "publications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_id_teacher_id_key" UNIQUE ("id", "teacher_id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resource_chapters"
    ADD CONSTRAINT "resource_chapters_pkey" PRIMARY KEY ("resource_id", "chapter_id");



ALTER TABLE ONLY "public"."resource_versions"
    ADD CONSTRAINT "resource_versions_id_resource_id_key" UNIQUE ("id", "resource_id");



ALTER TABLE ONLY "public"."resource_versions"
    ADD CONSTRAINT "resource_versions_id_teacher_id_key" UNIQUE ("id", "teacher_id");



ALTER TABLE ONLY "public"."resource_versions"
    ADD CONSTRAINT "resource_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resource_versions"
    ADD CONSTRAINT "resource_versions_resource_id_number_key" UNIQUE ("resource_id", "number");



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_id_teacher_id_key" UNIQUE ("id", "teacher_id");



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sources"
    ADD CONSTRAINT "sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."template_pins"
    ADD CONSTRAINT "template_pins_pkey" PRIMARY KEY ("template_id", "question_id");



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_id_teacher_id_key" UNIQUE ("id", "teacher_id");



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."version_questions"
    ADD CONSTRAINT "version_questions_pkey" PRIMARY KEY ("version_id", "question_id");



CREATE INDEX "ai_usage_teacher_id_idx" ON "public"."ai_usage" USING "btree" ("teacher_id", "created_at" DESC);



CREATE INDEX "answers_live_question_id_idx" ON "public"."answers" USING "btree" ("live_question_id", "session_id");



CREATE INDEX "answers_participant_id_idx" ON "public"."answers" USING "btree" ("participant_id", "session_id");



CREATE INDEX "answers_session_id_idx" ON "public"."answers" USING "btree" ("session_id", "teacher_id");



CREATE INDEX "chapters_course_id_idx" ON "public"."chapters" USING "btree" ("course_id", "teacher_id");



CREATE INDEX "courses_teacher_id_idx" ON "public"."courses" USING "btree" ("teacher_id", "position");



CREATE INDEX "live_questions_question_id_idx" ON "public"."live_questions" USING "btree" ("question_id", "teacher_id");



CREATE INDEX "live_questions_session_id_idx" ON "public"."live_questions" USING "btree" ("session_id", "teacher_id");



CREATE INDEX "live_sessions_course_id_idx" ON "public"."live_sessions" USING "btree" ("course_id", "teacher_id");



CREATE INDEX "live_sessions_current_question_id_idx" ON "public"."live_sessions" USING "btree" ("current_question_id", "id");



CREATE UNIQUE INDEX "live_sessions_open_code_key" ON "public"."live_sessions" USING "btree" ("code") WHERE ("state" <> 'ended'::"text");



CREATE INDEX "live_sessions_teacher_id_idx" ON "public"."live_sessions" USING "btree" ("teacher_id");



CREATE INDEX "participants_session_id_idx" ON "public"."participants" USING "btree" ("session_id", "teacher_id");



CREATE INDEX "publications_version_id_idx" ON "public"."publications" USING "btree" ("version_id", "teacher_id");



CREATE INDEX "questions_chapter_id_idx" ON "public"."questions" USING "btree" ("chapter_id", "teacher_id");



CREATE INDEX "questions_teacher_id_idx" ON "public"."questions" USING "btree" ("teacher_id");



CREATE INDEX "resource_chapters_chapter_id_idx" ON "public"."resource_chapters" USING "btree" ("chapter_id", "teacher_id");



CREATE INDEX "resource_chapters_resource_id_idx" ON "public"."resource_chapters" USING "btree" ("resource_id", "teacher_id");



CREATE INDEX "resource_versions_approved_by_idx" ON "public"."resource_versions" USING "btree" ("approved_by");



CREATE INDEX "resource_versions_resource_id_idx" ON "public"."resource_versions" USING "btree" ("resource_id", "teacher_id");



CREATE INDEX "resources_course_id_idx" ON "public"."resources" USING "btree" ("course_id", "teacher_id");



CREATE INDEX "resources_current_version_id_idx" ON "public"."resources" USING "btree" ("current_version_id", "id");



CREATE INDEX "resources_template_id_idx" ON "public"."resources" USING "btree" ("template_id");



CREATE INDEX "sources_chapter_id_idx" ON "public"."sources" USING "btree" ("chapter_id", "teacher_id");



CREATE INDEX "template_pins_question_id_idx" ON "public"."template_pins" USING "btree" ("question_id", "teacher_id");



CREATE INDEX "template_pins_template_id_idx" ON "public"."template_pins" USING "btree" ("template_id", "teacher_id");



CREATE INDEX "templates_teacher_id_idx" ON "public"."templates" USING "btree" ("teacher_id");



CREATE INDEX "version_questions_question_id_idx" ON "public"."version_questions" USING "btree" ("question_id", "teacher_id");



CREATE INDEX "version_questions_version_id_idx" ON "public"."version_questions" USING "btree" ("version_id", "teacher_id");



CREATE OR REPLACE TRIGGER "chapters_set_updated_at" BEFORE UPDATE ON "public"."chapters" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "courses_set_updated_at" BEFORE UPDATE ON "public"."courses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "google_connections_set_updated_at" BEFORE UPDATE ON "public"."google_connections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "publications_only_approved" BEFORE INSERT OR UPDATE ON "public"."publications" FOR EACH ROW EXECUTE FUNCTION "public"."publish_only_approved"();



CREATE OR REPLACE TRIGGER "questions_retire_unlinked" BEFORE UPDATE OF "chapter_id" ON "public"."questions" FOR EACH ROW EXECUTE FUNCTION "public"."retire_unlinked_questions"();



CREATE OR REPLACE TRIGGER "questions_set_updated_at" BEFORE UPDATE ON "public"."questions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "resource_versions_keep_approved" BEFORE DELETE OR UPDATE ON "public"."resource_versions" FOR EACH ROW EXECUTE FUNCTION "public"."keep_approved_versions"();



CREATE OR REPLACE TRIGGER "resources_check_template" BEFORE INSERT OR UPDATE OF "template_id" ON "public"."resources" FOR EACH ROW EXECUTE FUNCTION "public"."check_resource_template"();



CREATE OR REPLACE TRIGGER "resources_set_updated_at" BEFORE UPDATE ON "public"."resources" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "teachers_set_updated_at" BEFORE UPDATE ON "public"."teachers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "templates_set_updated_at" BEFORE UPDATE ON "public"."templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_live_question_id_session_id_fkey" FOREIGN KEY ("live_question_id", "session_id") REFERENCES "public"."live_questions"("id", "session_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_participant_id_session_id_fkey" FOREIGN KEY ("participant_id", "session_id") REFERENCES "public"."participants"("id", "session_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_session_id_teacher_id_fkey" FOREIGN KEY ("session_id", "teacher_id") REFERENCES "public"."live_sessions"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_course_id_teacher_id_fkey" FOREIGN KEY ("course_id", "teacher_id") REFERENCES "public"."courses"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."google_connections"
    ADD CONSTRAINT "google_connections_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_questions"
    ADD CONSTRAINT "live_questions_question_id_teacher_id_fkey" FOREIGN KEY ("question_id", "teacher_id") REFERENCES "public"."questions"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_questions"
    ADD CONSTRAINT "live_questions_session_id_teacher_id_fkey" FOREIGN KEY ("session_id", "teacher_id") REFERENCES "public"."live_sessions"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_course_id_teacher_id_fkey" FOREIGN KEY ("course_id", "teacher_id") REFERENCES "public"."courses"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."live_sessions"
    ADD CONSTRAINT "live_sessions_current_question_id_id_fkey" FOREIGN KEY ("current_question_id", "id") REFERENCES "public"."live_questions"("id", "session_id") ON DELETE SET NULL ("current_question_id");



ALTER TABLE ONLY "public"."participants"
    ADD CONSTRAINT "participants_session_id_teacher_id_fkey" FOREIGN KEY ("session_id", "teacher_id") REFERENCES "public"."live_sessions"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."publications"
    ADD CONSTRAINT "publications_version_id_teacher_id_fkey" FOREIGN KEY ("version_id", "teacher_id") REFERENCES "public"."resource_versions"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_chapter_id_teacher_id_fkey" FOREIGN KEY ("chapter_id", "teacher_id") REFERENCES "public"."chapters"("id", "teacher_id") ON DELETE SET NULL ("chapter_id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resource_chapters"
    ADD CONSTRAINT "resource_chapters_chapter_id_teacher_id_fkey" FOREIGN KEY ("chapter_id", "teacher_id") REFERENCES "public"."chapters"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resource_chapters"
    ADD CONSTRAINT "resource_chapters_resource_id_teacher_id_fkey" FOREIGN KEY ("resource_id", "teacher_id") REFERENCES "public"."resources"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resource_versions"
    ADD CONSTRAINT "resource_versions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."teachers"("id");



ALTER TABLE ONLY "public"."resource_versions"
    ADD CONSTRAINT "resource_versions_resource_id_teacher_id_fkey" FOREIGN KEY ("resource_id", "teacher_id") REFERENCES "public"."resources"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_course_id_teacher_id_fkey" FOREIGN KEY ("course_id", "teacher_id") REFERENCES "public"."courses"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_current_version_id_id_fkey" FOREIGN KEY ("current_version_id", "id") REFERENCES "public"."resource_versions"("id", "resource_id") ON DELETE SET NULL ("current_version_id");



ALTER TABLE ONLY "public"."resources"
    ADD CONSTRAINT "resources_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sources"
    ADD CONSTRAINT "sources_chapter_id_teacher_id_fkey" FOREIGN KEY ("chapter_id", "teacher_id") REFERENCES "public"."chapters"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teachers"
    ADD CONSTRAINT "teachers_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_pins"
    ADD CONSTRAINT "template_pins_question_id_teacher_id_fkey" FOREIGN KEY ("question_id", "teacher_id") REFERENCES "public"."questions"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."template_pins"
    ADD CONSTRAINT "template_pins_template_id_teacher_id_fkey" FOREIGN KEY ("template_id", "teacher_id") REFERENCES "public"."templates"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."version_questions"
    ADD CONSTRAINT "version_questions_question_id_teacher_id_fkey" FOREIGN KEY ("question_id", "teacher_id") REFERENCES "public"."questions"("id", "teacher_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."version_questions"
    ADD CONSTRAINT "version_questions_version_id_teacher_id_fkey" FOREIGN KEY ("version_id", "teacher_id") REFERENCES "public"."resource_versions"("id", "teacher_id") ON DELETE CASCADE;



CREATE POLICY "Teachers add their own templates" ON "public"."templates" FOR INSERT TO "authenticated" WITH CHECK (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers change their own templates" ON "public"."templates" FOR UPDATE TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers delete their own templates" ON "public"."templates" FOR DELETE TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers manage their own chapters" ON "public"."chapters" TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers manage their own courses" ON "public"."courses" TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers manage their own live questions" ON "public"."live_questions" TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers manage their own live sessions" ON "public"."live_sessions" TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers manage their own publications" ON "public"."publications" TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers manage their own questions" ON "public"."questions" TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers manage their own resource chapters" ON "public"."resource_chapters" TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers manage their own resources" ON "public"."resources" TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers manage their own sources" ON "public"."sources" TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers manage their own template pins" ON "public"."template_pins" TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers manage their own version questions" ON "public"."version_questions" TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers manage their own versions" ON "public"."resource_versions" TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers read built-in and their own templates" ON "public"."templates" FOR SELECT TO "authenticated" USING (("built_in" OR ("teacher_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Teachers read their own AI usage" ON "public"."ai_usage" FOR SELECT TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers read their own Google connection" ON "public"."google_connections" FOR SELECT TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers read their own answers" ON "public"."answers" FOR SELECT TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers read their own participants" ON "public"."participants" FOR SELECT TO "authenticated" USING (("teacher_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Teachers see and change their own row" ON "public"."teachers" TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."ai_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."answers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chapters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."live_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."live_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."publications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resource_chapters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resource_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teachers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_pins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."version_questions" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."purge_student_data"("older_than" interval) FROM PUBLIC;



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_usage" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage" TO "service_role";



GRANT UPDATE ON SEQUENCE "public"."ai_usage_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE "public"."ai_usage_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE "public"."ai_usage_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."answers" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."answers" TO "authenticated";
GRANT ALL ON TABLE "public"."answers" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."chapters" TO "anon";
GRANT ALL ON TABLE "public"."chapters" TO "authenticated";
GRANT ALL ON TABLE "public"."chapters" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."courses" TO "anon";
GRANT ALL ON TABLE "public"."courses" TO "authenticated";
GRANT ALL ON TABLE "public"."courses" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."google_connections" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."google_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."google_connections" TO "service_role";



GRANT SELECT("teacher_id") ON TABLE "public"."google_connections" TO "authenticated";



GRANT SELECT("google_email") ON TABLE "public"."google_connections" TO "authenticated";



GRANT SELECT("scopes") ON TABLE "public"."google_connections" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."google_connections" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."google_connections" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."live_questions" TO "anon";
GRANT ALL ON TABLE "public"."live_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."live_questions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."live_sessions" TO "anon";
GRANT ALL ON TABLE "public"."live_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."live_sessions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."participants" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."participants" TO "authenticated";
GRANT ALL ON TABLE "public"."participants" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."publications" TO "anon";
GRANT ALL ON TABLE "public"."publications" TO "authenticated";
GRANT ALL ON TABLE "public"."publications" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."resource_chapters" TO "anon";
GRANT ALL ON TABLE "public"."resource_chapters" TO "authenticated";
GRANT ALL ON TABLE "public"."resource_chapters" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."resource_versions" TO "anon";
GRANT ALL ON TABLE "public"."resource_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."resource_versions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."resources" TO "anon";
GRANT ALL ON TABLE "public"."resources" TO "authenticated";
GRANT ALL ON TABLE "public"."resources" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."sources" TO "anon";
GRANT ALL ON TABLE "public"."sources" TO "authenticated";
GRANT ALL ON TABLE "public"."sources" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."teachers" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."teachers" TO "authenticated";
GRANT ALL ON TABLE "public"."teachers" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."template_pins" TO "anon";
GRANT ALL ON TABLE "public"."template_pins" TO "authenticated";
GRANT ALL ON TABLE "public"."template_pins" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."templates" TO "anon";
GRANT ALL ON TABLE "public"."templates" TO "authenticated";
GRANT ALL ON TABLE "public"."templates" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."version_questions" TO "anon";
GRANT ALL ON TABLE "public"."version_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."version_questions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";







