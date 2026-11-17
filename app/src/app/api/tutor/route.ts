import { NextResponse } from "next/server";
import { AiError, aiConfig, complete, completeWithImage } from "@/lib/ai/server";
import { askPrompt, visionPrompt } from "@/lib/ai/tutor-prompts";
import { parseImagePayload, supportsVision } from "@/lib/ai/vision";

export const runtime = "nodejs";

/**
 * The screen-aware tutor. Two tasks:
 *   "ask":    the student's question plus a structured description of the workspace (text only).
 *   "vision": the same, plus one screenshot the student chose to share.
 * Keys stay on the server. Nothing here is logged or stored: the image lives
 * in this request and is gone when the reply is sent.
 */

const LIMITS = { question: 600, context: 8000, courseName: 80 } as const;

const text = (v: unknown, max: number, fallback = "") => (typeof v === "string" ? v.slice(0, max) : fallback);

/** Whether the tutor can answer, and whether it can look at screenshots, without revealing the key. */
export async function GET() {
  const cfg = aiConfig();
  if (!cfg) return NextResponse.json({ configured: false, vision: false });
  return NextResponse.json({ configured: true, vision: supportsVision(cfg.provider, cfg.model, process.env.FUNZA_AI_VISION), provider: cfg.provider, model: cfg.model });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bad("Invalid JSON.");
  }
  const task = body.task;
  const question = text(body.question, LIMITS.question).trim();
  const context = text(body.context, LIMITS.context);
  if ((task !== "ask" && task !== "vision") || !question) return bad("Missing task or question.");

  const cfg = aiConfig();
  if (!cfg) return NextResponse.json({ ok: false, reason: "not-configured", message: "No AI provider is configured on the server." });

  try {
    if (task === "ask") {
      const { system, user } = askPrompt(question, context);
      const reply = await complete({ system, user, maxTokens: 400 });
      return NextResponse.json({ ok: true, data: { text: reply } });
    }
    const image = parseImagePayload(body.image);
    if (!image) return bad("Missing or invalid image: send a JPEG, PNG or WebP as a base64 data URL, under 4 MB.");
    if (!supportsVision(cfg.provider, cfg.model, process.env.FUNZA_AI_VISION)) {
      return NextResponse.json({
        ok: false,
        reason: "no-vision",
        message: `The configured AI model (${cfg.model} on ${cfg.provider}) cannot read images, so the screenshot was not analyzed. Funza can still describe what is open in the app.`,
      });
    }
    const { system, user } = visionPrompt(question, context);
    const reply = await completeWithImage({ system, user, maxTokens: 450, image });
    return NextResponse.json({ ok: true, data: { text: reply } });
  } catch (error) {
    if (error instanceof AiError) return NextResponse.json({ ok: false, reason: error.code, message: error.message });
    console.error("Tutor request failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ ok: false, reason: "provider", message: "The AI request failed." });
  }
}

function bad(message: string) {
  return NextResponse.json({ ok: false, reason: "bad-request", message }, { status: 400 });
}
