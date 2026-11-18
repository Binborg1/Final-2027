import { sanitizeBlock, type BlockKind, type CurriculumBlock } from "@/lib/curriculum/lesson";
import type { AiEvaluation, AiLesson, AiQuestion, McqQuestion } from "@/lib/types";
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

/** A drafted concept's content, in the shape the fixed lesson screen shows. */
export type DraftContent = {
  explanation: string;
  alternateExplanation: string;
  question: McqQuestion;
  hints: string[];
  whyCorrect: string;
};

/** Checks a drafted concept and shuffles its options, so the correct one is not always where the model put it. */
export function validateDraft(raw: Record<string, unknown>, random: () => number = Math.random): DraftContent {
  const q = raw.question && typeof raw.question === "object" ? (raw.question as Record<string, unknown>) : null;
  if (!q) throw new SchemaError("Missing question.");
  const texts = (Array.isArray(q.options) ? q.options : [])
    .map((o) => (typeof o === "string" ? o : o && typeof o === "object" ? (o as Record<string, unknown>).text : null))
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim().slice(0, 300));
  if (texts.length < 3 || texts.length > 6) throw new SchemaError("The question needs 3 to 6 options.");
  if (new Set(texts.map((t) => t.toLowerCase())).size !== texts.length) throw new SchemaError("The options repeat.");
  const correctIndex = typeof q.correctIndex === "string" ? Number(q.correctIndex) : q.correctIndex;
  if (!Number.isInteger(correctIndex) || (correctIndex as number) < 0 || (correctIndex as number) >= texts.length) {
    throw new SchemaError('Missing a valid "correctIndex".');
  }
  const order = texts.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const options = order.map((from, i) => ({ id: String.fromCharCode(97 + i), text: texts[from] }));
  const correct = options[order.indexOf(correctIndex as number)];
  const hints = strList(raw.hints, 3).map((h) => h.slice(0, 800));
  if (hints.length === 0) throw new SchemaError("Missing hints.");
  return {
    explanation: str(raw.explanation, "explanation", 3000),
    alternateExplanation: str(raw.alternateExplanation, "alternateExplanation", 2000),
    question: { kind: "mcq", prompt: str(q.prompt, "question prompt", 1200), options, correctOptionId: correct.id },
    hints,
    whyCorrect: str(raw.whyCorrect, "whyCorrect", 1500),
  };
}

/**
 * Checks AI-written curriculum blocks. The reply is refused outright if it cites
 * any outcome or indicator id the application did not supply, or if its blocks
 * are not the kinds asked for, in order. Content quality is left to the
 * deterministic checks and the teacher.
 */
export function validateCurriculumBlocks(
  raw: Record<string, unknown>,
  ctx: { allowedOutcomeIds: readonly string[]; allowedIndicatorIds: readonly string[]; kinds: readonly BlockKind[]; ids?: readonly string[] },
  random: () => number = Math.random,
): CurriculumBlock[] {
  const list = Array.isArray(raw.blocks) ? raw.blocks : [];
  if (list.length !== ctx.kinds.length) throw new SchemaError(`Expected ${ctx.kinds.length} block(s), got ${list.length}.`);
  return list.map((b, i): CurriculumBlock => {
    if (!b || typeof b !== "object") throw new SchemaError(`Block ${i + 1} is not an object.`);
    const r = b as Record<string, unknown>;
    const kind = ctx.kinds[i];
    if (r.kind !== kind) throw new SchemaError(`Block ${i + 1} should be "${kind}", not ${JSON.stringify(r.kind)}.`);
    const outcomeIds = strList(r.outcomeIds, 6);
    const unknown = outcomeIds.find((id) => !ctx.allowedOutcomeIds.includes(id));
    if (unknown !== undefined) throw new SchemaError(`Block ${i + 1} cites "${unknown.slice(0, 40)}", which is not an outcome the application supplied.`);
    if (outcomeIds.length === 0) throw new SchemaError(`Block ${i + 1} cites no outcome.`);
    const indicatorIds = strList(r.indicatorIds, 12);
    const badIndicator = indicatorIds.find((id) => !ctx.allowedIndicatorIds.includes(id));
    if (badIndicator !== undefined) throw new SchemaError(`Block ${i + 1} cites indicator "${badIndicator.slice(0, 40)}", which is not verified.`);
    const items = (Array.isArray(r.items) ? r.items : []).map((it, j) => curriculumItem(it, j, i, random));
    if (items.length === 0) throw new SchemaError(`Block ${i + 1} has no questions.`);
    const motion = r.motion && typeof r.motion === "object" ? (r.motion as Record<string, unknown>) : null;
    const block = sanitizeBlock({
      id: ctx.ids?.[i] ?? `b-${kind}`,
      kind,
      title: str(r.title, "title", 140),
      body: str(r.body, "body", 3000),
      secondLook: optStr(r.secondLook, 2000) ?? "",
      teaches: optStr(r.teaches, 600) ?? "",
      evidence: optStr(r.evidence, 600) ?? "",
      outcomeIds,
      indicatorIds,
      motion,
      items,
      origin: "ai",
      acknowledged: null,
      approvedFingerprint: null,
    });
    if (!block) throw new SchemaError(`Block ${i + 1} could not be read.`);
    return block;
  });
}

function curriculumItem(raw: unknown, j: number, blockIndex: number, random: () => number) {
  if (!raw || typeof raw !== "object") throw new SchemaError(`Block ${blockIndex + 1}, question ${j + 1} is not an object.`);
  const q = raw as Record<string, unknown>;
  const texts = (Array.isArray(q.options) ? q.options : [])
    .map((o) => (typeof o === "string" ? o : o && typeof o === "object" ? (o as Record<string, unknown>).text : null))
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim().slice(0, 300));
  if (texts.length < 2 || texts.length > 6) throw new SchemaError(`Block ${blockIndex + 1}, question ${j + 1} needs 2 to 6 options.`);
  const correctIndex = typeof q.correctIndex === "string" ? Number(q.correctIndex) : q.correctIndex;
  if (!Number.isInteger(correctIndex) || (correctIndex as number) < 0 || (correctIndex as number) >= texts.length) {
    throw new SchemaError(`Block ${blockIndex + 1}, question ${j + 1} has no valid "correctIndex".`);
  }
  const order = texts.map((_, k) => k);
  for (let k = order.length - 1; k > 0; k--) {
    const r = Math.floor(random() * (k + 1));
    [order[k], order[r]] = [order[r], order[k]];
  }
  const options = order.map((from, k) => ({ id: String.fromCharCode(97 + k), text: texts[from] }));
  return {
    id: `q${j + 1}`,
    prompt: str(q.prompt, "question prompt", 1200),
    options,
    correctOptionId: options[order.indexOf(correctIndex as number)].id,
    hints: strList(q.hints, 3).map((h) => h.slice(0, 800)),
    whyCorrect: optStr(q.whyCorrect, 1500) ?? "",
    fact: q.fact ?? null,
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
