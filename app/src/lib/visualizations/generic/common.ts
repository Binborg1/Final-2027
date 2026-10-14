/**
 * Validation and evaluation helpers shared by the generic visualization types.
 * Every reader here is strict about shape (it throws VisualizationSchemaError)
 * and lenient about values (numbers are clamped, text is trimmed and capped),
 * so a slightly sloppy AI reply still renders while a wrong one is rejected.
 */
import { checkNumberish, fillTemplate, isIdentifier, resolveNumber, type Numberish } from "../expr";
import {
  VisualizationSchemaError,
  type GenericBase,
  type ParamControl,
  type VisualizationCheckpoint,
  type VisualizationStep,
  type VizCheckpointSpec,
  type VizParameter,
  type VizStage,
} from "../types";

export const LIMITS = {
  parameters: 6,
  stages: 24,
  checkpoints: 3,
  options: 4,
  caption: 280,
  label: 60,
  text: 400,
  id: 32,
} as const;

export function fail(message: string): never {
  throw new VisualizationSchemaError(message);
}

export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function rec(v: unknown, what: string): Record<string, unknown> {
  return isRecord(v) ? v : fail(`${what} must be an object`);
}

export function list(v: unknown, what: string, max: number, min = 0): unknown[] {
  if (v === undefined || v === null) v = [];
  if (!Array.isArray(v)) fail(`${what} must be a list`);
  const items = v as unknown[];
  if (items.length < min) fail(`${what} needs at least ${min} item(s)`);
  return items.slice(0, max);
}

export function text(v: unknown, what: string, max: number, fallback?: string): string {
  if (typeof v === "string" && v.trim()) return v.trim().slice(0, max);
  if (fallback !== undefined) return fallback;
  return fail(`${what} is missing`);
}

export function optText(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

export function num(v: unknown, what: string, min: number, max: number, fallback?: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback !== undefined ? fallback : fail(`${what} must be a number`);
  return Math.min(max, Math.max(min, n));
}

export function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

export function id(v: unknown, what: string, fallback: string): string {
  const s = typeof v === "string" ? v.trim().slice(0, LIMITS.id) : typeof v === "number" ? String(v) : "";
  return s || fallback;
}

/** A pair of finite numbers, each clamped to a sane magnitude. */
export function pair(v: unknown, what: string, bound = 1e6): [number, number] {
  if (!Array.isArray(v) || v.length !== 2) fail(`${what} must be [number, number]`);
  const arr = v as unknown[];
  return [num(arr[0], what, -bound, bound), num(arr[1], what, -bound, bound)];
}

export function numberishPair(v: unknown, what: string, vars: readonly string[]): [Numberish, Numberish] {
  if (!Array.isArray(v) || v.length !== 2) fail(`${what} must be a pair`);
  const arr = v as unknown[];
  try {
    return [checkNumberish(arr[0], vars), checkNumberish(arr[1], vars)];
  } catch (error) {
    return fail(`${what}: ${(error as Error).message}`);
  }
}

export function numberish(v: unknown, what: string, vars: readonly string[]): Numberish {
  try {
    return checkNumberish(v, vars);
  } catch (error) {
    return fail(`${what}: ${(error as Error).message}`);
  }
}

/* ---------- parameters ---------- */

export function readParameters(v: unknown): VizParameter[] {
  const seen = new Set<string>();
  return list(v, "parameters", LIMITS.parameters).map((raw, i) => {
    const p = rec(raw, `parameters[${i}]`);
    const key = p.key;
    if (!isIdentifier(key)) fail(`parameters[${i}].key must be a short identifier`);
    if (seen.has(key)) fail(`duplicate parameter ${key}`);
    seen.add(key);
    const min = num(p.min, "parameter min", -1e6, 1e6, 0);
    const max = num(p.max, "parameter max", -1e6, 1e6, 10);
    if (!(max > min)) fail(`parameter ${key}: max must be greater than min`);
    const step = num(p.step, "parameter step", 1e-6, max - min, 1);
    const value = num(p.value, "parameter value", min, max, min);
    return { key, label: text(p.label, "parameter label", LIMITS.label, key), min, max, step, value, unit: optText(p.unit, 12) ?? undefined };
  });
}

/** Variables formulas may use: the parameter keys plus any extras (such as "x" on a graph). */
export function varsOf(parameters: VizParameter[], extra: readonly string[] = []): string[] {
  return [...parameters.map((p) => p.key), ...extra];
}

/** A stage's `set`: parameter overrides, clamped to each parameter's range. Unknown keys are dropped. */
export function readSet(v: unknown, parameters: VizParameter[]): Record<string, number> | undefined {
  if (!isRecord(v)) return undefined;
  const out: Record<string, number> = {};
  for (const p of parameters) {
    if (p.key in v) out[p.key] = num(v[p.key], `set.${p.key}`, p.min, p.max, p.value);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** The variable values in force at a stage: the sliders, overridden by the stage's `set`. */
export function varsAt(parameters: VizParameter[], stage: VizStage | undefined): Record<string, number> {
  const vars: Record<string, number> = {};
  for (const p of parameters) vars[p.key] = p.value;
  if (stage?.set) for (const [k, v] of Object.entries(stage.set)) vars[k] = v;
  return vars;
}

export function resolve(value: Numberish | null | undefined, vars: Record<string, number>, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = resolveNumber(value, vars);
  return Number.isFinite(n) ? n : fallback;
}

/* ---------- stages ---------- */

/** Reads the shared part of each stage; `extra` reads the type's own fields. */
export function readStages<S extends VizStage>(v: unknown, parameters: VizParameter[], extra: (raw: Record<string, unknown>, index: number) => Omit<S, keyof VizStage>): S[] {
  const seen = new Set<string>();
  return list(v, "stages", LIMITS.stages, 1).map((raw, i) => {
    const s = rec(raw, `stages[${i}]`);
    let stageId = id(s.id, "stage id", `stage-${i + 1}`);
    while (seen.has(stageId)) stageId = `${stageId}-${i + 1}`;
    seen.add(stageId);
    const base: VizStage = { id: stageId, caption: text(s.caption, `stages[${i}].caption`, LIMITS.caption), set: readSet(s.set, parameters) };
    return { ...base, ...extra(s, i) } as S;
  });
}

export function readCheckpoints(v: unknown, stageCount: number): VizCheckpointSpec[] {
  const out: VizCheckpointSpec[] = [];
  for (const [i, raw] of list(v, "checkpoints", LIMITS.checkpoints).entries()) {
    const c = rec(raw, `checkpoints[${i}]`);
    const beforeStage = Math.round(num(c.beforeStage, "checkpoint beforeStage", 0, 1e6, -1));
    if (beforeStage < 1 || beforeStage >= stageCount) continue; // nothing to hide: drop it rather than trap the demo
    const options = list(c.options, "checkpoint options", LIMITS.options, 2).map((o, j) => {
      const opt = rec(o, "option");
      return { id: id(opt.id, "option id", String.fromCharCode(97 + j)).toLowerCase(), text: text(opt.text, "option text", LIMITS.text) };
    });
    const correctId = typeof c.correctId === "string" ? c.correctId.trim().toLowerCase() : "";
    if (!options.some((o) => o.id === correctId)) fail(`checkpoints[${i}]: correctId must be one of the options`);
    out.push({
      beforeStage,
      prompt: text(c.prompt, "checkpoint prompt", LIMITS.text),
      options,
      correctId,
      whenRight: text(c.whenRight, "checkpoint whenRight", LIMITS.text, "That's right."),
      whenWrong: text(c.whenWrong, "checkpoint whenWrong", LIMITS.text, "Not quite. Watch what happens."),
    });
  }
  // One stop per stage, in order.
  const byStage = new Map<number, VizCheckpointSpec>();
  for (const c of out) if (!byStage.has(c.beforeStage)) byStage.set(c.beforeStage, c);
  return [...byStage.values()].sort((a, b) => a.beforeStage - b.beforeStage);
}

/* ---------- the generic base, in one call ---------- */

export function readBase<S extends VizStage>(raw: Record<string, unknown>, extra: (s: Record<string, unknown>, i: number, vars: string[]) => Omit<S, keyof VizStage>, extraVars: readonly string[] = []): GenericBase<S> {
  const parameters = readParameters(raw.parameters);
  const vars = varsOf(parameters, extraVars);
  const stages = readStages<S>(raw.stages, parameters, (s, i) => extra(s, i, vars));
  return {
    title: optText(raw.title, LIMITS.label),
    observe: optText(raw.observe, LIMITS.text),
    parameters,
    stages,
    checkpoints: readCheckpoints(raw.checkpoints, stages.length),
  };
}

/* ---------- what the player needs ---------- */

/** Captions with their {formulas} filled in from the parameters in force at each stage. */
export function genericSteps<S extends VizStage>(params: GenericBase<S>): VisualizationStep[] {
  return params.stages.map((stage) => ({ id: stage.id, caption: fillTemplate(stage.caption, varsAt(params.parameters, stage)) }));
}

/** Checkpoints mapped onto step indexes, with templates filled from the stage on screen when the question is asked. */
export function genericCheckpoints<S extends VizStage>(params: GenericBase<S>): VisualizationCheckpoint[] {
  return params.checkpoints
    .filter((c) => c.beforeStage > 0 && c.beforeStage < params.stages.length)
    .map((c) => {
      const vars = varsAt(params.parameters, params.stages[c.beforeStage - 1]);
      const fill = (s: string) => fillTemplate(s, vars);
      return {
        beforeStep: c.beforeStage,
        prompt: fill(c.prompt),
        options: c.options.map((o) => ({ id: o.id, text: fill(o.text) })),
        correctId: c.correctId,
        whenRight: fill(c.whenRight),
        whenWrong: fill(c.whenWrong),
      };
    });
}

export function genericControls(params: GenericBase<VizStage>): ParamControl[] {
  return params.parameters.map((p) => ({ kind: "range", key: p.key, label: p.label, min: p.min, max: p.max, step: p.step, unit: p.unit }));
}

export function genericApplyControl<P extends GenericBase<VizStage>>(params: P, key: string, value: unknown): P {
  const parameters = params.parameters.map((p) => (p.key === key ? { ...p, value: num(value, p.key, p.min, p.max, p.value) } : p));
  return { ...params, parameters };
}

export function genericDescribe(params: GenericBase<VizStage>, typeTitle: string, fallbackSummary: string): { title: string; summary: string } {
  return { title: params.title ?? typeTitle, summary: params.observe ?? fallbackSummary };
}

/** The shared part of every generic schema, for the AI prompt. */
export const SHARED_SCHEMA_DOC = `Shared fields: "title" (short), "observe" (one sentence: what to watch for), "parameters": up to ${LIMITS.parameters} sliders [{"key": identifier, "label", "min", "max", "step", "value", "unit"?}], "stages": 3 to 8 ordered steps [{"id", "caption": one or two sentences shown and spoken for that step, "set"?: {key: number} to move a slider for that step}], "checkpoints": exactly one [{"beforeStage": index of the stage kept hidden until the student predicts (1 or more), "prompt", "options": [{"id": "a", "text"}, ...] (2 to 4), "correctId", "whenRight", "whenWrong"}]. Any number may instead be a formula string over the parameter keys (operators + - * / ^, functions sqrt abs sin cos tan exp ln log min max floor round, constants pi e), and captions may embed formulas in braces, e.g. "the vertex is at x = {-b/(2*a)}".`;
