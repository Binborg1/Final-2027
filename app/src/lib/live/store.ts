import type { SessionPatch } from "@/lib/live/state";
import type { LiveAnswer, LiveContent, LiveParticipant, LiveQuestion, LiveResponse, LiveSession, LiveState, MarkedBy } from "@/lib/live/types";

/**
 * Every database call Live mode makes, in one interface. Production uses
 * store-supabase.ts (the admin client for phones, the teacher's own session for
 * teachers); tests use an in-memory copy that keeps the same rules (one open
 * code each, one answer per student per question, conditional updates).
 */

export type NewSession = {
  id: string;
  teacherId: string;
  courseId: string;
  chapterId: string | null;
  resourceVersionId: string | null;
  code: string;
  title: string;
  timerS: number;
  askStudentNo: boolean;
};

export type NewQuestion = { sessionId: string; teacherId: string; questionId: string | null; position: number; content: LiveContent };

export type StoredParticipant = LiveParticipant & { sessionId: string; teacherId: string; tokenHash: string };

export type NewAnswer = {
  teacherId: string;
  sessionId: string;
  participantId: string;
  questionId: string;
  response: LiveResponse;
  correct: boolean | null;
  marks: number | null;
  markedBy: MarkedBy | null;
  savedAt: string;
};

/** A bank question as Live reads it to make a snapshot. */
export type BankQuestion = { id: string; type: string; stem: string; options: unknown; answer: unknown; marks: number; outcome_ref: string | null; retired: boolean };

export type MarkBy = "ai" | "teacher" | "code" | "undo";

export interface LiveStore {
  session(id: string): Promise<LiveSession | null>;
  openSessionByCode(code: string): Promise<LiveSession | null>;
  /** The teacher's sessions that haven't ended. */
  openSessions(teacherId: string): Promise<LiveSession[]>;
  /** "bad-ref": the course, chapter or version isn't this teacher's. */
  insertSession(row: NewSession): Promise<"ok" | "code-taken" | "exists" | "bad-ref">;
  /** Applies the patch only if the session is still in `expect`; null when another request got there first. */
  updateSession(id: string, expect: { state: LiveState; rev: number }, patch: SessionPatch): Promise<LiveSession | null>;
  deleteSession(id: string): Promise<void>;
  /** end_live_session(): counts per question, the bank learns, the session ends. */
  endSession(id: string): Promise<void>;

  questions(sessionId: string): Promise<LiveQuestion[]>;
  question(sessionId: string, id: string): Promise<LiveQuestion | null>;
  insertQuestions(rows: NewQuestion[]): Promise<void>;
  bankQuestions(ids: string[]): Promise<BankQuestion[]>;
  /** Marks short-answer questions as being marked; returns those this request won. */
  claimMarking(sessionId: string, ids: string[], staleBefore: string, retryFailed: boolean): Promise<string[]>;
  finishMarking(id: string, state: "done" | "failed", note: string | null): Promise<void>;

  participant(id: string): Promise<StoredParticipant | null>;
  participants(sessionId: string): Promise<LiveParticipant[]>;
  participantCount(sessionId: string): Promise<number>;
  addParticipant(row: { sessionId: string; teacherId: string; name: string; studentNo: string | null; tokenHash: string }): Promise<LiveParticipant>;
  removeParticipant(sessionId: string, id: string): Promise<boolean>;

  answersOf(participantId: string): Promise<LiveAnswer[]>;
  answers(sessionId: string): Promise<LiveAnswer[]>;
  answer(sessionId: string, id: string): Promise<LiveAnswer | null>;
  saveAnswer(row: NewAnswer): Promise<void>;
  deleteAnswer(participantId: string, questionId: string): Promise<void>;
  setMarks(sessionId: string, by: MarkBy, marks: { id: string; marks: number | null }[]): Promise<number>;

  rateHit(key: string, limit: number): Promise<boolean>;
}
