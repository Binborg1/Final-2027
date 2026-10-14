import { oneOf, type GeometrySceneParams, type GeoShape, type GeoStage, type GeoTransform, type VisualizationDefinition } from "../types";
import { fail, genericApplyControl, genericCheckpoints, genericControls, genericDescribe, genericSteps, id, isRecord, LIMITS, list, numberish, numberishPair, optText, pair, readBase, rec, resolve, text, varsAt } from "./common";

export const GEO_LIMITS = { shapes: 8, polygonPoints: 12, measures: 6 } as const;

export function normalizeGeometryScene(raw: Record<string, unknown>): GeometrySceneParams {
  const range = raw.range === undefined ? ([0, 10] as [number, number]) : pair(raw.range, "range", 1e4);
  if (!(range[1] > range[0])) fail("range must go from a smaller to a larger number");
  const parameterKeys = list(raw.parameters, "parameters", LIMITS.parameters)
    .map((p) => (isRecord(p) && typeof p.key === "string" ? p.key : ""))
    .filter(Boolean);
  const ids = new Set<string>();
  const shapes: GeoShape[] = list(raw.shapes, "shapes", GEO_LIMITS.shapes, 1).map((s, i) => {
    const sr = rec(s, `shapes[${i}]`);
    let sid = id(sr.id, "shape id", `s${i + 1}`);
    while (ids.has(sid)) sid = `${sid}-${i + 1}`;
    ids.add(sid);
    const kind = oneOf(sr.kind, ["polygon", "circle", "segment", "point"] as const, "polygon");
    const points = list(sr.points, `shapes[${i}].points`, GEO_LIMITS.polygonPoints).map((p, j) => numberishPair(p, `shapes[${i}].points[${j}]`, parameterKeys));
    const center = sr.center === undefined || sr.center === null ? null : numberishPair(sr.center, `shapes[${i}].center`, parameterKeys);
    const radius = sr.radius === undefined || sr.radius === null ? null : numberish(sr.radius, `shapes[${i}].radius`, parameterKeys);
    if (kind === "polygon" && points.length < 3) fail(`shapes[${i}]: a polygon needs at least 3 points`);
    if (kind === "segment" && points.length !== 2) fail(`shapes[${i}]: a segment needs exactly 2 points`);
    if (kind === "circle" && (!center || radius === null)) fail(`shapes[${i}]: a circle needs center and radius`);
    if (kind === "point" && !center && points.length !== 1) fail(`shapes[${i}]: a point needs center or one point`);
    return { id: sid, kind, points, center: center ?? (kind === "point" ? points[0] : null), radius, label: optText(sr.label, 24) };
  });

  const base = readBase<GeoStage>(raw, (s, i, vars) => {
    const transforms: Record<string, GeoTransform> = {};
    if (isRecord(s.transforms)) {
      for (const [shapeId, t] of Object.entries(s.transforms)) {
        if (!ids.has(shapeId) || !isRecord(t)) continue;
        transforms[shapeId] = {
          translate: t.translate === undefined || t.translate === null ? null : numberishPair(t.translate, `stages[${i}].transforms.${shapeId}.translate`, vars),
          rotate: t.rotate === undefined || t.rotate === null ? null : numberish(t.rotate, `stages[${i}].transforms.${shapeId}.rotate`, vars),
          scale: t.scale === undefined || t.scale === null ? null : numberish(t.scale, `stages[${i}].transforms.${shapeId}.scale`, vars),
        };
      }
    }
    const measures = list(s.measures, "measures", GEO_LIMITS.measures).map((m, j) => {
      const mr = rec(m, `stages[${i}].measures[${j}]`);
      return { from: numberishPair(mr.from, "measure from", vars), to: numberishPair(mr.to, "measure to", vars), label: text(mr.label, "measure label", LIMITS.label) };
    });
    const show = Array.isArray(s.show) ? (s.show.filter((x): x is string => typeof x === "string" && ids.has(x)) as string[]) : null;
    return { transforms, measures, show };
  });
  return { ...base, range, shapes };
}

export type ResolvedShape = { id: string; kind: GeoShape["kind"]; points: [number, number][]; center: [number, number] | null; radius: number; label: string | null; transform: { dx: number; dy: number; rotate: number; scale: number }; visible: boolean };

/** Every shape with its numbers resolved for a step, plus the transform the stage applies to it. */
export function shapesAt(params: GeometrySceneParams, step: number): ResolvedShape[] {
  const stage = params.stages[Math.min(step, params.stages.length - 1)];
  const vars = varsAt(params.parameters, stage);
  return params.shapes.map((s) => {
    const t = stage?.transforms[s.id];
    const points = s.points.map(([x, y]) => [resolve(x, vars), resolve(y, vars)] as [number, number]);
    const center = s.center ? ([resolve(s.center[0], vars), resolve(s.center[1], vars)] as [number, number]) : null;
    return {
      id: s.id,
      kind: s.kind,
      points,
      center,
      radius: Math.max(0, resolve(s.radius, vars, 1)),
      label: s.label,
      transform: {
        dx: t?.translate ? resolve(t.translate[0], vars) : 0,
        dy: t?.translate ? resolve(t.translate[1], vars) : 0,
        rotate: t?.rotate !== null && t?.rotate !== undefined ? resolve(t.rotate, vars) : 0,
        scale: t?.scale !== null && t?.scale !== undefined ? Math.max(0.05, resolve(t.scale, vars, 1)) : 1,
      },
      visible: !stage?.show || stage.show.includes(s.id),
    };
  });
}

export const geometryScene: VisualizationDefinition<GeometrySceneParams> = {
  type: "geometry-scene",
  family: "generic",
  title: "Geometry",
  summary: "Shapes on a grid with measurements, moved, turned and scaled step by step.",
  useWhen: "2D shapes, angles, lengths and areas, transformations such as translation, rotation and scaling, or vectors and coordinates",
  schemaDoc: `"range": [min, max] for both axes (default [0, 10]), "shapes": 1 to ${GEO_LIMITS.shapes} [{"id", "kind": "polygon" (3 to ${GEO_LIMITS.polygonPoints} "points": [[x, y], ...]) | "circle" ("center": [x, y], "radius") | "segment" (2 points) | "point" ("center"), "label"?}], and per stage: "transforms"?: {shape id: {"translate"?: [dx, dy], "rotate"?: degrees counter-clockwise about the shape's centre, "scale"?: factor}}, "measures"?: up to ${GEO_LIMITS.measures} [{"from": [x, y], "to": [x, y], "label"}] dashed measurement lines, "show"?: [shape ids to display].`,
  defaults: {
    title: null,
    observe: null,
    parameters: [],
    stages: [{ id: "stage-1", caption: "The shape.", transforms: {}, measures: [], show: null }],
    checkpoints: [],
    range: [0, 10],
    shapes: [
      {
        id: "s1",
        kind: "polygon",
        points: [
          [2, 2],
          [6, 2],
          [4, 6],
        ],
        center: null,
        radius: null,
        label: "triangle",
      },
    ],
  },
  normalize: normalizeGeometryScene,
  controls: genericControls,
  applyControl: genericApplyControl,
  steps: genericSteps,
  checkpoints: genericCheckpoints,
  describe: (p) => genericDescribe(p, "Geometry", `${p.shapes.map((s) => s.label ?? s.kind).join(", ")} on a grid.`),
};
