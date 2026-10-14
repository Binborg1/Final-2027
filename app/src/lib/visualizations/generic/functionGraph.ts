import { compileExpr, type Numberish } from "../expr";
import type { FunctionGraphParams, GraphMarker, GraphStage, VisualizationDefinition } from "../types";
import {
  bool,
  fail,
  genericApplyControl,
  genericCheckpoints,
  genericControls,
  genericDescribe,
  genericSteps,
  id,
  isRecord,
  LIMITS,
  list,
  num,
  numberish,
  optText,
  pair,
  readBase,
  rec,
  resolve,
  text,
  varsAt,
} from "./common";

export const GRAPH_LIMITS = { curves: 4, points: 24, samples: 160 } as const;

function readMarker(v: unknown, curveIds: string[], vars: string[]): GraphMarker | null {
  if (!isRecord(v)) return null;
  if (typeof v.curve === "string") {
    if (!curveIds.includes(v.curve)) fail(`marker refers to unknown curve ${v.curve}`);
    return { curve: v.curve, x: numberish(v.x, "marker x", vars) };
  }
  return { x: numberish(v.x, "marker x", vars), y: numberish(v.y, "marker y", vars) };
}

export function normalizeFunctionGraph(raw: Record<string, unknown>): FunctionGraphParams {
  const xRange = raw.xRange === undefined ? ([-5, 5] as [number, number]) : pair(raw.xRange, "xRange");
  if (!(xRange[1] > xRange[0])) fail("xRange must go from a smaller to a larger number");
  const yRange = raw.yRange === undefined || raw.yRange === null ? null : pair(raw.yRange, "yRange");
  if (yRange && !(yRange[1] > yRange[0])) fail("yRange must go from a smaller to a larger number");

  // Curves are checked against the parameters, which readBase reads too; read them first so the stages can refer to curve ids.
  const parameterKeys = list(raw.parameters, "parameters", LIMITS.parameters)
    .map((p) => (isRecord(p) && typeof p.key === "string" ? p.key : ""))
    .filter(Boolean);
  const curveVars = [...parameterKeys, "x"];
  const curveIds = new Set<string>();
  const curves = list(raw.curves, "curves", GRAPH_LIMITS.curves, 1).map((c, i) => {
    const cr = rec(c, `curves[${i}]`);
    const expression = text(cr.expression, `curves[${i}].expression`, 200);
    try {
      compileExpr(expression, curveVars);
    } catch (error) {
      fail(`curves[${i}]: ${(error as Error).message}`);
    }
    let cid = id(cr.id, "curve id", `f${i + 1}`);
    while (curveIds.has(cid)) cid = `${cid}-${i + 1}`;
    curveIds.add(cid);
    return { id: cid, label: text(cr.label, "curve label", LIMITS.label, `y = ${expression}`), expression };
  });
  const ids = [...curveIds];

  const points = list(raw.points, "points", GRAPH_LIMITS.points).map((p, i) => {
    const pr = rec(p, `points[${i}]`);
    return { x: num(pr.x, "point x", -1e6, 1e6), y: num(pr.y, "point y", -1e6, 1e6), label: optText(pr.label, LIMITS.label) };
  });

  const base = readBase<GraphStage>(raw, (s, _i, vars) => ({
    marker: readMarker(s.marker, ids, vars),
    show: Array.isArray(s.show) ? (s.show.filter((x): x is string => typeof x === "string" && ids.includes(x)) as string[]) : null,
    guides: bool(s.guides, false),
  }));

  return {
    ...base,
    xLabel: text(raw.xLabel, "xLabel", 24, "x"),
    yLabel: text(raw.yLabel, "yLabel", 24, "y"),
    xRange,
    yRange,
    curves,
    points,
  };
}

/** y for a curve at x with the parameters in force; NaN where the formula is undefined. */
export function curveValue(params: FunctionGraphParams, curveId: string, x: number, vars: Record<string, number>): number {
  const curve = params.curves.find((c) => c.id === curveId);
  if (!curve) return NaN;
  try {
    return compileExpr(curve.expression, [...Object.keys(vars), "x"])({ ...vars, x });
  } catch {
    return NaN;
  }
}

/** The marker's position at a step, in model coordinates, or null. */
export function markerAt(params: FunctionGraphParams, step: number): { x: number; y: number } | null {
  const stage = params.stages[Math.min(step, params.stages.length - 1)];
  if (!stage?.marker) return null;
  const vars = varsAt(params.parameters, stage);
  const x = resolve(stage.marker.x as Numberish, vars, NaN);
  if (!Number.isFinite(x)) return null;
  const y = "curve" in stage.marker ? curveValue(params, stage.marker.curve, x, vars) : resolve(stage.marker.y, vars, NaN);
  return Number.isFinite(y) ? { x, y } : null;
}

export const functionGraph: VisualizationDefinition<FunctionGraphParams> = {
  type: "function-graph",
  family: "generic",
  title: "Graph",
  summary: "A graph of one or more functions or data points, with a marker that moves along a curve and sliders that reshape it.",
  useWhen: "functions, equations, rates of change, distance-time or other x-y relationships, data trends, or anything best read off a graph",
  schemaDoc: `"xLabel", "yLabel", "xRange": [min, max], "yRange": [min, max] or null for automatic, "curves": 1 to ${GRAPH_LIMITS.curves} [{"id", "label", "expression": formula in x and the parameter keys, e.g. "a*x^2 + b*x + c"}], "points"?: data points [{"x", "y", "label"?}], and per stage: "marker"?: {"curve": id, "x": number or formula} (a dot on that curve) or {"x", "y"}, "guides"?: true to draw dashed lines from the marker to the axes, "show"?: [curve ids to display, default all].`,
  defaults: {
    title: null,
    observe: null,
    parameters: [],
    stages: [{ id: "stage-1", caption: "The graph.", marker: null, show: null, guides: false }],
    checkpoints: [],
    xLabel: "x",
    yLabel: "y",
    xRange: [-5, 5],
    yRange: null,
    curves: [{ id: "f1", label: "y = x", expression: "x" }],
    points: [],
  },
  normalize: normalizeFunctionGraph,
  controls: genericControls,
  applyControl: genericApplyControl,
  steps: genericSteps,
  checkpoints: genericCheckpoints,
  describe: (p) => genericDescribe(p, "Graph", `A graph of ${p.curves.map((c) => c.label).join(" and ")}.`),
};
