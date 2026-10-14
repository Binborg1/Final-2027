import type { AiEvaluation, AiLesson, AiQuestion } from "@/lib/types";
import { validateVisualization } from "@/lib/visualizations/registry";

/** Validation of model output before anything reaches the screen. Throws on anything malformed. */

export type PlanResponse = {
  topicTitle: string;
  objectives: string[];
  concepts: { title: string; objective: string; sectionIndexes: number[] }[];
};

export class SchemaError extends Error {}

/** Pulls the first JSON object out of a model reply, tolerating code fences and chatter. */
export function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new SchemaError("The model did not return JSON.");
  try {
    const value = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new SchemaError("Expected a JSON object.");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SchemaError) throw error;
    throw new SchemaError("The model returned invalid JSON.");
  }
}

const str = (v: unknown, field: string, max = 4000): string => {
  if (typeof v !== "string" || !v.trim()) throw new SchemaError(`Missing "${field}".`);
  return v.trim().slice(0, max);
};
const optStr = (v: unknown, max = 4000): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const strList = (v: unknown, max = 8): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 300)).slice(0, max) : [];

export function validatePlan(raw: Record<string, unknown>, sectionCount: number): PlanResponse {
  const concepts = Array.isArray(raw.concepts) ? raw.concepts : [];
  const parsed = concepts
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      title: str(c.title, "concept title", 120),
      objective: str(c.objective, "concept objective", 300),
      sectionIndexes: Array.isArray(c.sectionIndexes)
        ? c.sectionIndexes.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < sectionCount).slice(0, 6)
        : [],
    }))
    .slice(0, 8);
  if (parsed.length === 0) throw new SchemaError("The plan has no concepts.");
  return { topicTitle: str(raw.topicTitle, "topicTitle", 120), objectives: strList(raw.objectives, 6), concepts: parsed };
}

export function validateQuestion(raw: unknown): AiQuestion {
  if (!raw || typeof raw !== "object") throw new SchemaError("Missing question.");
  const q = raw as Record<string, unknown>;
  const type = q.type === "mcq" ? "mcq" : "short";
  let options: AiQuestion["options"] = null;
  if (type === "mcq") {
    const list = Array.isArray(q.options) ? q.options : [];
    options = list
      .filter((o): o is Record<string, unknown> => !!o && typeof o === "object" && typeof o.text === "string")
      .slice(0, 6)
      .map((o, i) => ({ id: String.fromCharCode(97 + i), text: String(o.text).trim().slice(0, 300) }));
    if (options.length < 2) throw new SchemaError("A multiple-choice question needs at least two options.");
  }
  const answerSketch = str(q.answerSketch, "answerSketch", 1500);
  const expected = strList(q.expectedReasoning, 6);
  return {
    type,
    prompt: str(q.prompt, "question prompt", 1200),
    options,
    expectedReasoning: expected.length > 0 ? expected : [answerSketch],
    answerSketch,
  };
}

export function validateLesson(raw: Record<string, unknown>): AiLesson {
  const example = raw.example && typeof raw.example === "object" ? (raw.example as Record<string, unknown>) : null;
  return {
    explanation: str(raw.explanation, "explanation", 3000),
    supplement: optStr(raw.supplement, 2000),
    example: example && typeof example.text === "string" && example.text.trim() ? { text: example.text.trim().slice(0, 2000), fromPdf: example.fromPdf === true } : null,
    // Only a registered visualization with in-range parameters gets through; anything else is dropped.
    visualization: validateVisualization(raw.visualization),
    question: validateQuestion(raw.question),
    generatedAt: new Date().toISOString(),
  };
}

export function validateEvaluation(raw: Record<string, unknown>): AiEvaluation {
  const verdict = raw.verdict === "correct" || raw.verdict === "partial" || raw.verdict === "incorrect" ? raw.verdict : null;
  if (!verdict) throw new SchemaError('Missing "verdict".');
  const actions = ["continue", "retry", "reteach", "verify"] as const;
  const nextAction = actions.find((a) => a === raw.nextAction) ?? (verdict === "correct" ? "verify" : "retry");
  return {
    verdict,
    feedback: str(raw.feedback, "feedback", 1200),
    misconception: optStr(raw.misconception, 600),
    hint: optStr(raw.hint, 800),
    reteach: optStr(raw.reteach, 2500),
    nextAction,
  };
}
