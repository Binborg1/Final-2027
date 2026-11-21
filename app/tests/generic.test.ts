import assert from "node:assert/strict";
import { test } from "node:test";
import { motionGraph } from "@/lib/resources/graph";
import { LIMITS } from "@/lib/visualizations/generic/common";
import { markerAt } from "@/lib/visualizations/generic/functionGraph";
import { shapesAt } from "@/lib/visualizations/generic/geometryScene";
import { quantityValues } from "@/lib/visualizations/generic/quantityModel";
import { checkVisualization, definitionOf, validateVisualization } from "@/lib/visualizations/registry";
import type { FunctionGraphParams, GeometrySceneParams, QuantityModelParams } from "@/lib/visualizations/types";

/* ---------- a small graph config used throughout ---------- */

const graph = {
  type: "function-graph",
  params: {
    title: "A parabola",
    xRange: [-5, 5],
    parameters: [{ key: "a", label: "a", min: -2, max: 2, step: 1, value: 1 }],
    curves: [{ id: "f", label: "f", expression: "a*x^2" }],
    stages: [
      { id: "s1", caption: "a is {a}" },
      { id: "s2", caption: "now a is {a}", set: { a: -1 }, marker: { curve: "f", x: 2 }, guides: true },
      { id: "s3", caption: "the end" },
    ],
    checkpoints: [{ beforeStage: 1, prompt: "which way?", options: [{ id: "a", text: "up" }, { id: "b", text: "down" }], correctId: "b", whenRight: "yes", whenWrong: "no" }],
  },
};

const reason = (raw: unknown) => {
  const r = checkVisualization(raw);
  return r.ok ? "ok" : r.reason;
};

test("a generic config validates, fills defaults, and turns into steps and checkpoints", () => {
  const config = validateVisualization(graph);
  assert.ok(config && config.type === "function-graph");
  const params = config.params as FunctionGraphParams;
  assert.equal(params.title, "A parabola");
  assert.equal(params.observe, null);
  assert.equal(params.yRange, null);
  assert.equal(params.stages.length, 3);
  assert.equal(params.stages[0].marker, null);
  const def = definitionOf("function-graph");
  assert.deepEqual(
    def.steps(params).map((s) => s.caption),
    ["a is 1", "now a is -1", "the end"],
    "captions are templated with the stage overrides in force",
  );
  const cps = def.checkpoints(params);
  assert.equal(cps.length, 1);
  assert.equal(cps[0].beforeStep, 1);
  assert.deepEqual(def.controls(params), [{ kind: "range", key: "a", label: "a", min: -2, max: 2, step: 1, unit: undefined }]);
  assert.deepEqual(def.describe(params), { title: "A parabola", summary: "A graph of f." });
});

test("formulas are evaluated by the calculator, never executed", () => {
  const params = validateVisualization(graph)!.params as FunctionGraphParams;
  assert.deepEqual(markerAt(params, 1), { x: 2, y: -4 });
  assert.equal(markerAt(params, 0), null);
  const evil = { ...graph, params: { ...graph.params, curves: [{ id: "f", label: "f", expression: "process.exit(1)" }] } };
  assert.match(reason(evil), /curves\[0\]/);
  const withTemplate = validateVisualization({ ...graph, params: { ...graph.params, stages: [{ id: "s", caption: "see {require('fs')}" }] } });
  assert.equal(definitionOf("function-graph").steps(withTemplate!.params as FunctionGraphParams)[0].caption, "see {require('fs')}", "an unparsable template is left as text");
});

test("malformed configs are refused, with a reason, and the lesson falls back", () => {
  assert.equal(reason({ type: "function-graph", params: {} }), "function-graph: curves needs at least 1 item(s)");
  assert.match(reason({ type: "function-graph", params: { curves: [{ expression: "x +" }], stages: [{ caption: "c" }] } }), /curves\[0\]/);
  assert.match(reason({ ...graph, params: { ...graph.params, stages: [] } }), /stages needs at least 1/);
  assert.match(reason({ ...graph, params: { ...graph.params, checkpoints: [{ beforeStage: 1, prompt: "p", options: [{ id: "a", text: "a" }, { id: "b", text: "b" }], correctId: "z" }] } }), /correctId/);
  assert.match(reason({ ...graph, params: { ...graph.params, stages: [{ caption: "c", marker: { curve: "nope", x: 1 } }, { caption: "d" }] } }), /unknown curve/);
  assert.match(reason({ type: "process-sequence", params: { parameters: [{ key: "sqrt", min: 0, max: 1 }], stages: [{ caption: "c" }] } }), /identifier/);
  assert.match(reason({ ...graph, params: { ...graph.params, parameters: [{ key: "sqrt", min: 0, max: 1 }] } }), /curves\[0\]|identifier/, "a curve cannot use an undeclared parameter either");
  assert.match(reason({ type: "node-diagram", params: { nodes: [{ id: "a", label: "A" }], edges: [{ from: "a", to: "zz" }], stages: [{ caption: "c" }] } }), /edges\[0\]/);
  assert.match(reason({ type: "node-diagram", params: { nodes: [{ id: "a", label: "A" }], stages: [{ caption: "c", tokens: [{ id: "t", label: "t" }] }] } }), /needs "at"/);
  assert.match(reason({ type: "geometry-scene", params: { shapes: [{ id: "c", kind: "circle" }], stages: [{ caption: "c" }] } }), /center and radius/);
  assert.match(reason({ type: "quantity-model", params: { quantities: [{ id: "q", expression: "nope + 1" }], stages: [{ caption: "c" }] } }), /quantities\[0\]/);
  assert.equal(reason({ type: "hologram", params: {} }), 'unsupported type "hologram"');
  assert.equal(reason("function-graph"), "not an object");

  assert.equal(validateVisualization({ type: "function-graph", params: { curves: [{ expression: "x +" }] } }), null, "a bad config becomes no visualization, never an error");
});

test("limits are enforced: parameters, stages and options are capped, stray checkpoints are dropped", () => {
  const many = {
    type: "process-sequence",
    params: {
      parameters: Array.from({ length: 10 }, (_, i) => ({ key: `p${i}`, label: `p${i}`, min: 0, max: 1, step: 1, value: 0 })),
      stages: Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, caption: `step ${i}`, title: `S${i}` })),
      checkpoints: [
        { beforeStage: 0, prompt: "too early", options: [{ id: "a", text: "a" }, { id: "b", text: "b" }], correctId: "a" },
        { beforeStage: 30, prompt: "too late", options: [{ id: "a", text: "a" }, { id: "b", text: "b" }], correctId: "a" },
        { beforeStage: 2, prompt: "fine", options: [{ id: "a", text: "a" }, { id: "b", text: "b" }, { id: "c", text: "c" }, { id: "d", text: "d" }, { id: "e", text: "e" }], correctId: "a" },
      ],
    },
  };
  const config = validateVisualization(many)!;
  const p = config.params as { parameters: unknown[]; stages: unknown[]; checkpoints: { beforeStage: number; options: unknown[] }[] };
  assert.equal(p.parameters.length, LIMITS.parameters);
  assert.equal(p.stages.length, LIMITS.stages);
  assert.deepEqual(p.checkpoints.map((c) => c.beforeStage), [2]);
  assert.equal(p.checkpoints[0].options.length, LIMITS.options);
  assert.equal(validateVisualization({ type: "function-graph", params: { ...graph.params, xRange: [5, -5] } }), null);
});

test("slider changes are clamped and applied through the definition", () => {
  const def = definitionOf("function-graph");
  const params = validateVisualization(graph)!.params;
  const moved = def.applyControl(params, "a", 99) as FunctionGraphParams;
  assert.equal(moved.parameters[0].value, 2);
  assert.equal(def.steps(moved)[0].caption, "a is 2");
  assert.equal(def.steps(moved)[1].caption, "now a is -1", "a stage override still wins");
  assert.deepEqual(def.applyControl(params, "zzz", 1), params);
});

test("quantity values come from stage overrides, formulas or fixed values", () => {
  const config = validateVisualization({
    type: "quantity-model",
    params: {
      parameters: [{ key: "v", label: "v", min: 0, max: 10, step: 1, value: 5 }, { key: "t", label: "t", min: 0, max: 10, step: 1, value: 4 }],
      quantities: [{ id: "d", label: "d", expression: "v*t" }, { id: "k", label: "k", value: 7 }],
      stages: [{ id: "a", caption: "a", set: { t: 2 } }, { id: "b", caption: "b", values: { d: "v + 100", k: 1 } }],
    },
  })!;
  assert.deepEqual(quantityValues(config.params as QuantityModelParams, 0), { d: 10, k: 7 });
  assert.deepEqual(quantityValues(config.params as QuantityModelParams, 1), { d: 105, k: 1 });
});

test("geometry transforms resolve from parameters and stages", () => {
  const config = validateVisualization({
    type: "geometry-scene",
    params: {
      parameters: [{ key: "k", label: "k", min: 1, max: 3, step: 1, value: 2 }],
      shapes: [{ id: "t", kind: "polygon", points: [[0, 0], [2, 0], [0, 2]] }, { id: "c", kind: "circle", center: [5, 5], radius: "k" }],
      stages: [{ id: "a", caption: "a" }, { id: "b", caption: "b", transforms: { t: { translate: ["k", 1], rotate: 90, scale: "k" } }, show: ["t"] }],
    },
  })!;
  const before = shapesAt(config.params as GeometrySceneParams, 0);
  assert.deepEqual(before[0].transform, { dx: 0, dy: 0, rotate: 0, scale: 1 });
  assert.equal(before[1].radius, 2);
  const after = shapesAt(config.params as GeometrySceneParams, 1);
  assert.deepEqual(after[0].transform, { dx: 2, dy: 1, rotate: 90, scale: 2 });
  assert.equal(after[1].visible, false);
});

/* ---------- the workspace's distance-time graph ---------- */

test("the distance-time graph built for teachers validates and steps through every object", () => {
  const config = motionGraph({ objects: [{ label: "Rider A", speed: 6 }, { label: "Rider B", speed: 4 }], duration: 10 });
  assert.ok(config, "two riders make a valid graph");
  assert.equal(config!.type, "function-graph");
  const def = definitionOf(config!.type);
  const steps = def.steps(config!.params);
  assert.equal(steps.length, 3, "one step per rider, then the comparison");
  assert.match(steps[0].caption, /6 m\/s/);
  assert.match(steps[0].caption, /60 m/);
  for (const st of steps) assert.ok(!/\{[^}]*\}/.test(st.caption), `every template resolved in "${st.caption}"`);
  assert.deepEqual(validateVisualization(JSON.parse(JSON.stringify(config))), config, "validation is stable");
  assert.equal(motionGraph({ objects: [{ label: "", speed: 3 }], duration: 10 }), null, "an unnamed rider is refused");
  assert.equal(motionGraph({ objects: [{ label: "A", speed: 0 }], duration: 10 }), null, "a speed of zero is refused");
});
