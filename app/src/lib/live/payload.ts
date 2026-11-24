import { verdict, type Verdict } from "@/lib/live/mark";
import { displayKey, displayResponse, publicQuestion, type PublicQuestion } from "@/lib/live/questions";
import { liveResults, type OptionCount } from "@/lib/live/results";
import { effectiveState } from "@/lib/live/state";
import type { LiveAnswer, LiveParticipant, LiveQuestion, LiveResponse, LiveSession, LiveState, LiveType, MarkedBy, MarkState } from "@/lib/live/types";

/**
 * What each screen receives. A phone gets the questions without keys while it
 * answers, and only its own result after Reveal. The console gets names and, once
 * time is up, every answer with its mark. The projector gets the console's view
 * without names, student numbers or answers.
 */

const byPosition = (qs: LiveQuestion[]) => [...qs].sort((a, b) => a.position - b.position);
const marked = (s: LiveState) => s === "closed" || s === "revealed" || s === "ended";

/* ---------- phone ---------- */

export type PhoneResultItem = { n: number; stem: string; type: LiveType; yours: string | null; key: string; marks: number | null; max: number; verdict: Verdict };

export type PhoneState = {
  rev: number;
  serverNow: string;
  state: LiveState;
  title: string;
  me: { name: string };
  total: number;
  timerS?: number;
  openedAt?: string | null;
  endsAt?: string | null;
  questions?: PublicQuestion[];
  mine?: Record<string, LiveResponse>;
  answered?: number;
  result?: { score: number; max: number; percent: number; items: PhoneResultItem[] };
};

export function phoneView(args: { session: LiveSession; questions: LiveQuestion[]; me: LiveParticipant; mine: LiveAnswer[]; now: number }): PhoneState {
  const { session, me, mine, now } = args;
  const questions = byPosition(args.questions);
  const state = effectiveState(session, now);
  const base: PhoneState = { rev: session.rev, serverNow: new Date(now).toISOString(), state, title: session.title, me: { name: me.name }, total: questions.length };
  if (state === "lobby") return { ...base, timerS: session.timerS };
  if (state === "open") {
    const answers: Record<string, LiveResponse> = {};
    for (const a of mine) answers[a.questionId] = a.response;
    return { ...base, openedAt: session.openedAt, endsAt: session.endsAt, questions: questions.map((q, i) => publicQuestion(q.id, i + 1, q.content)), mine: answers };
  }
  if (state === "closed" || (state === "ended" && !session.revealedAt)) return { ...base, answered: mine.length };
  // Revealed, or ended after Reveal: this student's own result.
  const byQ = new Map(mine.map((a) => [a.questionId, a]));
  const items: PhoneResultItem[] = questions.map((q, i) => {
    const a = byQ.get(q.id) ?? null;
    const marks = a ? a.marks : 0;
    return {
      n: i + 1,
      stem: q.content.stem,
      type: q.content.type,
      yours: a ? displayResponse(q.content, a.response) : null,
      key: displayKey(q.content),
      marks,
      max: q.content.marks,
      verdict: a ? verdict(a.marks, q.content.marks) : "wrong",
    };
  });
  const max = questions.reduce((n, q) => n + q.content.marks, 0);
  const score = items.reduce((n, it) => n + (it.marks ?? 0), 0);
  return { ...base, answered: mine.length, result: { score, max, percent: max ? Math.round((100 * score) / max) : 0, items } };
}

/* ---------- console ---------- */

export type ConsoleQuestion = {
  id: string;
  n: number;
  type: LiveType;
  stem: string;
  marks: number;
  outcomeRef: string | null;
  answered: number;
  markState: MarkState;
  markNote: string | null;
  /** From time up onwards. */
  key: string | null;
  options: OptionCount[] | null;
  right: number;
  partly: number;
  wrong: number;
  unmarked: number;
  percentRight: number | null;
  commonWrong: { text: string; count: number; percent: number } | null;
};

export type ConsoleStudent = { id: string; name: string; studentNo: string | null; answered: string[]; finished: boolean; score: number | null };

export type ConsoleAnswer = { id: string; participantId: string; questionId: string; text: string; marks: number | null; aiMarks: number | null; markedBy: MarkedBy | null; verdict: Verdict };

export type ConsoleSnapshot = {
  session: {
    id: string;
    code: string;
    title: string;
    state: LiveState;
    timerS: number;
    askStudentNo: boolean;
    openedAt: string | null;
    endsAt: string | null;
    closedAt: string | null;
    revealedAt: string | null;
    endedAt: string | null;
    currentQuestionId: string | null;
    rev: number;
    serverNow: string;
    joinUrl: string;
    courseId: string;
    chapterId: string | null;
    purged: boolean;
  };
  totals: { joined: number; started: number; finished: number; notStarted: number; answersIn: number; answersPossible: number };
  questions: ConsoleQuestion[];
  students: ConsoleStudent[];
  answers: ConsoleAnswer[];
};

export function consoleView(args: { session: LiveSession; questions: LiveQuestion[]; participants: LiveParticipant[]; answers: LiveAnswer[]; now: number; joinUrl: string }): ConsoleSnapshot {
  const { session, participants, answers, now, joinUrl } = args;
  const questions = byPosition(args.questions);
  const state = effectiveState(session, now);
  const showMarks = marked(state);
  const purged = Boolean(session.studentsPurgedAt);
  const results = liveResults({ questions, participants, answers, purged });
  const answeredBy = new Map<string, string[]>();
  for (const a of answers) answeredBy.set(a.participantId, [...(answeredBy.get(a.participantId) ?? []), a.questionId]);

  const cq: ConsoleQuestion[] = questions.map((q, i) => {
    const r = results.questions[i];
    return {
      id: q.id,
      n: i + 1,
      type: q.content.type,
      stem: q.content.stem,
      marks: q.content.marks,
      outcomeRef: q.content.outcomeRef,
      answered: r.answered,
      markState: q.markState,
      markNote: q.markNote,
      key: showMarks ? r.key : null,
      options: showMarks ? r.options : null,
      right: showMarks ? r.right : 0,
      partly: showMarks ? r.partly : 0,
      wrong: showMarks ? r.wrong : 0,
      unmarked: showMarks ? r.unmarked : 0,
      percentRight: showMarks ? r.percentRight : null,
      commonWrong: showMarks ? r.commonWrong : null,
    };
  });

  const students: ConsoleStudent[] = participants.map((p) => {
    const done = answeredBy.get(p.id) ?? [];
    const score = results.students.find((s) => s.id === p.id)?.score ?? 0;
    return { id: p.id, name: p.name, studentNo: p.studentNo, answered: done, finished: questions.length > 0 && done.length >= questions.length, score: showMarks ? score : null };
  });

  const started = students.filter((s) => s.answered.length > 0).length;
  const finished = students.filter((s) => s.finished).length;
  const byId = new Map(questions.map((q) => [q.id, q]));
  return {
    session: {
      id: session.id,
      code: session.code,
      title: session.title,
      state,
      timerS: session.timerS,
      askStudentNo: session.askStudentNo,
      openedAt: session.openedAt,
      endsAt: session.endsAt,
      closedAt: session.closedAt,
      revealedAt: session.revealedAt,
      endedAt: session.endedAt,
      currentQuestionId: session.currentQuestionId,
      rev: session.rev,
      serverNow: new Date(now).toISOString(),
      joinUrl,
      courseId: session.courseId,
      chapterId: session.chapterId,
      purged,
    },
    totals: { joined: participants.length, started, finished, notStarted: participants.length - started, answersIn: answers.length, answersPossible: participants.length * questions.length },
    questions: cq,
    students,
    answers: showMarks
      ? answers.flatMap((a) => {
          const q = byId.get(a.questionId);
          if (!q) return [];
          return [{ id: a.id, participantId: a.participantId, questionId: a.questionId, text: displayResponse(q.content, a.response), marks: a.marks, aiMarks: a.aiMarks, markedBy: a.markedBy, verdict: verdict(a.marks, q.content.marks) }];
        })
      : [],
  };
}

/* ---------- projector ---------- */

export type ScreenSnapshot = {
  session: Omit<ConsoleSnapshot["session"], "askStudentNo">;
  totals: ConsoleSnapshot["totals"];
  questions: { id: string; n: number; type: LiveType; stem: string; key: string | null; options: OptionCount[] | null; percentRight: number | null }[];
};

/** The console's view for the projector: no names, no student numbers, no answers; keys only once revealed. */
export function screenView(s: ConsoleSnapshot): ScreenSnapshot {
  const revealed = s.session.state === "revealed" || s.session.state === "ended";
  const { askStudentNo: _ask, ...session } = s.session;
  void _ask;
  return {
    session,
    totals: s.totals,
    questions: s.questions.map((q) => ({
      id: q.id,
      n: q.n,
      type: q.type,
      stem: q.stem,
      key: revealed ? q.key : null,
      options: revealed ? q.options : null,
      percentRight: revealed ? q.percentRight : null,
    })),
  };
}
