import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { AiError, aiConfig, complete } from "@/lib/ai/server";
import { curriculumPrompt, draftPrompt, evaluatePrompt, lessonPrompt, planPrompt, questionPrompt } from "@/lib/ai/teach-prompts";
import {
  parseJsonObject,
  SchemaError,
  validateCurriculumBlocks,
  validateDraft,
  validateEvaluation,
  validateLesson,
  validatePlan,
  validateQuestion,
} from "@/lib/ai/teach-schema";
import { allowedIndicatorIds, usableOutcome } from "@/lib/curriculum/catalog";
import { BLOCK_KINDS, type BlockKind } from "@/lib/curriculum/lesson";
import { validateQuestion as validateAiQuestion } from "@/lib/ai/teach-schema";

export const runtime = "nodejs";

/**
 * The adaptive teaching endpoint. Four tasks, each one model call returning
 * validated JSON. Course text and student answers are used for the request
 * and not logged.
 */

const LIMITS = { outline: 16000, source: 8000, answer: 3000, prompts: 10 } as const;

type Body = Record<string, unknown>;

const text = (v: unknown, max: number, fallback = "") => (typeof v === "string" ? v.slice(0, max) : fallback);
const conceptOf = (v: unknown) => {
  const c = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return { title: text(c.title, 120, "Concept"), objective: text(c.objective, 300) || undefined };
};

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Invalid JSON." }, { status: 400 });
  }
  const task = body.task;
  const courseName = text(body.courseName, 80, "this course");

  // Curriculum tasks: the outcome must be in the verified catalog, with its wording intact, before anything else.
  let outcome: Extract<ReturnType<typeof usableOutcome>, { ok: true }>["found"] | null = null;
  if (task === "curriculum-lesson" || task === "curriculum-block") {
    const usable = usableOutcome(body.outcomeId, sha256);
    if (!usable.ok) return NextResponse.json({ ok: false, reason: "invalid-outcome", message: usable.reason }, { status: 400 });
    outcome = usable.found;
  }

  if (!aiConfig()) {
    return NextResponse.json({ ok: false, reason: "not-configured", message: "No AI provider is configured on the server." });
  }

  try {
    switch (task) {
      case "curriculum-lesson":
      case "curriculum-block": {
        if (!outcome) return bad("Missing outcome.");
        const kinds: BlockKind[] =
          task === "curriculum-lesson" ? [...BLOCK_KINDS] : BLOCK_KINDS.filter((k) => k === body.kind);
        if (kinds.length === 0) return bad("Unknown block kind.");
        const o = outcome.outcome;
        const { system, user } = curriculumPrompt(
          { id: o.id, code: o.code, statement: o.statement, course: outcome.course.name, unit: outcome.unit.name },
          kinds,
        );
        const raw = await complete({ system, user, maxTokens: task === "curriculum-lesson" ? 7000 : 2500 });
        const blocks = validateCurriculumBlocks(parseJsonObject(raw), {
          allowedOutcomeIds: [o.id],
          allowedIndicatorIds: [...allowedIndicatorIds(o)],
          kinds,
          ids: task === "curriculum-block" && typeof body.blockId === "string" ? [body.blockId.slice(0, 40)] : undefined,
        });
        return NextResponse.json({ ok: true, data: blocks });
      }
      case "plan": {
        const outline = text(body.outline, LIMITS.outline);
        const sectionCount = Number.isInteger(body.sectionCount) ? (body.sectionCount as number) : 0;
        if (!outline || sectionCount <= 0) return bad("Missing document outline.");
        const { system, user } = planPrompt(courseName, text(body.fileName, 120, "document"), outline);
        const raw = await complete({ system, user, maxTokens: 4000 });
        return NextResponse.json({ ok: true, data: validatePlan(parseJsonObject(raw), sectionCount) });
      }
      case "lesson": {
        const source = text(body.source, LIMITS.source);
        if (!source) return bad("Missing source excerpts.");
        const { system, user } = lessonPrompt(courseName, conceptOf(body.concept), source);
        const raw = await complete({ system, user, maxTokens: 4000 });
        return NextResponse.json({ ok: true, data: validateLesson(parseJsonObject(raw)) });
      }
      case "draft": {
        const source = text(body.source, LIMITS.source);
        if (!source) return bad("Missing source excerpts.");
        const { system, user } = draftPrompt(courseName, conceptOf(body.concept), source);
        const raw = await complete({ system, user, maxTokens: 3000 });
        return NextResponse.json({ ok: true, data: validateDraft(parseJsonObject(raw)) });
      }
      case "evaluate": {
        const answer = text(body.answer, LIMITS.answer).trim();
        const explanation = text(body.explanation, 4000);
        if (!answer || !explanation) return bad("Missing answer or explanation.");
        const question = validateAiQuestion(body.question);
        const attempt = Number.isInteger(body.attempt) && (body.attempt as number) > 0 ? (body.attempt as number) : 1;
        const { system, user } = evaluatePrompt({
          courseName,
          concept: conceptOf(body.concept),
          explanation,
          question,
          answer,
          attempt,
          source: text(body.source, LIMITS.source),
        });
        const raw = await complete({ system, user, maxTokens: 2500 });
        return NextResponse.json({ ok: true, data: validateEvaluation(parseJsonObject(raw)) });
      }
      case "question": {
        const explanation = text(body.explanation, 4000);
        if (!explanation) return bad("Missing explanation.");
        const previousPrompts = Array.isArray(body.previousPrompts)
          ? body.previousPrompts.filter((p): p is string => typeof p === "string").slice(0, LIMITS.prompts).map((p) => p.slice(0, 600))
          : [];
        const { system, user } = questionPrompt({
          courseName,
          concept: conceptOf(body.concept),
          explanation,
          previousPrompts,
          source: text(body.source, LIMITS.source),
        });
        const raw = await complete({ system, user, maxTokens: 1500 });
        return NextResponse.json({ ok: true, data: validateQuestion(parseJsonObject(raw)) });
      }
      default:
        return bad("Unknown task.");
    }
  } catch (error) {
    if (error instanceof AiError) return NextResponse.json({ ok: false, reason: error.code, message: error.message });
    if (error instanceof SchemaError) return NextResponse.json({ ok: false, reason: "invalid-response", message: `The model's reply could not be used: ${error.message}` });
    console.error("Teach request failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ ok: false, reason: "provider", message: "The AI request failed." });
  }
}

function bad(message: string) {
  return NextResponse.json({ ok: false, reason: "bad-request", message }, { status: 400 });
}
