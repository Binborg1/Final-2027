import { z } from "zod";
import { makeCode } from "@/lib/live/code";
import { csvFilename, resultsCsv } from "@/lib/live/csv";
import { markExact } from "@/lib/live/mark";
import { consoleView, screenView } from "@/lib/live/payload";
import { contentFromBank, isLiveType } from "@/lib/live/questions";
import { liveResults } from "@/lib/live/results";
import { effectiveState, plan } from "@/lib/live/state";
import type { LiveContent } from "@/lib/live/types";
import { conflict, currentSession, err, isObj, ok, UUID, type Deps, type Result } from "@/lib/live/handlers/result";

/**
 * The teacher's live routes. They run as the signed-in teacher (row-level
 * security keeps each teacher to their own sessions), and every POST has passed
 * the same-site check in its route.
 */

export const MAX_OPEN_SESSIONS = 2;
export const MAX_QUESTIONS = 30;

export type TeacherDeps = Deps & { teacherId: string; randomInt: (max: number) => number };

const notFound = () => err(404, "not-found", "That live session wasn't found.");

/* ---------- start ---------- */

/** A question chosen on the setup screen: a bank row, or (from setup) a snapshot already made on the server. */
export type StartQuestion = { questionId: string } | { questionId: string | null; content: LiveContent };

export const startSchema = z.object({
  id: z.guid(),
  courseId: z.guid(),
  chapterId: z.guid().nullable().default(null),
  resourceVersionId: z.guid().nullable().default(null),
  title: z.string().trim().min(1).max(120),
  timerS: z.number().int().min(60).max(3600),
  askStudentNo: z.boolean(),
  questions: z.array(z.object({ questionId: z.guid() })).min(1).max(MAX_QUESTIONS),
});
export type StartInput = z.infer<typeof startSchema>;

/**
 * Creates a session in the lobby from bank questions (each one snapshotted with
 * its key). Refuses a third open session. Calling it again with the same id
 * returns the session already made.
 */
export async function handleStart(input: Omit<StartInput, "questions"> & { questions: StartQuestion[] }, deps: TeacherDeps): Promise<Result> {
  const existing = await deps.store.session(input.id);
  if (existing) return ok({ id: existing.id, code: existing.code });

  const open = await deps.store.openSessions(deps.teacherId);
  if (open.length >= MAX_OPEN_SESSIONS) {
    return err(409, "too-many-open", `You already have ${open.length} live sessions open. End one first.`, { data: open.map((s) => ({ id: s.id, title: s.title, code: s.code, state: s.state })) });
  }

  const fromBank = input.questions.filter((q): q is { questionId: string } => !("content" in q)).map((q) => q.questionId);
  const bank = new Map((await deps.store.bankQuestions(fromBank)).map((b) => [b.id, b]));
  const snapshots: { questionId: string | null; content: LiveContent }[] = [];
  for (const [i, q] of input.questions.entries()) {
    if ("content" in q) {
      snapshots.push(q);
      continue;
    }
    const row = bank.get(q.questionId);
    if (!row) return err(400, "bad-question", `Question ${i + 1} isn't in your question bank.`);
    const content = contentFromBank(row);
    if (!content || !isLiveType(row.type)) return err(400, "not-on-phones", `Question ${i + 1} can't be answered on phones yet.`);
    snapshots.push({ questionId: row.id, content });
  }

  let code = "";
  for (let attempt = 0; ; attempt++) {
    if (attempt === 5) return err(503, "busy", "Funza couldn't find a free join code. Try again.");
    code = makeCode(deps.randomInt);
    const r = await deps.store.insertSession({ ...input, teacherId: deps.teacherId, code });
    if (r === "ok") break;
    if (r === "exists") {
      const s = await deps.store.session(input.id);
      return s ? ok({ id: s.id, code: s.code }) : conflict();
    }
    if (r === "bad-ref") return err(400, "bad-course", "That course or chapter wasn't found.");
  }
  try {
    await deps.store.insertQuestions(snapshots.map((s, i) => ({ sessionId: input.id, teacherId: deps.teacherId, questionId: s.questionId, position: i + 1, content: s.content })));
  } catch (error) {
    await deps.store.deleteSession(input.id).catch(() => {});
    throw error;
  }
  return ok({ id: input.id, code });
}

/* ---------- the console's snapshot ---------- */

export async function snapshot(deps: Deps, id: string, joinOrigin: string, view: "console" | "screen" = "console"): Promise<Result> {
  const session = await currentSession(deps, id);
  if (!session) return notFound();
  const [questions, participants, answers] = await Promise.all([deps.store.questions(id), deps.store.participants(id), deps.store.answers(id)]);
  const snap = consoleView({ session, questions, participants, answers, now: deps.now(), joinUrl: `${joinOrigin}/join?code=${session.code}` });
  return ok(view === "screen" ? screenView(snap) : snap);
}

/* ---------- state changes ---------- */

export async function handleOpen(deps: Deps, id: string, joinOrigin: string): Promise<Result> {
  const s = await currentSession(deps, id);
  if (!s) return notFound();
  const p = plan("open", s, deps.now());
  if (!p.ok) return err(p.status, p.reason, p.message);
  if (!p.noop) {
    if ((await deps.store.questions(id)).length === 0) return err(409, "no-questions", "This session has no questions.");
    const updated = await deps.store.updateSession(id, p.expect, p.patch);
    if (!updated) return conflict();
    deps.ping(id, "state", "open", updated.rev);
    deps.ping(id, "teacher", "open", updated.rev);
  }
  return snapshot(deps, id, joinOrigin);
}

export async function handleClose(deps: Deps, id: string, joinOrigin: string): Promise<Result> {
  const s = await currentSession(deps, id);
  if (!s) return notFound();
  const p = plan("close", s, deps.now());
  if (!p.ok) return err(p.status, p.reason, p.message);
  if (!p.noop) {
    const updated = await deps.store.updateSession(id, p.expect, p.patch);
    if (!updated) return conflict();
    deps.ping(id, "state", "closed", updated.rev);
    deps.ping(id, "teacher", "closed", updated.rev);
  }
  return snapshot(deps, id, joinOrigin);
}

/** {} reveals the answers (from the first question); {questionId} moves the projector to another question. */
export async function handleReveal(deps: Deps, id: string, body: unknown, joinOrigin: string): Promise<Result> {
  const s = await currentSession(deps, id);
  if (!s) return notFound();
  const questions = await deps.store.questions(id);
  const step = isObj(body) && typeof body.questionId === "string" ? body.questionId.toLowerCase() : null;
  if (step && !questions.some((q) => q.id === step)) return err(400, "bad-question", "That question isn't in this session.");
  if (!step && questions.some((q) => q.markState === "running")) return err(409, "marking", "Funza is still marking. Reveal when it's done.");
  const p = step ? plan("step", s, deps.now(), { questionId: step }) : plan("reveal", s, deps.now(), { firstQuestionId: questions[0]?.id ?? null });
  if (!p.ok) return err(p.status, p.reason, p.message);
  if (!p.noop) {
    const updated = await deps.store.updateSession(id, p.expect, p.patch);
    if (!updated) return conflict();
    if (!step) deps.ping(id, "state", "revealed", updated.rev);
    deps.ping(id, "teacher", step ? "step" : "revealed", updated.rev);
  }
  return snapshot(deps, id, joinOrigin);
}

export async function handleEnd(deps: Deps, id: string): Promise<Result> {
  const s = await deps.store.session(id);
  if (!s) return notFound();
  if (s.state !== "ended") {
    await deps.store.endSession(id);
    deps.ping(id, "state", "ended", s.rev + 1);
    deps.ping(id, "teacher", "ended", s.rev + 1);
  }
  return ok({ resultsUrl: `/live/${id}/results` });
}

export async function handleRemove(deps: Deps, id: string, body: unknown, joinOrigin: string): Promise<Result> {
  if (!isObj(body) || typeof body.participantId !== "string" || !UUID.test(body.participantId)) return err(400, "bad-request", "Choose a student.");
  const s = await currentSession(deps, id);
  if (!s) return notFound();
  const state = effectiveState(s, deps.now());
  if (state !== "lobby" && state !== "open") return err(409, "state", "Students can be removed only before time is up.");
  await deps.store.removeParticipant(id, body.participantId.toLowerCase());
  deps.ping(id, "state", "roster", s.rev);
  deps.ping(id, "teacher", "roster", s.rev);
  return snapshot(deps, id, joinOrigin);
}

/** {answerId, marks} sets the teacher's mark; {answerId, undo: true} goes back to Funza's (or the exact) mark. */
export async function handleMarks(deps: Deps, id: string, body: unknown): Promise<Result> {
  if (!isObj(body) || typeof body.answerId !== "string" || !UUID.test(body.answerId)) return err(400, "bad-request", "Choose an answer.");
  const s = await currentSession(deps, id);
  if (!s) return notFound();
  if (s.state !== "closed" && s.state !== "revealed") return err(409, "state", s.state === "ended" ? "This session has ended, so its marks are final." : "Marks can change once time is up.");
  const answer = await deps.store.answer(id, body.answerId.toLowerCase());
  if (!answer) return err(404, "not-found", "That answer wasn't found.");
  const question = await deps.store.question(id, answer.questionId);
  if (!question) return err(404, "not-found", "That answer wasn't found.");

  if (body.undo === true) {
    const exact = markExact(question.content, answer.response);
    if (question.content.type !== "short" && exact) await deps.store.setMarks(id, "code", [{ id: answer.id, marks: exact.marks }]);
    else await deps.store.setMarks(id, "undo", [{ id: answer.id, marks: null }]);
  } else {
    if (typeof body.marks !== "number" || !Number.isFinite(body.marks)) return err(400, "bad-request", "Choose a mark.");
    await deps.store.setMarks(id, "teacher", [{ id: answer.id, marks: Math.max(0, Math.min(question.content.marks, Math.round(body.marks))) }]);
  }
  deps.ping(id, "teacher", "marks", s.rev);
  if (s.state === "revealed") deps.ping(id, "state", "marks", s.rev);
  const updated = await deps.store.answer(id, answer.id);
  return ok({ answer: updated });
}

/* ---------- results ---------- */

export async function handleCsv(deps: Deps, id: string): Promise<Result & { csv?: string; filename?: string }> {
  const s = await deps.store.session(id);
  if (!s) return notFound();
  const [questions, participants, answers] = await Promise.all([deps.store.questions(id), deps.store.participants(id), deps.store.answers(id)]);
  const results = liveResults({ questions, participants, answers, purged: Boolean(s.studentsPurgedAt) });
  const marks = new Map<string, Map<string, number | null>>();
  for (const a of answers) marks.set(a.participantId, (marks.get(a.participantId) ?? new Map()).set(a.questionId, a.marks));
  return { ...ok(null), csv: resultsCsv(results, marks), filename: csvFilename(s.title, new Date(s.createdAt)) };
}
