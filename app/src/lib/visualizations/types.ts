/**
 * Interactive learning visualizations.
 *
 * A closed registry of named types, each with typed, range-checked parameters.
 * The tutoring engine (or an AI-written lesson) can only ask for one of these
 * by name and pass structured parameters; nothing it sends is ever executed as
 * code. A concept with no fitting type is taught with an ordinary explanation.
 *
 * Two families share one interface:
 * - generic building blocks (graphs, diagrams, sequences, quantities, geometry)
 *   whose content (stages, captions, predictions) comes from the lesson or the AI;
 * - specialized demonstrations (the networking ones) whose content is computed.
 */
import type { Numberish } from "./expr";

export const VISUALIZATION_TYPES = [
  "function-graph",
  "node-diagram",
  "process-sequence",
  "quantity-model",
  "geometry-scene",
  "packet-transmission",
  "pcm-sampling",
  "protocol-layers",
] as const;
export type VisualizationType = (typeof VISUALIZATION_TYPES)[number];

/** Thrown by a definition's `normalize` when a config cannot be made valid. `validateVisualization` turns it into null. */
export class VisualizationSchemaError extends Error {}

/* ---------- shared pieces of generic configs ---------- */

/** A slider the student can move; also a variable for formulas and {templates}. */
export type VizParameter = { key: string; label: string; min: number; max: number; step: number; value: number; unit?: string };

export type VizStage = {
  id: string;
  /** May embed formulas in braces, e.g. "the vertex is at x = {-b/(2*a)}". */
  caption: string;
  /** Parameter values that apply while this stage is on screen. */
  set?: Record<string, number>;
};

/** A prediction authored with the config: the demo stops before `beforeStage` until the student answers. */
export type VizCheckpointSpec = {
  beforeStage: number;
  prompt: string;
  options: { id: string; text: string }[];
  correctId: string;
  whenRight: string;
  whenWrong: string;
};

/** Fields every generic config carries. */
export type GenericBase<S extends VizStage> = {
  title: string | null;
  /** What the student should watch for; used by the tutor's introduction. */
  observe: string | null;
  parameters: VizParameter[];
  stages: S[];
  checkpoints: VizCheckpointSpec[];
};

/* ---------- generic types ---------- */

export type GraphCurve = { id: string; label: string; expression: string };
export type GraphPoint = { x: number; y: number; label: string | null };
export type GraphMarker = { curve: string; x: Numberish } | { x: Numberish; y: Numberish };
export type GraphStage = VizStage & { marker: GraphMarker | null; show: string[] | null; guides: boolean };
export type FunctionGraphParams = GenericBase<GraphStage> & {
  xLabel: string;
  yLabel: string;
  xRange: [number, number];
  /** null means fit the visible curves and points. */
  yRange: [number, number] | null;
  curves: GraphCurve[];
  points: GraphPoint[];
};

export type DiagramNode = { id: string; label: string; kind: "box" | "circle"; x: number | null; y: number | null };
export type DiagramEdge = { from: string; to: string; label: string | null; directed: boolean };
export type DiagramToken = { id: string; label: string; at: string | null; edge: [string, string] | null; t: number };
export type DiagramStage = VizStage & { highlight: string[]; highlightEdges: [string, string][]; tokens: DiagramToken[] };
export type NodeDiagramParams = GenericBase<DiagramStage> & {
  layout: "row" | "ring" | "tree" | "free";
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

export type ProcessStage = VizStage & { title: string; facts: { label: string; value: string }[] };
export type ProcessSequenceParams = GenericBase<ProcessStage>;

export type Quantity = { id: string; label: string; unit: string | null; expression: string | null; value: number };
export type QuantityStage = VizStage & { values: Record<string, Numberish>; highlight: string[] };
export type QuantityModelParams = GenericBase<QuantityStage> & {
  quantities: Quantity[];
  /** Top of the bar scale; null fits the values on screen. */
  max: number | null;
};

export type GeoShape = {
  id: string;
  kind: "polygon" | "circle" | "segment" | "point";
  points: [Numberish, Numberish][];
  center: [Numberish, Numberish] | null;
  radius: Numberish | null;
  label: string | null;
};
export type GeoTransform = { translate: [Numberish, Numberish] | null; rotate: Numberish | null; scale: Numberish | null };
export type GeoMeasure = { from: [Numberish, Numberish]; to: [Numberish, Numberish]; label: string };
export type GeoStage = VizStage & { transforms: Record<string, GeoTransform>; measures: GeoMeasure[]; show: string[] | null };
export type GeometrySceneParams = GenericBase<GeoStage> & {
  /** Model coordinates run from range[0] to range[1] on both axes, origin bottom-left. */
  range: [number, number];
  shapes: GeoShape[];
};

/* ---------- specialized types ---------- */

export type PacketTransmissionParams = {
  /** How many packets the message is split into. */
  packets: number;
  /** 1-based number of a packet dropped in transit, or null for a clean delivery. */
  lostPacket: number | null;
};

export type PcmSamplingParams = {
  /** Frequency of the analog wave, in hertz, shown over a one-second window. */
  signalHz: number;
  /** Samples per second. */
  sampleRate: number;
  /** Bits per sample; 2^bits quantization levels. */
  bits: number;
};

export type ProtocolLayersParams = {
  model: "tcp-ip" | "osi";
};

export type VisualizationParams = {
  "function-graph": FunctionGraphParams;
  "node-diagram": NodeDiagramParams;
  "process-sequence": ProcessSequenceParams;
  "quantity-model": QuantityModelParams;
  "geometry-scene": GeometrySceneParams;
  "packet-transmission": PacketTransmissionParams;
  "pcm-sampling": PcmSamplingParams;
  "protocol-layers": ProtocolLayersParams;
};

/** A validated request: which visualization, with which parameters. */
export type VisualizationConfig = { [K in VisualizationType]: { type: K; params: VisualizationParams[K] } }[VisualizationType];

/** One frame of a demonstration: what is on screen and the short caption explaining it. */
export type VisualizationStep = {
  id: string;
  caption: string;
  /** Milliseconds the step stays on screen while playing (the player has a default). */
  hold?: number;
};

/** A moment where the demo stops and asks the student to predict the next step before it is shown. */
export type VisualizationCheckpoint = {
  /** The demo stops before this step index is revealed. */
  beforeStep: number;
  prompt: string;
  options: { id: string; text: string }[];
  correctId: string;
  whenRight: string;
  whenWrong: string;
};

/** A parameter the student can change. The definition's `applyControl` keeps values in range. */
export type ParamControl =
  | { kind: "range"; key: string; label: string; min: number; max: number; step: number; unit?: string }
  | { kind: "select"; key: string; label: string; options: { value: string; label: string }[] };

export type VisualizationDefinition<P> = {
  type: VisualizationType;
  /** "generic": content authored in the config (by a lesson or the AI). "specialized": content computed by code. */
  family: "generic" | "specialized";
  title: string;
  /** One or two sentences a screen reader (and the tutor) can use to say what this kind of animation shows. */
  summary: string;
  /** For the AI planner: when this visualization fits a concept. */
  useWhen: string;
  /** For the AI planner: the shape of `params`, in words. */
  schemaDoc: string;
  defaults: P;
  /** Accepts anything (an AI reply, a stored lesson) and returns parameters in range, or throws VisualizationSchemaError. */
  normalize: (raw: Record<string, unknown>) => P;
  /** The controls the student can use, for these params. */
  controls: (params: P) => ParamControl[];
  /** A control change applied to the params (clamped). */
  applyControl: (params: P, key: string, value: unknown) => P;
  steps: (params: P) => VisualizationStep[];
  checkpoints: (params: P) => VisualizationCheckpoint[];
  /** The title and summary for this particular config (defaults to the type's). */
  describe: (params: P) => { title: string; summary: string };
};

/* ---------- helpers for normalize() ---------- */

/** An integer clamped to [min, max]; `fallback` when the value is not a number. */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}
