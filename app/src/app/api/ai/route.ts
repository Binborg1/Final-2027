import { NextResponse } from "next/server";
import { buildPrompt, type AiQuestion, type AiTask } from "@/lib/ai/prompts";
import { AiError, aiConfig, complete } from "@/lib/ai/server";

export const runtime = "nodejs";

const TASKS: AiTask[] = ["solve", "feedback", "hint"];
const MAX_QUESTION_CHARS = 4000;
const MAX_CONTEXT_CHARS = 6000;
const MAX_ATTEMPT_CHARS = 3000;

/** Tells the browser whether an AI provider is configured, without revealing the key. */
export async function GET() {
  const cfg = aiConfig();
  return NextResponse.json(cfg ? { configured: true, provider: cfg.provider, model: cfg.model } : { configured: false });
}

type Body = {
  task?: AiTask;
  question?: Partial<AiQuestion>;
  context?: unknown;
  attempt?: unknown;
  courseName?: unknown;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Invalid JSON." }, { status: 400 });
  }
  const task = body.task;
  const text = typeof body.question?.text === "string" ? body.question.text.slice(0, MAX_QUESTION_CHARS) : "";
  if (!task || !TASKS.includes(task) || !text) {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Missing task or question." }, { status: 400 });
  }
  const question: AiQuestion = {
    label: typeof body.question?.label === "string" ? body.question.label.slice(0, 40) : "Question",
    text,
    parts: Array.isArray(body.question?.parts)
      ? body.question.parts
          .filter((p) => p && typeof p.label === "string" && typeof p.text === "string")
          .slice(0, 12)
          .map((p) => ({ label: p.label.slice(0, 4), text: p.text.slice(0, 1500) }))
      : [],
  };
  const context: string[] = [];
  let used = 0;
  if (Array.isArray(body.context)) {
    for (const c of body.context) {
      if (typeof c !== "string" || used + c.length > MAX_CONTEXT_CHARS) continue;
      context.push(c);
      used += c.length;
    }
  }
  const attempt = typeof body.attempt === "string" ? body.attempt.slice(0, MAX_ATTEMPT_CHARS) : undefined;
  const courseName = typeof body.courseName === "string" ? body.courseName.slice(0, 80) : "this course";

  if (!aiConfig()) {
    return NextResponse.json({ ok: false, reason: "not-configured", message: "No AI provider is configured on the server." });
  }
  try {
    const { system, user } = buildPrompt(task, question, context, attempt, courseName);
    const answer = await complete({ system, user, maxTokens: task === "solve" ? 8000 : 1200 });
    return NextResponse.json({ ok: true, text: answer });
  } catch (error) {
    if (error instanceof AiError) return NextResponse.json({ ok: false, reason: error.code, message: error.message });
    console.error("AI request failed", error);
    return NextResponse.json({ ok: false, reason: "provider", message: "The AI request failed." });
  }
}
