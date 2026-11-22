import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { teacherForRequest, unauthorized } from "@/lib/auth/api";
import { parseJsonObject, SchemaError } from "@/lib/ai/json";
import { itemPrompt, resourcePrompt, type PromptOutcome } from "@/lib/ai/resource-prompts";
import { AiError, aiConfig, complete } from "@/lib/ai/server";
import { findOutcome, outcomeProblems } from "@/lib/curriculum/catalog";
import { loadDataset } from "@/lib/curriculum/dataset";
import { validateItemReply, validateResourceReply } from "@/lib/resources/ai-reply";
import { isQuestionKind, QTYPE_ORDER } from "@/lib/resources/kinds";
import { isObject, sanitizeBrief, str } from "@/lib/resources/sanitize";
import type { Difficulty, QType } from "@/lib/resources/types";

export const runtime = "nodejs";

/**
 * Drafting for Make, for signed-in teachers only (401 otherwise). Every request
 * names catalog outcomes; the server re-reads them, checks their wording against
 * its fingerprint, and sends the model only those ids and their verbatim
 * statements. Replies are validated before they leave the server. Material text
 * is used for the request only.
 */

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Tells a signed-in teacher whether an AI provider is configured, without revealing the key or the model. */
export async function GET(request: NextRequest) {
  const teacher = await teacherForRequest(request);
  if (!teacher) return unauthorized();
  const cfg = aiConfig();
  return teacher.respond(NextResponse.json(cfg ? { configured: true, provider: cfg.provider } : { configured: false }, { headers: { "Cache-Control": "no-store" } }));
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
  return teacher.respond(await draft(request));
}

async function draft(request: NextRequest): Promise<NextResponse> {
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
    if (body.task === "resource-draft") {
      const { system, user } = resourcePrompt(brief, checked.outcomes);
      const raw = await complete({ system, user, maxTokens: isQuestionKind(brief.kind) ? 9000 : 7000 });
      const draft = validateResourceReply(brief, parseJsonObject(raw));
      return NextResponse.json({ ok: true, data: { ...draft, provider: cfg.provider } });
    }
    if (body.task === "resource-item") {
      const type = QTYPE_ORDER.find((t) => t === body.type) as QType | undefined;
      const outcomeId = typeof body.outcomeId === "string" && brief.outcomeIds.includes(body.outcomeId) ? body.outcomeId : brief.outcomeIds[0];
      if (!type) return bad("Unknown question type.");
      const marks = typeof body.marks === "number" && body.marks >= 1 && body.marks <= 50 ? Math.round(body.marks) : 1;
      const difficulty = (["foundational", "grade", "extending"] as const).find((d) => d === body.difficulty) ?? ("grade" as Difficulty);
      const avoid = (Array.isArray(body.avoid) ? body.avoid : []).map((a) => str(a, 300)).filter(Boolean).slice(0, 40);
      const { system, user } = itemPrompt(brief, checked.outcomes, { type, marks, difficulty, outcomeId }, str(body.guidance, 300), avoid);
      const raw = await complete({ system, user, maxTokens: 2500 });
      return NextResponse.json({ ok: true, data: { item: validateItemReply(brief, parseJsonObject(raw), type, marks), provider: cfg.provider } });
    }
    return bad("Unknown task.");
  } catch (error) {
    if (error instanceof AiError) return NextResponse.json({ ok: false, reason: error.code, message: error.message });
    if (error instanceof SchemaError) return NextResponse.json({ ok: false, reason: "invalid-response", message: error.message });
    console.error("Teach request failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ ok: false, reason: "provider", message: "The AI request failed." });
  }
}
