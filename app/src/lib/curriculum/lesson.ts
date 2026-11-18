import { findOutcome, type FoundOutcome, type VerificationStatus } from "@/lib/curriculum/catalog";
import { hash } from "@/lib/lessons/generate";
import type { Concept, McqOption } from "@/lib/types";
import { formatNumber } from "@/lib/visualizations/expr";
import { validateVisualization } from "@/lib/visualizations/registry";
import type { VisualizationConfig } from "@/lib/visualizations/types";

/**
 * A curriculum-aligned lesson is a class lecture made of typed blocks. Each
 * block is the source of truth for what students will see: its student-facing
 * concepts (the shape the existing lesson screen renders) and its interactive
 * graph are derived from it, never edited separately.
 */

export const BLOCK_KINDS = ["objective", "explanation", "graph", "prediction", "assessment"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const BLOCK_LABELS: Record<BlockKind, string> = {
  objective: "Learning objective",
  explanation: "Concept explanation",
  graph: "Interactive distance-time graph",
  prediction: "Prediction",
  assessment: "Assessment questions",
};

/** How many questions each kind of block carries. */
export const ITEM_COUNT: Record<BlockKind, { min: number; max: number }> = {
  objective: { min: 1, max: 1 },
  explanation: { min: 1, max: 1 },
  graph: { min: 1, max: 1 },
  prediction: { min: 1, max: 1 },
  assessment: { min: 2, max: 4 },
};

/** A machine-checkable fact behind a question's answer. Questions without one need the teacher's judgment. */
export type ItemFact =
  | { kind: "distance"; speed: number; time: number }
  | { kind: "speed"; distance: number; time: number }
  | { kind: "time"; distance: number; speed: number }
  | { kind: "fastest" }
  | { kind: "slowest" };

export type BlockItem = {
  id: string;
  prompt: string;
  options: McqOption[];
  correctOptionId: string;
  hints: string[];
  whyCorrect: string;
  fact: ItemFact | null;
};

export type MovingObject = { label: string; speed: number };

/** Objects moving at constant speeds from distance 0; drives the graph and prediction blocks. */
export type MotionSetup = { objects: MovingObject[]; duration: number; askTime: number | null };

export type CurriculumBlock = {
  id: string;
  kind: BlockKind;
  title: string;
  /** What students read first. */
  body: string;
  /** A second explanation, shown after a wrong answer. */
  secondLook: string;
  /** Catalog outcome ids this block claims to address. */
  outcomeIds: string[];
  /** Catalog indicator ids; only verified ones pass the checks. */
  indicatorIds: string[];
  /** What the activity teaches, in the teacher's terms. */
  teaches: string;
  /** How students demonstrate understanding. */
  evidence: string;
  motion: MotionSetup | null;
  items: BlockItem[];
  origin: "ai" | "template";
  /** Teacher-judgment items the teacher has confirmed, valid only for the content they saw. */
  acknowledged: { fingerprint: string; ids: string[] } | null;
  /** The content fingerprint the teacher approved; any later change voids the approval. */
  approvedFingerprint: string | null;
};

/** The outcome a lesson is aligned to, copied from the catalog when the lesson is created. */
export type LessonCurriculum = {
  outcomeId: string;
  code: string;
  statement: string;
  fingerprint: string;
  jurisdiction: string;
  course: string;
  unit: string;
  sourceUrl: string;
  retrievedOn: string;
  status: VerificationStatus;
};

export function curriculumMeta(found: FoundOutcome): LessonCurriculum {
  return {
    outcomeId: found.outcome.id,
    code: found.outcome.code,
    statement: found.outcome.statement,
    fingerprint: found.outcome.fingerprint,
    jurisdiction: found.jurisdiction.name,
    course: found.course.name,
    unit: found.unit.name,
    sourceUrl: found.course.source.url,
    retrievedOn: found.course.source.retrievedOn,
    status: found.outcome.status,
  };
}

/** The catalog's current record for a lesson's outcome; never trust the copy a browser sends. */
export function curriculumFromCatalog(outcomeId: unknown): LessonCurriculum | null {
  if (typeof outcomeId !== "string") return null;
  const found = findOutcome(outcomeId);
  return found ? curriculumMeta(found) : null;
}

/* ---------- fingerprint ---------- */

/** Fingerprint of everything a student would see or a check depends on. Review fields are excluded. */
export function blockFingerprint(block: CurriculumBlock): string {
  const { kind, title, body, secondLook, outcomeIds, indicatorIds, teaches, evidence, motion, items } = block;
  return hash(JSON.stringify({ kind, title, body, secondLook, outcomeIds, indicatorIds, teaches, evidence, motion, items })).toString(16).padStart(8, "0");
}

/* ---------- the interactive graph ---------- */

const n = (v: number) => formatNumber(v);
const plain = (s: string) => s.replace(/[{}]/g, "").trim();

/**
 * Builds the distance-time graph for a graph or prediction block from its motion
 * setup, as an existing `function-graph` visualization. Returns null when the
 * setup cannot make a valid graph; the structural checks then say why.
 */
export function motionVisualization(block: Pick<CurriculumBlock, "kind" | "motion">): VisualizationConfig | null {
  const m = block.motion;
  if (!m || m.objects.length === 0 || !(m.duration > 0)) return null;
  const T = m.duration;
  const curves = m.objects.map((o, i) => ({ id: `o${i + 1}`, label: `${plain(o.label)} (${n(o.speed)} m/s)`.slice(0, 60), expression: `${o.speed}*x` }));

  if (block.kind === "graph") {
    const stages = [
      ...m.objects.map((o, i) => ({
        id: `obj${i + 1}`,
        caption: `${plain(o.label)} moves at ${n(o.speed)} m/s, so every second adds ${n(o.speed)} m. After ${n(T)} s that is ${n(o.speed * T)} m.`,
        show: curves.slice(0, i + 1).map((c) => c.id),
        marker: { curve: `o${i + 1}`, x: T },
        guides: true,
      })),
      { id: "compare", caption: "Both lines are straight because each speed is constant. Compare their slopes: which line climbs more metres each second?", show: curves.map((c) => c.id), marker: null, guides: false },
    ];
    return validateVisualization({
      type: "function-graph",
      params: {
        title: "Distance against time",
        observe: "Each straight line is one object at a constant speed. The steeper the line, the faster the object.",
        xLabel: "time (s)",
        yLabel: "distance (m)",
        xRange: [0, T],
        yRange: null,
        parameters: [],
        curves,
        stages,
        checkpoints: [],
      },
    });
  }

  if (block.kind === "prediction" && m.askTime !== null && m.askTime > 0 && m.askTime <= T) {
    const o = m.objects[0];
    const t = m.askTime;
    const answer = Math.round(o.speed * t * 100) / 100;
    const options = predictionOptions(o.speed, t);
    return validateVisualization({
      type: "function-graph",
      params: {
        title: `Where is ${plain(o.label)} after ${n(t)} s?`,
        observe: "Predict first, then watch the marker reach that time.",
        xLabel: "time (s)",
        yLabel: "distance (m)",
        xRange: [0, T],
        yRange: null,
        parameters: [],
        curves: [curves[0]],
        stages: [
          { id: "start", caption: `${plain(o.label)} starts at 0 m and moves at a constant ${n(o.speed)} m/s.`, show: ["o1"], marker: { curve: "o1", x: 0 }, guides: false },
          { id: "one", caption: `After 1 s it has travelled ${n(o.speed)} m.`, show: ["o1"], marker: { curve: "o1", x: 1 }, guides: true },
          { id: "ask", caption: `After ${n(t)} s it has travelled ${n(o.speed)} × ${n(t)} = ${n(answer)} m.`, show: ["o1"], marker: { curve: "o1", x: t }, guides: true },
        ],
        checkpoints: [
          {
            beforeStage: 2,
            prompt: `Predict: how far has ${plain(o.label)} travelled after ${n(t)} s?`,
            options: options.map((v, i) => ({ id: String.fromCharCode(97 + i), text: `${n(v)} m` })),
            correctId: String.fromCharCode(97 + options.indexOf(answer)),
            whenRight: `Yes. ${n(o.speed)} m every second for ${n(t)} s is ${n(answer)} m.`,
            whenWrong: `Not quite. At a constant speed each second adds the same ${n(o.speed)} m, so multiply the speed by the time.`,
          },
        ],
      },
    });
  }
  return null;
}

/** The right answer plus common slips (adding, dividing either way), distinct and in a fixed order. */
export function predictionOptions(speed: number, time: number): number[] {
  const round = (v: number) => Math.round(v * 100) / 100;
  const answer = round(speed * time);
  const out = [answer];
  for (const v of [speed + time, speed * time * 2, time / speed, speed / time].map(round)) {
    if (out.length < 4 && v > 0 && !out.some((x) => Math.abs(x - v) < 1e-9)) out.push(v);
  }
  return out.sort((a, b) => a - b);
}

/* ---------- what students get ---------- */

/** The block as the existing lesson screen shows it: one concept per question; the graph rides on the first. */
export function blockConcepts(block: CurriculumBlock): Concept[] {
  const visualization = block.kind === "graph" || block.kind === "prediction" ? motionVisualization(block) : null;
  const items = block.items.length > 0 ? block.items : [emptyItem("q1")];
  return items.map((item, i) => ({
    id: items.length > 1 ? `${block.id}-q${i + 1}` : block.id,
    title: items.length > 1 ? `${block.title} (question ${i + 1} of ${items.length})` : block.title,
    explanation: block.body,
    alternateExplanation: block.secondLook,
    ...(i === 0 && visualization ? { visualization } : {}),
    question: { kind: "mcq" as const, prompt: item.prompt, options: item.options, correctOptionId: item.correctOptionId },
    whyCorrect: item.whyCorrect,
    hints: item.hints,
  }));
}

export function emptyItem(id: string): BlockItem {
  return {
    id,
    prompt: "",
    options: [
      { id: "a", text: "" },
      { id: "b", text: "" },
    ],
    correctOptionId: "a",
    hints: [""],
    whyCorrect: "",
    fact: null,
  };
}

/* ---------- validation of what a browser sends ---------- */

const BLOCK_ID = /^[a-z0-9][a-z0-9-]{0,39}$/i;
type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => !!v && typeof v === "object" && !Array.isArray(v);
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, min: number, max: number): number | null => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null);
const ids = (v: unknown, max: number) =>
  (Array.isArray(v) ? v : [])
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .map((x) => x.slice(0, 40))
    .slice(0, max);

export function sanitizeFact(raw: unknown): ItemFact | null {
  if (!isObject(raw)) return null;
  const pos = (v: unknown) => num(v, 0.000001, 100000);
  switch (raw.kind) {
    case "distance": {
      const speed = pos(raw.speed);
      const time = pos(raw.time);
      return speed !== null && time !== null ? { kind: "distance", speed, time } : null;
    }
    case "speed": {
      const distance = pos(raw.distance);
      const time = pos(raw.time);
      return distance !== null && time !== null ? { kind: "speed", distance, time } : null;
    }
    case "time": {
      const distance = pos(raw.distance);
      const speed = pos(raw.speed);
      return distance !== null && speed !== null ? { kind: "time", distance, speed } : null;
    }
    case "fastest":
      return { kind: "fastest" };
    case "slowest":
      return { kind: "slowest" };
    default:
      return null;
  }
}

function sanitizeItem(raw: unknown, index: number): BlockItem | null {
  if (!isObject(raw)) return null;
  const seen = new Set<string>();
  const options = (Array.isArray(raw.options) ? raw.options : [])
    .filter(isObject)
    .map((o) => ({ id: clean(o.id, 4), text: clean(o.text, 300) }))
    .filter((o) => /^[a-z]$/.test(o.id) && (seen.has(o.id) ? false : (seen.add(o.id), true)))
    .slice(0, 6);
  const correct = clean(raw.correctOptionId, 4);
  return {
    id: BLOCK_ID.test(clean(raw.id, 40)) ? clean(raw.id, 40) : `q${index + 1}`,
    prompt: clean(raw.prompt, 1200),
    options,
    correctOptionId: options.some((o) => o.id === correct) ? correct : (options[0]?.id ?? "a"),
    hints: (Array.isArray(raw.hints) ? raw.hints : []).map((h) => clean(h, 800)).slice(0, 4),
    whyCorrect: clean(raw.whyCorrect, 1500),
    fact: sanitizeFact(raw.fact),
  };
}

function sanitizeMotion(raw: unknown): MotionSetup | null {
  if (!isObject(raw)) return null;
  const objects = (Array.isArray(raw.objects) ? raw.objects : [])
    .filter(isObject)
    .map((o) => ({ label: plain(clean(o.label, 40)), speed: num(o.speed, -1000, 1000) ?? 0 }))
    .slice(0, 4);
  const duration = num(raw.duration, 0, 600) ?? 0;
  const askTime = raw.askTime === null || raw.askTime === undefined ? null : num(raw.askTime, 0, 600);
  return { objects, duration, askTime };
}

/** Keeps a block's shape and caps its sizes; whether its content is right is the checks' job. */
export function sanitizeBlock(raw: unknown): CurriculumBlock | null {
  if (!isObject(raw)) return null;
  const id = clean(raw.id, 40);
  const kind = BLOCK_KINDS.find((k) => k === raw.kind);
  if (!BLOCK_ID.test(id) || !kind) return null;
  const ack = isObject(raw.acknowledged) && typeof raw.acknowledged.fingerprint === "string" ? raw.acknowledged : null;
  return {
    id,
    kind,
    title: clean(raw.title, 140),
    body: clean(raw.body, 3000),
    secondLook: clean(raw.secondLook, 2000),
    outcomeIds: ids(raw.outcomeIds, 6),
    indicatorIds: ids(raw.indicatorIds, 12),
    teaches: clean(raw.teaches, 600),
    evidence: clean(raw.evidence, 600),
    motion: kind === "graph" || kind === "prediction" ? sanitizeMotion(raw.motion) : null,
    items: (Array.isArray(raw.items) ? raw.items : [])
      .map(sanitizeItem)
      .filter((i): i is BlockItem => i !== null)
      .slice(0, 6),
    origin: raw.origin === "ai" ? "ai" : "template",
    acknowledged: ack ? { fingerprint: clean(ack.fingerprint, 16), ids: ids(ack.ids, 24) } : null,
    approvedFingerprint: typeof raw.approvedFingerprint === "string" ? raw.approvedFingerprint.slice(0, 16) : null,
  };
}
