// Sample live data for tests: a session with one question of each phone type.
import type { LiveAnswer, LiveContent, LiveParticipant, LiveQuestion, LiveSession } from "@/lib/live/types";

export const T0 = Date.parse("2026-11-26T15:00:00.000Z");
export const iso = (ms: number) => new Date(ms).toISOString();

export const MCQ: LiveContent = {
  type: "mcq",
  stem: "A cart moves 24 m in 6 s at a constant speed. What is its speed?",
  options: [
    { id: "a", text: "4 m/s" },
    { id: "b", text: "6 m/s" },
    { id: "c", text: "18 m/s" },
    { id: "d", text: "144 m/s" },
  ],
  answer: { correctId: "a", solution: "24 m ÷ 6 s = 4 m/s", calc: { expr: "d/t", vars: { d: 24, t: 6 }, unit: "m/s", show: "24 m ÷ 6 s" } },
  marks: 1,
  outcomeRef: "sk-63-110477",
};
export const TF: LiveContent = {
  type: "tf",
  stem: "An object moving at constant speed in a circle is accelerating.",
  options: null,
  answer: { tf: true, solution: "Its direction changes." },
  marks: 1,
  outcomeRef: "sk-63-110487",
};
export const CALC: LiveContent = {
  type: "calc",
  stem: "A grain truck drives 96 km in 1.2 h. What is its speed in km/h?",
  options: null,
  answer: { answer: "80 km/h", calc: { expr: "d/t", vars: { d: 96, t: 1.2 }, unit: "km/h", show: "96 km ÷ 1.2 h" } },
  marks: 2,
  outcomeRef: "sk-63-110477",
};
export const SHORT: LiveContent = {
  type: "short",
  stem: "Explain what a horizontal line on a position–time graph tells you.",
  options: null,
  answer: { rubric: [{ text: "The object is at rest", marks: 2 }, { text: "Its position does not change", marks: 1 }], solution: "The object is at rest (its position does not change)." },
  marks: 3,
  outcomeRef: "sk-63-110477",
};

export const SESSION_ID = "5e551011-0000-4000-8000-000000000001";
export const Q = { mcq: "9e000001-0000-4000-8000-000000000001", tf: "9e000001-0000-4000-8000-000000000002", calc: "9e000001-0000-4000-8000-000000000003", short: "9e000001-0000-4000-8000-000000000004" };

export function question(id: string, position: number, content: LiveContent, extra: Partial<LiveQuestion> = {}): LiveQuestion {
  return { id, position, questionId: null, content, markState: "none", markStartedAt: null, markNote: null, answerCount: null, correctCount: null, ...extra };
}

export const QUESTIONS: LiveQuestion[] = [question(Q.mcq, 1, MCQ), question(Q.tf, 2, TF), question(Q.calc, 3, CALC), question(Q.short, 4, SHORT)];

export function session(extra: Partial<LiveSession> = {}): LiveSession {
  return {
    id: SESSION_ID,
    teacherId: "00000000-0000-4000-8000-00000000000a",
    courseId: "c0000000-0000-4000-8000-000000000001",
    chapterId: null,
    resourceVersionId: null,
    code: "K7QM4P",
    title: "Uniform motion check",
    state: "lobby",
    timerS: 300,
    askStudentNo: true,
    createdAt: iso(T0 - 60_000),
    openedAt: null,
    endsAt: null,
    closedAt: null,
    revealedAt: null,
    endedAt: null,
    currentQuestionId: null,
    rev: 0,
    studentsPurgedAt: null,
    ...extra,
  };
}

export const openSession = (extra: Partial<LiveSession> = {}) => session({ state: "open", openedAt: iso(T0), endsAt: iso(T0 + 300_000), rev: 1, ...extra });

export const P = {
  sam: { id: "a0000000-0000-4000-8000-000000000001", name: "Sam Doe", studentNo: "200123", joinedAt: iso(T0 - 30_000) } as LiveParticipant,
  ari: { id: "a0000000-0000-4000-8000-000000000002", name: "Ari", studentNo: null, joinedAt: iso(T0 - 20_000) } as LiveParticipant,
  kai: { id: "a0000000-0000-4000-8000-000000000003", name: "Kai", studentNo: null, joinedAt: iso(T0 - 10_000) } as LiveParticipant,
};

let n = 0;
export function answer(participantId: string, questionId: string, response: LiveAnswer["response"], marks: number | null, extra: Partial<LiveAnswer> = {}): LiveAnswer {
  n++;
  return {
    id: `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    participantId,
    questionId,
    response,
    correct: marks === null ? null : extra.correct ?? marks > 0,
    marks,
    aiMarks: null,
    markedBy: marks === null ? null : "code",
    savedAt: iso(T0 + 60_000),
    ...extra,
  };
}

/** Keys that must never reach a phone before Reveal (and never as names at all). */
export const FORBIDDEN_KEYS = ["answer", "correctId", "tf", "rubric", "solution", "calc", "content", "token_hash", "tokenHash", "studentNo"];

/** Every object key anywhere inside a value. */
export function allKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) allKeys(v, out);
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      allKeys(v, out);
    }
  }
  return out;
}
