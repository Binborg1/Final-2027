import { verdict, type Verdict } from "@/lib/live/mark";
import { displayKey, displayResponse } from "@/lib/live/questions";
import type { LiveAnswer, LiveParticipant, LiveQuestion, LiveType } from "@/lib/live/types";

/**
 * Results of a session: percent right per question (of the students who joined),
 * the most common wrong answer, each student's score, the class average and a
 * split by outcome (FR-14). After the 30-day purge only the anonymous counts per
 * question remain, and percent right is taken from those.
 */

export type OptionCount = { id: string; text: string; count: number; percent: number };

export type QuestionResult = {
  id: string;
  n: number;
  type: LiveType;
  stem: string;
  marks: number;
  outcomeRef: string | null;
  key: string;
  answered: number;
  right: number;
  partly: number;
  wrong: number;
  unmarked: number;
  percentRight: number | null;
  options: OptionCount[] | null;
  commonWrong: { text: string; count: number; percent: number } | null;
};

export type StudentResult = { id: string; name: string; studentNo: string | null; answered: number; score: number; max: number; percent: number };

export type Results = {
  joined: number;
  totalMarks: number;
  classAverage: number | null;
  questions: QuestionResult[];
  students: StudentResult[];
  byOutcome: { outcomeRef: string; percentRight: number; questions: number }[];
  purged: boolean;
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0);
const norm = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

function optionCounts(q: LiveQuestion, answers: LiveAnswer[], joined: number): OptionCount[] | null {
  const c = q.content;
  const opts = c.type === "mcq" ? (c.options ?? []) : c.type === "tf" ? [{ id: "true", text: "True" }, { id: "false", text: "False" }] : null;
  if (!opts) return null;
  return opts.map((o) => {
    const count = answers.filter((a) => "choice" in a.response && a.response.choice === o.id).length;
    return { id: o.id, text: o.text, count, percent: pct(count, joined) };
  });
}

function commonWrong(q: LiveQuestion, answers: LiveAnswer[], joined: number): QuestionResult["commonWrong"] {
  if (q.content.type === "short") return null;
  const tally = new Map<string, { text: string; count: number }>();
  for (const a of answers) {
    if (a.correct !== false) continue;
    const text = displayResponse(q.content, a.response);
    if (!text) continue;
    const key = norm(text);
    const t = tally.get(key) ?? { text, count: 0 };
    t.count++;
    tally.set(key, t);
  }
  let best: { text: string; count: number } | null = null;
  for (const t of tally.values()) if (!best || t.count > best.count) best = t;
  return best ? { ...best, percent: pct(best.count, joined) } : null;
}

export function liveResults(args: { questions: LiveQuestion[]; participants: LiveParticipant[]; answers: LiveAnswer[]; purged?: boolean }): Results {
  const { participants, answers } = args;
  const purged = Boolean(args.purged);
  const questions = [...args.questions].sort((a, b) => a.position - b.position);
  const joined = participants.length;
  const byQuestion = new Map<string, LiveAnswer[]>();
  for (const a of answers) byQuestion.set(a.questionId, [...(byQuestion.get(a.questionId) ?? []), a]);

  const qResults: QuestionResult[] = questions.map((q, i) => {
    const mine = byQuestion.get(q.id) ?? [];
    const v: Record<Verdict, number> = { right: 0, partly: 0, wrong: 0, unmarked: 0 };
    for (const a of mine) v[verdict(a.marks, q.content.marks)]++;
    let percentRight: number | null;
    if (purged || joined === 0) percentRight = q.answerCount ? pct(q.correctCount ?? 0, q.answerCount) : null;
    else percentRight = pct(v.right, joined);
    return {
      id: q.id,
      n: i + 1,
      type: q.content.type,
      stem: q.content.stem,
      marks: q.content.marks,
      outcomeRef: q.content.outcomeRef,
      key: displayKey(q.content),
      answered: purged ? (q.answerCount ?? 0) : mine.length,
      right: purged ? (q.correctCount ?? 0) : v.right,
      partly: v.partly,
      wrong: v.wrong,
      unmarked: v.unmarked,
      percentRight,
      options: purged ? null : optionCounts(q, mine, joined),
      commonWrong: purged ? null : commonWrong(q, mine, joined),
    };
  });

  const totalMarks = questions.reduce((n, q) => n + q.content.marks, 0);
  const students: StudentResult[] = participants.map((p) => {
    const theirs = answers.filter((a) => a.participantId === p.id);
    const score = theirs.reduce((n, a) => n + (a.marks ?? 0), 0);
    return { id: p.id, name: p.name, studentNo: p.studentNo, answered: theirs.length, score, max: totalMarks, percent: pct(score, totalMarks) };
  });
  const classAverage = students.length ? Math.round(students.reduce((n, s) => n + s.percent, 0) / students.length) : null;

  const outcomes = new Map<string, { right: number; possible: number; questions: number }>();
  for (const q of qResults) {
    if (!q.outcomeRef || q.percentRight === null) continue;
    const o = outcomes.get(q.outcomeRef) ?? { right: 0, possible: 0, questions: 0 };
    const possible = purged || joined === 0 ? q.answered : joined;
    o.right += q.right;
    o.possible += possible;
    o.questions++;
    outcomes.set(q.outcomeRef, o);
  }
  const byOutcome = [...outcomes].map(([outcomeRef, o]) => ({ outcomeRef, percentRight: pct(o.right, o.possible), questions: o.questions }));

  return { joined, totalMarks, classAverage, questions: qResults, students, byOutcome, purged };
}

/** The questions the class found hardest: lowest percent right first, then by position. */
export function mostMissed(r: Results, n = 3): QuestionResult[] {
  return r.questions
    .filter((q) => q.percentRight !== null && q.percentRight < 100)
    .sort((a, b) => (a.percentRight ?? 0) - (b.percentRight ?? 0) || a.n - b.n)
    .slice(0, n);
}
