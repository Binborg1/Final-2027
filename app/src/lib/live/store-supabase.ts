import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/db/admin";
import type { Database, Json } from "@/lib/db/types";
import { parseContent } from "@/lib/live/questions";
import { isLiveState } from "@/lib/live/state";
import type { BankQuestion, LiveStore } from "@/lib/live/store";
import type { LiveAnswer, LiveParticipant, LiveQuestion, LiveResponse, LiveSession, MarkedBy, MarkState } from "@/lib/live/types";

/**
 * Live mode's store on Supabase. Phones go through `phoneStore()` (the secret
 * key: students have no account, and the handlers check every token first).
 * Teachers go through `teacherStore(supabase)`, their own session, so row-level
 * security keeps each teacher to their own sessions.
 */

type Db = SupabaseClient<Database>;
type SessionRow = Database["public"]["Tables"]["live_sessions"]["Row"];
type QuestionRow = Database["public"]["Tables"]["live_questions"]["Row"];
type AnswerRow = Database["public"]["Tables"]["answers"]["Row"];

const SESSION_COLS =
  "id, teacher_id, course_id, chapter_id, resource_version_id, code, title, state, timer_s, ask_student_no, created_at, opened_at, ends_at, closed_at, revealed_at, ended_at, current_question_id, rev, students_purged_at";
const QUESTION_COLS = "id, position, question_id, content, mark_state, mark_started_at, mark_note, answer_count, correct_count";
const ANSWER_COLS = "id, participant_id, live_question_id, response, correct, marks, ai_marks, marked_by, saved_at";
const PAGE = 1000;

function toSession(r: Pick<SessionRow, "id" | "teacher_id" | "course_id" | "chapter_id" | "resource_version_id" | "code" | "title" | "state" | "timer_s" | "ask_student_no" | "created_at" | "opened_at" | "ends_at" | "closed_at" | "revealed_at" | "ended_at" | "current_question_id" | "rev" | "students_purged_at">): LiveSession {
  return {
    id: r.id,
    teacherId: r.teacher_id,
    courseId: r.course_id,
    chapterId: r.chapter_id,
    resourceVersionId: r.resource_version_id,
    code: r.code,
    title: r.title,
    state: isLiveState(r.state) ? r.state : "ended",
    timerS: r.timer_s,
    askStudentNo: r.ask_student_no,
    createdAt: r.created_at,
    openedAt: r.opened_at,
    endsAt: r.ends_at,
    closedAt: r.closed_at,
    revealedAt: r.revealed_at,
    endedAt: r.ended_at,
    currentQuestionId: r.current_question_id,
    rev: r.rev,
    studentsPurgedAt: r.students_purged_at,
  };
}

const MARK_STATES: MarkState[] = ["none", "running", "done", "failed"];

function toQuestion(r: Pick<QuestionRow, "id" | "position" | "question_id" | "content" | "mark_state" | "mark_started_at" | "mark_note" | "answer_count" | "correct_count">): LiveQuestion | null {
  const content = parseContent(r.content);
  if (!content) return null;
  return {
    id: r.id,
    position: r.position,
    questionId: r.question_id,
    content,
    markState: (MARK_STATES as string[]).includes(r.mark_state) ? (r.mark_state as MarkState) : "none",
    markStartedAt: r.mark_started_at,
    markNote: r.mark_note,
    answerCount: r.answer_count,
    correctCount: r.correct_count,
  };
}

function toResponse(raw: Json): LiveResponse {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    if (typeof raw.choice === "string") return { choice: raw.choice };
    if (typeof raw.text === "string") return { text: raw.text };
  }
  return { text: "" };
}

const BY: MarkedBy[] = ["code", "ai", "teacher"];

function toAnswer(r: Pick<AnswerRow, "id" | "participant_id" | "live_question_id" | "response" | "correct" | "marks" | "ai_marks" | "marked_by" | "saved_at">): LiveAnswer {
  return {
    id: r.id,
    participantId: r.participant_id,
    questionId: r.live_question_id,
    response: toResponse(r.response),
    correct: r.correct,
    marks: r.marks === null ? null : Number(r.marks),
    aiMarks: r.ai_marks === null ? null : Number(r.ai_marks),
    markedBy: r.marked_by && (BY as string[]).includes(r.marked_by) ? (r.marked_by as MarkedBy) : null,
    savedAt: r.saved_at,
  };
}

const toParticipant = (r: { id: string; name: string; student_no: string | null; joined_at: string }): LiveParticipant => ({ id: r.id, name: r.name, studentNo: r.student_no, joinedAt: r.joined_at });

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? "unknown error"}`);
}

export function supabaseStore(db: Db): LiveStore {
  return {
    async session(id) {
      const { data, error } = await db.from("live_sessions").select(SESSION_COLS).eq("id", id).maybeSingle();
      if (error) fail("Reading the session", error);
      return data ? toSession(data) : null;
    },
    async openSessionByCode(code) {
      const { data, error } = await db.from("live_sessions").select(SESSION_COLS).eq("code", code).neq("state", "ended").maybeSingle();
      if (error) fail("Finding the session", error);
      return data ? toSession(data) : null;
    },
    async openSessions(teacherId) {
      const { data, error } = await db.from("live_sessions").select(SESSION_COLS).eq("teacher_id", teacherId).neq("state", "ended").order("created_at");
      if (error) fail("Reading open sessions", error);
      return (data ?? []).map(toSession);
    },
    async insertSession(row) {
      const { error } = await db.from("live_sessions").insert({
        id: row.id,
        teacher_id: row.teacherId,
        course_id: row.courseId,
        chapter_id: row.chapterId,
        resource_version_id: row.resourceVersionId,
        code: row.code,
        title: row.title,
        timer_s: row.timerS,
        ask_student_no: row.askStudentNo,
      });
      if (!error) return "ok";
      if (error.code === "23505" && error.message.includes("live_sessions_open_code_key")) return "code-taken";
      if (error.code === "23505") return "exists";
      if (error.code === "23503") return "bad-ref";
      fail("Saving the session", error);
    },
    async updateSession(id, expect, patch) {
      const { data, error } = await db.from("live_sessions").update(patch).eq("id", id).eq("state", expect.state).eq("rev", expect.rev).select(SESSION_COLS).maybeSingle();
      if (error) fail("Updating the session", error);
      return data ? toSession(data) : null;
    },
    async deleteSession(id) {
      const { error } = await db.from("live_sessions").delete().eq("id", id);
      if (error) fail("Deleting the session", error);
    },
    async endSession(id) {
      const { error } = await db.rpc("end_live_session", { p_session: id });
      if (error) fail("Ending the session", error);
    },

    async questions(sessionId) {
      const { data, error } = await db.from("live_questions").select(QUESTION_COLS).eq("session_id", sessionId).order("position");
      if (error) fail("Reading the questions", error);
      return (data ?? []).map(toQuestion).filter((q): q is LiveQuestion => q !== null);
    },
    async question(sessionId, id) {
      const { data, error } = await db.from("live_questions").select(QUESTION_COLS).eq("session_id", sessionId).eq("id", id).maybeSingle();
      if (error) fail("Reading the question", error);
      return data ? toQuestion(data) : null;
    },
    async insertQuestions(rows) {
      if (rows.length === 0) return;
      const { error } = await db.from("live_questions").insert(
        rows.map((r) => ({ session_id: r.sessionId, teacher_id: r.teacherId, question_id: r.questionId, position: r.position, content: r.content as unknown as Json })),
      );
      if (error) fail("Saving the questions", error);
    },
    async bankQuestions(ids) {
      if (ids.length === 0) return [];
      const { data, error } = await db.from("questions").select("id, type, stem, options, answer, marks, outcome_ref, retired").in("id", ids);
      if (error) fail("Reading the question bank", error);
      return (data ?? []) as BankQuestion[];
    },
    async claimMarking(sessionId, ids, staleBefore, retryFailed) {
      if (ids.length === 0) return [];
      const states = [`mark_state.eq.none`, `and(mark_state.eq.running,mark_started_at.lt.${staleBefore})`, ...(retryFailed ? ["mark_state.eq.failed"] : [])];
      const { data, error } = await db
        .from("live_questions")
        .update({ mark_state: "running", mark_started_at: new Date().toISOString(), mark_note: null })
        .eq("session_id", sessionId)
        .in("id", ids)
        .or(states.join(","))
        .select("id");
      if (error) fail("Starting to mark", error);
      return (data ?? []).map((r) => r.id);
    },
    async finishMarking(id, state, note) {
      const { error } = await db.from("live_questions").update({ mark_state: state, mark_note: note }).eq("id", id);
      if (error) fail("Saving the marking state", error);
    },

    async participant(id) {
      const { data, error } = await db.from("participants").select("id, session_id, teacher_id, name, student_no, token_hash, joined_at").eq("id", id).maybeSingle();
      if (error) fail("Reading the student", error);
      return data ? { ...toParticipant(data), sessionId: data.session_id, teacherId: data.teacher_id, tokenHash: data.token_hash } : null;
    },
    async participants(sessionId) {
      const { data, error } = await db.from("participants").select("id, name, student_no, joined_at").eq("session_id", sessionId).order("joined_at").limit(500);
      if (error) fail("Reading the students", error);
      return (data ?? []).map(toParticipant);
    },
    async participantCount(sessionId) {
      const { count, error } = await db.from("participants").select("id", { count: "exact", head: true }).eq("session_id", sessionId);
      if (error) fail("Counting the students", error);
      return count ?? 0;
    },
    async addParticipant(row) {
      const { data, error } = await db
        .from("participants")
        .insert({ session_id: row.sessionId, teacher_id: row.teacherId, name: row.name, student_no: row.studentNo, token_hash: row.tokenHash })
        .select("id, name, student_no, joined_at")
        .single();
      if (error || !data) fail("Adding the student", error);
      return toParticipant(data);
    },
    async removeParticipant(sessionId, id) {
      const { data, error } = await db.from("participants").delete().eq("session_id", sessionId).eq("id", id).select("id");
      if (error) fail("Removing the student", error);
      return (data ?? []).length > 0;
    },

    async answersOf(participantId) {
      const { data, error } = await db.from("answers").select(ANSWER_COLS).eq("participant_id", participantId).limit(PAGE);
      if (error) fail("Reading the answers", error);
      return (data ?? []).map(toAnswer);
    },
    async answers(sessionId) {
      const out: LiveAnswer[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db.from("answers").select(ANSWER_COLS).eq("session_id", sessionId).order("id").range(from, from + PAGE - 1);
        if (error) fail("Reading the answers", error);
        out.push(...(data ?? []).map(toAnswer));
        if (!data || data.length < PAGE) return out;
      }
    },
    async answer(sessionId, id) {
      const { data, error } = await db.from("answers").select(ANSWER_COLS).eq("session_id", sessionId).eq("id", id).maybeSingle();
      if (error) fail("Reading the answer", error);
      return data ? toAnswer(data) : null;
    },
    async saveAnswer(row) {
      const { error } = await db.from("answers").upsert(
        {
          teacher_id: row.teacherId,
          session_id: row.sessionId,
          participant_id: row.participantId,
          live_question_id: row.questionId,
          response: row.response as unknown as Json,
          correct: row.correct,
          marks: row.marks,
          marked_by: row.markedBy,
          ai_marks: null,
          saved_at: row.savedAt,
        },
        { onConflict: "participant_id,live_question_id" },
      );
      if (error) fail("Saving the answer", error);
    },
    async deleteAnswer(participantId, questionId) {
      const { error } = await db.from("answers").delete().eq("participant_id", participantId).eq("live_question_id", questionId);
      if (error) fail("Clearing the answer", error);
    },
    async setMarks(sessionId, by, marks) {
      const { data, error } = await db.rpc("set_live_marks", { p_session: sessionId, p_by: by, p_marks: marks as unknown as Json });
      if (error) fail("Saving marks", error);
      return data ?? 0;
    },

    async rateHit(key, limit) {
      const { data, error } = await db.rpc("rate_hit", { p_key: key, p_limit: limit });
      if (error) fail("Counting the request", error);
      return data === true;
    },
  };
}

/** For phone routes: the secret key, after the handler has checked the student's token. */
export const phoneStore = () => supabaseStore(adminClient());

/** For teacher routes: the teacher's own session, under row-level security. */
export const teacherStore = (supabase: Db) => supabaseStore(supabase);

export type { BankQuestion };
