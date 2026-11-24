import type { Calc, RubricLine } from "@/lib/resources/types";

/**
 * Live mode's model. A session runs the whole set at once on one shared clock:
 * lobby → open (answering) → closed (marking) → revealed → ended (results).
 * Times are ISO strings, as the database returns them.
 */

export type LiveState = "lobby" | "open" | "closed" | "revealed" | "ended";

/** Question types a phone can answer. "calc" is a number. */
export type LiveType = "mcq" | "tf" | "calc" | "short";

/** The answer key, in the bank's shape (lib/resources/bank-rows.ts answerOf). Never sent to a phone before Reveal. */
export type LiveKey = {
  correctId?: string | null;
  tf?: boolean | null;
  answer?: string;
  rubric?: RubricLine[];
  solution?: string;
  calc?: Calc | null;
};

/** The question as it was when the session started (live_questions.content). */
export type LiveContent = {
  type: LiveType;
  stem: string;
  options: { id: string; text: string }[] | null;
  answer: LiveKey;
  marks: number;
  outcomeRef: string | null;
};

export type MarkState = "none" | "running" | "done" | "failed";
export type MarkedBy = "code" | "ai" | "teacher";

export type LiveSession = {
  id: string;
  teacherId: string;
  courseId: string;
  chapterId: string | null;
  resourceVersionId: string | null;
  code: string;
  title: string;
  state: LiveState;
  timerS: number;
  askStudentNo: boolean;
  createdAt: string;
  openedAt: string | null;
  endsAt: string | null;
  closedAt: string | null;
  revealedAt: string | null;
  endedAt: string | null;
  currentQuestionId: string | null;
  rev: number;
  studentsPurgedAt: string | null;
};

export type LiveQuestion = {
  id: string;
  position: number;
  questionId: string | null;
  content: LiveContent;
  markState: MarkState;
  markStartedAt: string | null;
  markNote: string | null;
  /** Kept when the session ends (and after the 30-day purge). */
  answerCount: number | null;
  correctCount: number | null;
};

export type LiveParticipant = { id: string; name: string; studentNo: string | null; joinedAt: string };

/** What a phone sent: an option id ("true"/"false" for true or false), or typed text. */
export type LiveResponse = { choice: string } | { text: string };

export type LiveAnswer = {
  id: string;
  participantId: string;
  questionId: string;
  response: LiveResponse;
  correct: boolean | null;
  marks: number | null;
  aiMarks: number | null;
  markedBy: MarkedBy | null;
  savedAt: string;
};
