import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { teacherForRequest, unauthorized, type ApiTeacher } from "@/lib/auth/api";
import { allowanceMessage, dailyLimit, recordUsage, remainingToday, usedToday } from "@/lib/ai/allowance";
import { parseJsonObject, SchemaError } from "@/lib/ai/json";
import { itemPrompt, resourcePrompt, type PromptOutcome } from "@/lib/ai/resource-prompts";
import { AiError, aiConfig, complete, completeStream, writtenSoFar } from "@/lib/ai/server";
import { findOutcome, outcomeProblems } from "@/lib/curriculum/catalog";
import { loadDataset } from "@/lib/curriculum/dataset";
import { validateItemReply, validateResourceReply } from "@/lib/resources/ai-reply";
import { isQuestionKind, QTYPE_ORDER } from "@/lib/resources/kinds";
import { liveBrief, livePrompt } from "@/lib/live/suggest";
import { sameOrigin } from "@/lib/origin";
import { applyTemplate } from "@/lib/templates/apply";
import type { TemplateGuide } from "@/lib/templates/model";
import { fromAiReply, sanitizeTemplateRequest, templateReadPrompt } from "@/lib/templates/read";
import { guideOf, loadTemplateFor } from "@/lib/templates/server";
import { isObject, sanitizeBrief, str } from "@/lib/resources/sanitize";
import type { Brief, Difficulty, QType } from "@/lib/resources/types";

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
  if (!sameOrigin(request)) return teacher.respond(NextResponse.json({ ok: false, reason: "forbidden", message: "Cross-site request refused." }, { status: 403 }));
  return teacher.respond(await draft(request, teacher));
}

/** One AI call: its `ai_usage` task name, the prompt, and how the reply becomes the response's data. */
type Job = { task: "resource-draft" | "resource-item" | "live-suggest" | "template-read"; system: string; user: string; maxTokens: number; data: (reply: string) => unknown };

/** The daily allowance (FR-30). If today's count can't be read, nothing goes to the AI. */
async function allowanceProblem(teacherId: string): Promise<NextResponse | null> {
  const limit = dailyLimit();
  const used = await usedToday(teacherId).catch((error: unknown) => {
    console.error("AI allowance check failed:", error instanceof Error ? error.message : "unknown error");
    return null;
  });
  if (used === null) return NextResponse.json({ ok: false, reason: "allowance-unavailable", message: "Funza couldn’t check today’s AI allowance. Nothing was saved. Try again in a moment." });
  if (used >= limit) return NextResponse.json({ ok: false, reason: "allowance", message: allowanceMessage(limit) });
  return null;
}

/** One AI call, after the allowance; a finished call is logged even if its reply then fails validation. */
async function runJob(job: Job, teacherId: string): Promise<NextResponse> {
  const blocked = await allowanceProblem(teacherId);
  if (blocked) return blocked;
  const reply = await complete({ system: job.system, user: job.user, maxTokens: job.maxTokens });
  await recordUsage({ teacherId, task: job.task, model: reply.model, tokensIn: reply.tokensIn, tokensOut: reply.tokensOut });
  return NextResponse.json({ ok: true, data: job.data(reply.text) });
}

/**
 * Templates: "Read the format" (FR-20). The examples are text from the teacher's own
 * files, used for this request only: never stored, never logged.
 */
async function templateRead(body: Record<string, unknown>, teacherId: string): Promise<NextResponse> {
  const req = sanitizeTemplateRequest(body);
  if (!req.ok) return bad(req.message);
  const cfg = aiConfig();
  if (!cfg) return NextResponse.json({ ok: false, reason: "not-configured", message: "No AI provider is configured on this Funza server." });
  try {
    const { system, user } = templateReadPrompt(req.value);
    return await runJob({ task: "template-read", system, user, maxTokens: 3000, data: (reply) => ({ ...fromAiReply(req.value, parseJsonObject(reply)), provider: cfg.provider }) }, teacherId);
  } catch (error) {
    return NextResponse.json(failure(error));
  }
}

async function draft(request: NextRequest, teacher: ApiTeacher): Promise<NextResponse> {
  const teacherId = teacher.id;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Invalid JSON.");
  }
  if (!isObject(body)) return bad("Invalid request.");
  if (body.task === "template-read") return templateRead(body, teacherId);
  const parsed = sanitizeBrief(body.brief);
  if (!parsed) return bad("The brief is missing or malformed.");
  const checked = outcomesFor(parsed.outcomeIds);
  if (!checked.ok) return bad(checked.message, "invalid-outcome");

  const cfg = aiConfig();
  if (!cfg) return NextResponse.json({ ok: false, reason: "not-configured", message: "No AI provider is configured on this Funza server." });

  // A draft from the teacher's template (FR-20): the stored template, read as this teacher,
  // replaces whatever layout or parts the browser sent.
  let brief: Brief = parsed;
  let guide: TemplateGuide | undefined;
  if (body.task === "resource-draft" && parsed.templateId) {
    const loaded = await loadTemplateFor(teacher.supabase, parsed.templateId, parsed.kind);
    if (!loaded.ok) return bad(loaded.message, loaded.reason);
    brief = applyTemplate(parsed, loaded.template);
    guide = guideOf(loaded.template);
  }

  try {
    let job: Job;
    if (body.task === "resource-draft") {
      const { system, user } = resourcePrompt(brief, checked.outcomes, guide);
      const questions = brief.layout ? brief.layout.reduce((n, s) => n + s.rows.reduce((m, r) => m + r.count, 0), 0) : 0;
      const maxTokens = brief.layout ? Math.min(16000, Math.max(9000, 2000 + 220 * questions)) : isQuestionKind(brief.kind) ? 9000 : 7000;
      job = { task: body.task, system, user, maxTokens, data: (reply) => ({ ...validateResourceReply(brief, parseJsonObject(reply)), provider: cfg.provider }) };
    } else if (body.task === "resource-item") {
      const type = QTYPE_ORDER.find((t) => t === body.type) as QType | undefined;
      const outcomeId = typeof body.outcomeId === "string" && brief.outcomeIds.includes(body.outcomeId) ? body.outcomeId : brief.outcomeIds[0];
      if (!type) return bad("Unknown question type.");
      const marks = typeof body.marks === "number" && body.marks >= 1 && body.marks <= 50 ? Math.round(body.marks) : 1;
      const difficulty = (["foundational", "grade", "extending"] as const).find((d) => d === body.difficulty) ?? ("grade" as Difficulty);
      const avoid = (Array.isArray(body.avoid) ? body.avoid : []).map((a) => str(a, 300)).filter(Boolean).slice(0, 40);
      const { system, user } = itemPrompt(brief, checked.outcomes, { type, marks, difficulty, outcomeId }, str(body.guidance, 300), avoid);
      job = { task: body.task, system, user, maxTokens: 2500, data: (reply) => ({ item: validateItemReply(brief, parseJsonObject(reply), type, marks), provider: cfg.provider }) };
    } else if (body.task === "live-suggest") {
      // Live setup: phone types only, short questions, none repeating the set (FR-6).
      const live = liveBrief(brief);
      const avoid = (Array.isArray(body.avoid) ? body.avoid : []).map((a) => str(a, 300)).filter(Boolean).slice(0, 40);
      const { system, user } = livePrompt(live, checked.outcomes, avoid);
      job = { task: body.task, system, user, maxTokens: 7000, data: (reply) => ({ ...validateResourceReply(live, parseJsonObject(reply)), provider: cfg.provider }) };
    } else {
      return bad("Unknown task.");
    }

    if (body.stream === true && job.task !== "resource-item") {
      const blocked = await allowanceProblem(teacherId);
      if (blocked) return blocked;
      return streamed(job, teacherId, job.task === "live-suggest" || isQuestionKind(brief.kind) ? "items" : "sections");
    }
    return await runJob(job, teacherId);
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
