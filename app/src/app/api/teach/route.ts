import { NextResponse } from "next/server";
import { AiError, aiConfig, complete } from "@/lib/ai/server";
import { evaluatePrompt, lessonPrompt, planPrompt, questionPrompt } from "@/lib/ai/teach-prompts";
import { parseJsonObject, SchemaError, validateEvaluation, validateLesson, validatePlan, validateQuestion } from "@/lib/ai/teach-schema";
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

export async function POST(request: Request) {
  if (!aiConfig()) {
    return NextResponse.json({ ok: false, reason: "not-configured", message: "No AI provider is configured on the server." });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Invalid JSON." }, { status: 400 });
  }
  const task = body.task;
  const courseName = text(body.courseName, 80, "this course");

  try {
    switch (task) {
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
