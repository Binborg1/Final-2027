import { parseJsonObject, SchemaError } from "@/lib/ai/json";
import { buildMarkJob, validateMarkReply } from "@/lib/live/mark-ai";
import { displayResponse } from "@/lib/live/questions";
import { GRACE_MS } from "@/lib/live/state";
import type { LiveAnswer, LiveQuestion } from "@/lib/live/types";
import { currentSession, err, ok, type Deps, type Result } from "@/lib/live/handlers/result";

/**
 * Funza marks the short answers once time is up (FR-12): one AI call per
 * question, at most four at a time, each one counted against the teacher's daily
 * allowance and logged as "live-mark". A question is claimed before it is marked,
 * so a second tab can't mark it twice. When Funza can't mark a question (no AI
 * configured, the allowance used up, an error), its answers stay unmarked and the
 * teacher marks them by hand.
 */

export type AiCall = { text: string; model: string; tokensIn: number | null; tokensOut: number | null };

export type MarkDeps = Deps & {
  teacherId: string;
  ai: {
    configured: () => boolean;
    complete: (input: { system: string; user: string; maxTokens: number }) => Promise<AiCall>;
    /** True for a "busy, try again" error from the provider. */
    isBusy: (error: unknown) => boolean;
    /** A message safe to show the teacher. */
    describe: (error: unknown) => string;
  };
  allowance: {
    remaining: () => Promise<number | null>;
    record: (call: AiCall) => Promise<void>;
  };
  randomId: () => string;
  sleep: (ms: number) => Promise<void>;
};

/** How long a claim lasts before another request may take the question over. */
export const STALE_MS = 3 * 60_000;
const CONCURRENCY = 4;
const COULDNT = "Funza couldn't mark these. Mark them yourself, or try again.";

type Outcome = { questionId: string; marked: number } | { questionId: string; failed: string };

async function markOne(deps: MarkDeps, sessionId: string, q: LiveQuestion, all: LiveAnswer[]): Promise<Outcome> {
  const answers = all.filter((a) => a.questionId === q.id && "text" in a.response && a.response.text.trim());
  if (answers.length === 0) {
    await deps.store.finishMarking(q.id, "done", null);
    return { questionId: q.id, marked: 0 };
  }
  const job = buildMarkJob(
    { stem: q.content.stem, rubric: q.content.answer.rubric ?? [], solution: q.content.answer.solution ?? "", marks: q.content.marks },
    answers.map((a) => ({ answerId: a.id, text: displayResponse(q.content, a.response) })),
    deps.randomId,
  );
  let lastError: unknown = null;
  for (let attempt = 0, schemaRetries = 0; attempt < 4; attempt++) {
    try {
      const reply = await deps.ai.complete({ system: job.system, user: job.user, maxTokens: Math.min(8000, 400 + 60 * job.idsByRid.size) });
      await deps.allowance.record(reply);
      const checked = validateMarkReply(parseJsonObject(reply.text), job.idsByRid, q.content.marks);
      const marks = [...checked.marks].map(([id, m]) => ({ id, marks: m }));
      if (marks.length) await deps.store.setMarks(sessionId, "ai", marks);
      await deps.store.finishMarking(q.id, "done", checked.summary);
      return { questionId: q.id, marked: marks.length };
    } catch (error) {
      lastError = error;
      if (error instanceof SchemaError && schemaRetries++ < 1) continue;
      if (deps.ai.isBusy(error) && attempt < 2) {
        await deps.sleep(attempt === 0 ? 1000 : 3000);
        continue;
      }
      break;
    }
  }
  const note = lastError instanceof SchemaError ? COULDNT : deps.ai.describe(lastError) || COULDNT;
  await deps.store.finishMarking(q.id, "failed", note.slice(0, 300));
  return { questionId: q.id, failed: note };
}

/** POST /api/live/[id]/mark ({retry: true} also retries questions that failed). */
export async function handleMark(deps: MarkDeps, id: string, retry: boolean): Promise<Result> {
  const s = await currentSession(deps, id);
  if (!s) return err(404, "not-found", "That live session wasn't found.");
  if (s.state !== "closed" && s.state !== "revealed") return err(409, "state", "Funza marks once time is up.");
  const end = s.endsAt ? Date.parse(s.endsAt) : 0;
  if (deps.now() < end + GRACE_MS + 500) return err(409, "too-early", "Funza starts marking a moment after time is up.");

  const short = (await deps.store.questions(id)).filter((q) => q.content.type === "short");
  if (short.length === 0) return ok({ marked: 0, failed: [] });
  const claimed = new Set(await deps.store.claimMarking(id, short.map((q) => q.id), new Date(deps.now() - STALE_MS).toISOString(), retry));
  const mine = short.filter((q) => claimed.has(q.id));
  if (mine.length === 0) return ok({ marked: 0, failed: [] });
  deps.ping(id, "teacher", "marks", s.rev);

  // Questions Funza can't take on stay unmarked, with the reason.
  let room = mine.length;
  let reason = "";
  if (!deps.ai.configured()) {
    room = 0;
    reason = "No AI is set up on this Funza server. Mark these yourself.";
  } else {
    const remaining = await deps.allowance.remaining();
    if (remaining === null) {
      room = 0;
      reason = "Funza couldn't check today's AI allowance. Try again in a moment, or mark these yourself.";
    } else if (remaining < room) {
      room = Math.max(0, remaining);
      reason = "You've used today's Funza actions. Mark these yourself; they reset at midnight.";
    }
  }
  const outcomes: Outcome[] = [];
  for (const q of mine.slice(room)) {
    await deps.store.finishMarking(q.id, "failed", reason);
    outcomes.push({ questionId: q.id, failed: reason });
  }

  const queue = mine.slice(0, room);
  const all = queue.length ? await deps.store.answers(id) : [];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let q = queue.shift(); q; q = queue.shift()) outcomes.push(await markOne(deps, id, q, all));
  });
  await Promise.all(workers);
  deps.ping(id, "teacher", "marks", s.rev);
  if (s.state === "revealed") deps.ping(id, "state", "marks", s.rev);

  return ok({
    marked: outcomes.reduce((n, o) => n + ("marked" in o ? o.marked : 0), 0),
    failed: outcomes.filter((o): o is { questionId: string; failed: string } => "failed" in o),
  });
}
