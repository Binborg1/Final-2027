import assert from "node:assert/strict";
import { test } from "node:test";
import { validateLesson } from "@/lib/ai/teach-schema";
import { sampleTopics } from "@/lib/lessons/demo-subjects";
import { sampleCourses } from "@/lib/lessons/sample";
import { LIMITS } from "@/lib/visualizations/generic/common";
import { markerAt } from "@/lib/visualizations/generic/functionGraph";
import { shapesAt } from "@/lib/visualizations/generic/geometryScene";
import { quantityValues } from "@/lib/visualizations/generic/quantityModel";
import { packetSteps } from "@/lib/visualizations/packetTransmission";
import { pcmSteps } from "@/lib/visualizations/pcmSampling";
import { initialPlayer, playerStatus, reducePlayer, type PlayerContext, type PlayerState } from "@/lib/visualizations/player";
import { layerSteps } from "@/lib/visualizations/protocolLayers";
import { checkVisualization, definitionOf, describeVisualizationsForPrompt, validateVisualization } from "@/lib/visualizations/registry";
import { tutorStateOf } from "@/lib/visualizations/tutorState";
import { VISUALIZATION_TYPES, type FunctionGraphParams, type GeometrySceneParams, type QuantityModelParams, type VisualizationConfig } from "@/lib/visualizations/types";
import type { Player } from "@/lib/visualizations/usePlayer";

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

  const lesson = validateLesson({ explanation: "x", question: { type: "short", prompt: "q", answerSketch: "a" }, visualization: { type: "function-graph", params: { curves: [{ expression: "x +" }] } } });
  assert.equal(lesson.visualization, null, "a bad request does not break the lesson");
  assert.equal(lesson.explanation, "x");
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

/* ---------- cross-subject examples: the tutor can select, explain, pause, evaluate and continue ---------- */

const expectedTypes: Record<string, string[]> = {
  "sample-computer-networks": ["packet-transmission", "packet-transmission", "protocol-layers", "pcm-sampling", "pcm-sampling"],
  "sample-mathematics": ["function-graph", "geometry-scene"],
  "sample-physics": ["quantity-model", "function-graph"],
  "sample-computer-science": ["quantity-model"],
  "sample-biology": ["node-diagram", "process-sequence"],
};

function visualizedConcepts(courseId: string) {
  return sampleTopics(courseId).flatMap((t) => t.concepts.filter((c) => c.visualization).map((c) => ({ topic: t.id, concept: c.id, config: c.visualization! })));
}

/** Plays a demo the way the tutor does: play until the prediction, answer, continue to the end. */
function runThrough(config: VisualizationConfig) {
  const def = definitionOf(config.type);
  const steps = def.steps(config.params);
  const checkpoints = def.checkpoints(config.params);
  const ctx: PlayerContext = { stepCount: steps.length, checkpoints };
  let s: PlayerState = reducePlayer(initialPlayer, { type: "play" }, ctx);
  let ticks = 0;
  while (playerStatus(s, ctx) === "showing" && ticks++ < 100) s = reducePlayer(s, { type: "tick" }, ctx);
  assert.equal(playerStatus(s, ctx), "checkpoint", "the demo stops at the prediction");
  const hidden = steps[checkpoints[0].beforeStep].caption;
  assert.equal(s.step, checkpoints[0].beforeStep - 1, "the hidden step is not shown yet");
  assert.notEqual(steps[s.step].caption, hidden);
  s = reducePlayer(s, { type: "answer", option: checkpoints[0].correctId }, ctx);
  assert.equal(playerStatus(s, ctx), "answered");
  s = reducePlayer(s, { type: "play" }, ctx);
  assert.equal(steps[s.step].caption, hidden, "Continue reveals the hidden step");
  while (playerStatus(s, ctx) === "showing" && ticks++ < 200) s = reducePlayer(s, { type: "tick" }, ctx);
  assert.equal(playerStatus(s, ctx), "done");
  return { steps, checkpoints };
}

test("every sample course has lessons, and each subject uses the expected visualization types", () => {
  assert.equal(sampleCourses.length, 5);
  for (const course of sampleCourses) {
    const found = visualizedConcepts(course.id);
    assert.deepEqual(found.map((f) => f.config.type), expectedTypes[course.id], course.name);
    assert.ok(sampleTopics(course.id).every((t) => t.concepts.length >= 1 && t.concepts.every((c) => c.hints.length >= 1)), `${course.name}: every concept has a question and hints`);
  }
});

test("each cross-subject demo survives the AI reply path unchanged and can be taught end to end", () => {
  for (const course of sampleCourses) {
    for (const { topic, concept, config } of visualizedConcepts(course.id)) {
      const label = `${course.id}/${topic}/${concept}`;
      // The same data as an AI reply: through JSON and the lesson validator.
      const lesson = validateLesson({ explanation: "e", question: { type: "short", prompt: "q", answerSketch: "a" }, visualization: JSON.parse(JSON.stringify(config)) });
      assert.deepEqual(lesson.visualization, config, `${label}: validation is stable`);
      const { steps, checkpoints } = runThrough(config);
      assert.ok(steps.length >= 3 && steps.length <= LIMITS.stages, `${label}: ${steps.length} steps`);
      assert.equal(checkpoints.length, 1, `${label}: one prediction`);
      for (const s of steps) assert.ok(!/\{[^}]*\}/.test(s.caption), `${label}: every template resolved in "${s.caption}"`);
      for (const c of checkpoints) assert.ok(![c.prompt, ...c.options.map((o) => o.text), c.whenRight, c.whenWrong].some((t) => /\{[^}]*\}/.test(t)), `${label}: prediction templates resolved`);
      const { title, summary } = definitionOf(config.type).describe(config.params);
      assert.ok(title && summary, `${label}: the tutor has an introduction`);
    }
  }
});

test("the prompt catalogue covers every type and explains the shared fields once", () => {
  const text = describeVisualizationsForPrompt();
  for (const type of VISUALIZATION_TYPES) assert.ok(text.includes(`"${type}"`), type);
  assert.ok(text.includes('"checkpoints"') && text.includes('"stages"') && text.includes("formula"));
});

/* ---------- narration stays in step with the demo ---------- */

function fakePlayer(config: VisualizationConfig, step: number, gate: number | null = null, chosen: string | null = null): Player {
  const definition = definitionOf(config.type);
  const steps = definition.steps(config.params);
  const checkpoints = definition.checkpoints(config.params);
  const checkpoint = gate !== null ? checkpoints[gate] : null;
  const noop = () => {};
  return {
    type: config.type,
    definition,
    params: config.params,
    steps,
    checkpoints,
    state: { step, playing: false, gate, answers: chosen ? { [gate!]: chosen } : {}, started: true },
    status: gate !== null ? (chosen ? "answered" : "checkpoint") : step >= steps.length - 1 ? "done" : "showing",
    current: steps[step],
    checkpoint,
    checkpointIndex: gate,
    chosen,
    answerRight: checkpoint && chosen ? chosen === checkpoint.correctId : null,
    play: noop,
    pause: noop,
    reset: noop,
    forward: noop,
    answer: noop,
    setParam: noop,
    driver: { start: noop, resume: noop, pause: noop, reset: noop },
  };
}

test("what the mascot says is exactly what the demo shows", () => {
  for (const course of sampleCourses) {
    for (const { config } of visualizedConcepts(course.id)) {
      const def = definitionOf(config.type);
      const steps = def.steps(config.params);
      steps.forEach((s, i) => {
        const viz = tutorStateOf(fakePlayer(config, i))!;
        assert.equal(viz.caption, s.caption);
        assert.equal(viz.lastCaption, steps[steps.length - 1].caption);
        assert.equal(viz.title, def.describe(config.params).title);
      });
      const cp = def.checkpoints(config.params)[0];
      const asked = tutorStateOf(fakePlayer(config, cp.beforeStep - 1, 0))!;
      assert.equal(asked.status, "checkpoint");
      assert.equal(asked.checkpoint?.prompt, cp.prompt);
      const right = tutorStateOf(fakePlayer(config, cp.beforeStep - 1, 0, cp.correctId))!;
      assert.equal(right.answerRight, true);
    }
  }
});

/* ---------- regression: the networking demonstrations are unchanged ---------- */

test("the specialized networking visualizations keep their steps and predictions", () => {
  assert.deepEqual(packetSteps({ packets: 4, lostPacket: 3 }).map((s) => s.id), ["message", "split", "travel", "loss", "arrive", "resend", "rebuild"]);
  assert.deepEqual(packetSteps({ packets: 3, lostPacket: null }).map((s) => s.id), ["message", "split", "travel", "arrive", "rebuild"]);
  assert.deepEqual(pcmSteps({ signalHz: 2, sampleRate: 12, bits: 3 }).map((s) => s.id), ["analog", "sample", "quantize", "encode", "rebuild"]);
  assert.equal(layerSteps({ model: "tcp-ip" }).length, 9);
  assert.equal(layerSteps({ model: "osi" }).length, 15);
  assert.deepEqual(validateVisualization({ type: "packet-transmission", params: { packets: 99 } }), { type: "packet-transmission", params: { packets: 8, lostPacket: null } }, "specialized params still clamp");
  for (const type of ["packet-transmission", "pcm-sampling", "protocol-layers"] as const) {
    assert.equal(definitionOf(type).family, "specialized");
    assert.ok(definitionOf(type).controls(definitionOf(type).defaults).length >= 1);
  }
});
