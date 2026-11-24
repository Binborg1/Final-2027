import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { teacherForRequest, unauthorized } from "@/lib/auth/api";
import { allowanceMessage, dailyLimit, recordUsage, remainingToday, usedToday } from "@/lib/ai/allowance";
import { parseJsonObject, SchemaError } from "@/lib/ai/json";
import { itemPrompt, resourcePrompt, type PromptOutcome } from "@/lib/ai/resource-prompts";
import { AiError, aiConfig, complete, completeStream, writtenSoFar } from "@/lib/ai/server";
import { findOutcome, outcomeProblems } from "@/lib/curriculum/catalog";
import { loadDataset } from "@/lib/curriculum/dataset";
import { validateItemReply, validateResourceReply } from "@/lib/resources/ai-reply";
import { isQuestionKind, QTYPE_ORDER } from "@/lib/resources/kinds";
import { isObject, sanitizeBrief, str } from "@/lib/resources/sanitize";
import type { Difficulty, QType } from "@/lib/resources/types";

export const runtime = "nodejs";
/** A long draft may take the AI up to two minutes (TIMEOUT_MS in lib/ai/server.ts), plus the checks around it. */
export const maxDuration = 150;

/**
 * Drafting for Make, for signed-in teachers only (401 otherwise). Every request
 * names catalog outcomes; the server re-reads them, checks their wording against
 * its fingerprint, and sends the model only those ids and their verbatim
 * statements. Each AI call passes the teacher's daily allowance first and is
 * logged in `ai_usage` when it succeeds. Replies are validated before they leave
 * the server. Material text is used for the request only.
 *
 * A whole draft can be streamed (`stream: true`): the response is then lines of
 * JSON, `{"type":"progress","written":n}` while the AI writes, and one
 * `{"type":"result",...}` at the end with the same body as the plain response.
 * Nothing unvalidated is streamed: progress is only a count.
 */

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/**
 * Tells a signed-in teacher whether an AI provider is configured, without
 * revealing the key or the model, and how many AI actions they have left today
 * (`remaining`, null when the database can't say).
 */
export async function GET(request: NextRequest) {
  const teacher = await teacherForRequest(request);
  if (!teacher) return unauthorized();
  const cfg = aiConfig();
  const remaining = await remainingToday(teacher.id);
  return teacher.respond(NextResponse.json(cfg ? { configured: true, provider: cfg.provider, remaining } : { configured: false, remaining }, { headers: { "Cache-Control": "no-store" } }));
}

function outcomesFor(ids: string[]): { ok: true; outcomes: PromptOutcome[] } | { ok: false; message: string } {
  if (ids.length === 0) return { ok: false, message: "Choose at least one curriculum outcome." };
  loadDataset();
  const outcomes: PromptOutcome[] = [];
  for (const id of ids) {
    const found = findOutcome(id);
    if (!found) return { ok: false, message: `"${id.slice(0, 40)}" is not in Funza's curriculum catalog.` };
    const problems = outcomeProblems(found, sha256);
    if (problems.length > 0) return { ok: false, message: problems[0] };
    const { outcome } = found;
    outcomes.push({ id, code: outcome.code, statement: outcome.statement, course: found.course.name, unit: found.unit.name, indicators: outcome.indicators.map((i) => ({ label: i.label, text: i.text })) });
  }
  return { ok: true, outcomes };
}

const bad = (message: string, reason = "bad-request") => NextResponse.json({ ok: false, reason, message }, { status: 400 });

export async function POST(request: NextRequest) {
  const teacher = await teacherForRequest(request);
  if (!teacher) return unauthorized();
  return teacher.respond(await draft(request, teacher.id));
}

/** One AI call: its `ai_usage` task name, the prompt, and how the reply becomes the response's data. */
type Job = { task: "resource-draft" | "resource-item"; system: string; user: string; maxTokens: number; data: (reply: string) => unknown };

async function draft(request: NextRequest, teacherId: string): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Invalid JSON.");
  }
  if (!isObject(body)) return bad("Invalid request.");
  const brief = sanitizeBrief(body.brief);
  if (!brief) return bad("The brief is missing or malformed.");
  const checked = outcomesFor(brief.outcomeIds);
  if (!checked.ok) return bad(checked.message, "invalid-outcome");

  const cfg = aiConfig();
  if (!cfg) return NextResponse.json({ ok: false, reason: "not-configured", message: "No AI provider is configured on this Funza server." });

  try {
    let job: Job;
    if (body.task === "resource-draft") {
      const { system, user } = resourcePrompt(brief, checked.outcomes);
      job = { task: body.task, system, user, maxTokens: isQuestionKind(brief.kind) ? 9000 : 7000, data: (reply) => ({ ...validateResourceReply(brief, parseJsonObject(reply)), provider: cfg.provider }) };
    } else if (body.task === "resource-item") {
      const type = QTYPE_ORDER.find((t) => t === body.type) as QType | undefined;
      const outcomeId = typeof body.outcomeId === "string" && brief.outcomeIds.includes(body.outcomeId) ? body.outcomeId : brief.outcomeIds[0];
      if (!type) return bad("Unknown question type.");
      const marks = typeof body.marks === "number" && body.marks >= 1 && body.marks <= 50 ? Math.round(body.marks) : 1;
      const difficulty = (["foundational", "grade", "extending"] as const).find((d) => d === body.difficulty) ?? ("grade" as Difficulty);
      const avoid = (Array.isArray(body.avoid) ? body.avoid : []).map((a) => str(a, 300)).filter(Boolean).slice(0, 40);
      const { system, user } = itemPrompt(brief, checked.outcomes, { type, marks, difficulty, outcomeId }, str(body.guidance, 300), avoid);
      job = { task: body.task, system, user, maxTokens: 2500, data: (reply) => ({ item: validateItemReply(brief, parseJsonObject(reply), type, marks), provider: cfg.provider }) };
    } else {
      return bad("Unknown task.");
    }

    // The daily allowance (FR-30). If today's count can't be read, nothing goes to the AI.
    const limit = dailyLimit();
    const used = await usedToday(teacherId).catch((error: unknown) => {
      console.error("AI allowance check failed:", error instanceof Error ? error.message : "unknown error");
      return null;
    });
    if (used === null) return NextResponse.json({ ok: false, reason: "allowance-unavailable", message: "Funza couldn’t check today’s AI allowance. Nothing was saved. Try again in a moment." });
    if (used >= limit) return NextResponse.json({ ok: false, reason: "allowance", message: allowanceMessage(limit) });

    if (body.stream === true && job.task === "resource-draft") return streamed(job, teacherId, isQuestionKind(brief.kind) ? "items" : "sections");

    const reply = await complete({ system: job.system, user: job.user, maxTokens: job.maxTokens });
    // A finished call counts even if its reply then fails validation: the tokens were spent.
    await recordUsage({ teacherId, task: job.task, model: reply.model, tokensIn: reply.tokensIn, tokensOut: reply.tokensOut });
    return NextResponse.json({ ok: true, data: job.data(reply.text) });
  } catch (error) {
    return NextResponse.json(failure(error));
  }
}

function failure(error: unknown): { ok: false; reason: string; message: string } {
  if (error instanceof AiError) return { ok: false, reason: error.code, message: error.message };
  if (error instanceof SchemaError) return { ok: false, reason: "invalid-response", message: error.message };
  console.error("Teach request failed:", error instanceof Error ? error.message : "unknown error");
  return { ok: false, reason: "provider", message: "The AI request failed." };
}

/** A draft written while the teacher watches: progress counts, then the validated result. */
function streamed(job: Job, teacherId: string, unit: "items" | "sections"): NextResponse {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      let last = -1;
      let lastAt = 0;
      send({ type: "progress", written: 0 });
      try {
        const reply = await completeStream({ system: job.system, user: job.user, maxTokens: job.maxTokens }, (soFar) => {
          const written = writtenSoFar(soFar, unit);
          const now = Date.now();
          if (written === last && now - lastAt < 3000) return;
          last = written;
          lastAt = now;
          send({ type: "progress", written });
        });
        await recordUsage({ teacherId, task: job.task, model: reply.model, tokensIn: reply.tokensIn, tokensOut: reply.tokensOut });
        let result: object;
        try {
          result = { ok: true, data: job.data(reply.text) };
        } catch (error) {
          result = failure(error);
        }
        send({ type: "result", ...result });
      } catch (error) {
        send({ type: "result", ...failure(error) });
      }
      controller.close();
    },
  });
  return new NextResponse(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
