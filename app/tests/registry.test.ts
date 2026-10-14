import assert from "node:assert/strict";
import { test } from "node:test";
import { layoutAt } from "@/lib/visualizations/packetLayout";
import { arrivalOrder, packetSteps } from "@/lib/visualizations/packetTransmission";
import { keepsShape, pcmCheckpoints, pcmSamples } from "@/lib/visualizations/pcmSampling";
import { headersAt, layerSteps, layersOf, positionAt } from "@/lib/visualizations/protocolLayers";
import { definitionOf, describeVisualizationsForPrompt, validateVisualization } from "@/lib/visualizations/registry";
import { VISUALIZATION_TYPES, type VisualizationConfig } from "@/lib/visualizations/types";

/* ---------- validation of requests (what an AI reply or a lesson may ask for) ---------- */

test("unsupported or malformed requests are rejected, never executed", () => {
  assert.equal(validateVisualization(null), null);
  assert.equal(validateVisualization("packet-transmission"), null);
  assert.equal(validateVisualization({ type: "spinning-cube" }), null);
  assert.equal(validateVisualization({ type: "packet-transmission", params: "<script>" })?.type, "packet-transmission");
  assert.equal(validateVisualization({ type: "PACKET-TRANSMISSION" }), null);
});

test("missing parameters take defaults and out-of-range ones are clamped", () => {
  assert.deepEqual(validateVisualization({ type: "packet-transmission" }), { type: "packet-transmission", params: { packets: 4, lostPacket: null } });
  assert.deepEqual(validateVisualization({ type: "packet-transmission", params: { packets: 50, lostPacket: 9 } })?.params, { packets: 8, lostPacket: 8 });
  assert.deepEqual(validateVisualization({ type: "packet-transmission", params: { packets: "3", lostPacket: "none" } })?.params, { packets: 3, lostPacket: null });
  assert.deepEqual(validateVisualization({ type: "packet-transmission", params: { packets: 1, lostPacket: 0 } })?.params, { packets: 2, lostPacket: null });
  assert.deepEqual(validateVisualization({ type: "pcm-sampling", params: { signalHz: 99, sampleRate: -4, bits: "abc" } })?.params, { signalHz: 4, sampleRate: 2, bits: 3 });
  assert.deepEqual(validateVisualization({ type: "protocol-layers", params: { model: "tcp/ip" } })?.params, { model: "tcp-ip" });
  assert.deepEqual(validateVisualization({ type: "protocol-layers", params: { model: "osi", extra: 1 } })?.params, { model: "osi" });
});

test("the prompt catalogue names every registered type and nothing else", () => {
  const text = describeVisualizationsForPrompt();
  for (const type of VISUALIZATION_TYPES) assert.ok(text.includes(`"${type}"`), type);
  assert.equal(text.split("\n").filter((line) => line.startsWith('- "')).length, VISUALIZATION_TYPES.length);
});

/* ---------- every definition: steps, captions, checkpoints ---------- */

const samples: VisualizationConfig[] = [
  ...[2, 3, 4, 5, 8].flatMap((packets) => [null, 1, Math.ceil(packets / 2), packets].map((lostPacket) => ({ type: "packet-transmission" as const, params: { packets, lostPacket } }))),
  ...[1, 2, 3, 4].flatMap((signalHz) => [2, 3, 4, 6, 8, 12, 24].flatMap((sampleRate) => [1, 2, 3, 4].map((bits) => ({ type: "pcm-sampling" as const, params: { signalHz, sampleRate, bits } })))),
  { type: "protocol-layers", params: { model: "tcp-ip" } },
  { type: "protocol-layers", params: { model: "osi" } },
];

test("every step has a caption and every checkpoint stops inside the demo with a valid answer", () => {
  for (const config of samples) {
    const def = definitionOf(config.type);
    const steps = def.steps(config.params);
    const checkpoints = def.checkpoints(config.params);
    const label = `${config.type} ${JSON.stringify(config.params)}`;
    assert.ok(steps.length >= 3, label);
    for (const s of steps) assert.ok(s.caption.trim().length > 20 && s.id, label);
    assert.equal(new Set(steps.map((s) => s.id)).size, steps.length, `${label}: step ids are unique`);
    assert.ok(checkpoints.length >= 1, `${label}: has a prediction`);
    for (const cp of checkpoints) {
      assert.ok(cp.beforeStep > 0 && cp.beforeStep < steps.length, `${label}: checkpoint before step ${cp.beforeStep} of ${steps.length}`);
      assert.ok(cp.options.some((o) => o.id === cp.correctId), `${label}: the right answer is one of the options`);
      assert.ok(cp.options.length >= 2 && cp.prompt && cp.whenRight && cp.whenWrong, label);
    }
    assert.ok(def.summary && def.title && def.useWhen && def.schemaDoc, label);
    assert.deepEqual(def.normalize({ ...config.params }), config.params, `${label}: in-range params pass through normalize unchanged`);
  }
});

/* ---------- packet transmission ---------- */

test("packets arrive out of order and a lost packet is left out until it is resent", () => {
  assert.deepEqual(arrivalOrder({ packets: 4, lostPacket: null }), [1, 3, 2, 4]);
  assert.deepEqual(arrivalOrder({ packets: 4, lostPacket: 3 }), [1, 2, 4]);
  assert.deepEqual(
    packetSteps({ packets: 4, lostPacket: 3 }).map((s) => s.id),
    ["message", "split", "travel", "loss", "arrive", "resend", "rebuild"],
  );
  assert.deepEqual(
    packetSteps({ packets: 3, lostPacket: null }).map((s) => s.id),
    ["message", "split", "travel", "arrive", "rebuild"],
  );
});

test("the packet layout is finite at every step, hides the lost packet on arrival, and ends in order", () => {
  for (let packets = 2; packets <= 8; packets++) {
    for (const lostPacket of [null, 1, packets]) {
      const params = { packets, lostPacket };
      const steps = packetSteps(params);
      steps.forEach((step, i) => {
        const layout = layoutAt(params, i);
        assert.equal(layout.packets.length, packets);
        for (const p of layout.packets) {
          assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${step.id}: finite position`);
          assert.ok(p.opacity >= 0 && p.opacity <= 1);
        }
        if (step.id === "arrive" && lostPacket !== null) assert.equal(layout.packets[lostPacket - 1].opacity, 0, "the lost packet is absent on arrival");
        if (step.id === "loss") assert.ok(layout.lossMark, "the loss is marked");
        if (step.id === "rebuild") {
          const ys = layout.packets.slice(0, 4).map((p) => p.y);
          assert.deepEqual([...ys].sort((a, b) => a - b), ys, "packets stack in sequence order at the end");
          assert.equal(layout.receiverOutline, 1);
        }
      });
    }
  }
});

/* ---------- PCM sampling ---------- */

test("the Nyquist checkpoint's right answer follows the sample rate", () => {
  assert.equal(keepsShape({ signalHz: 2, sampleRate: 12, bits: 3 }), true);
  assert.equal(keepsShape({ signalHz: 3, sampleRate: 4, bits: 3 }), false);
  assert.equal(keepsShape({ signalHz: 3, sampleRate: 6, bits: 3 }), false, "exactly twice is not enough");
  assert.equal(pcmCheckpoints({ signalHz: 2, sampleRate: 12, bits: 3 })[0].correctId, "a");
  assert.equal(pcmCheckpoints({ signalHz: 3, sampleRate: 4, bits: 3 })[0].correctId, "b");
});

test("samples are quantized to 2^bits levels with codes of the right width", () => {
  const list = pcmSamples({ signalHz: 2, sampleRate: 8, bits: 2 });
  assert.equal(list.length, 9);
  for (const s of list) {
    assert.ok(s.level >= 0 && s.level < 4);
    assert.equal(s.code.length, 2);
    assert.ok(Math.abs(s.quantized - s.value) <= 0.5 + 1e-9, "rounding error is at most half a level");
    assert.ok(Number.isFinite(s.quantized));
  }
  assert.equal(pcmSamples({ signalHz: 1, sampleRate: 4, bits: 4 })[1].code, "1111", "the peak maps to the top level");
});

/* ---------- protocol layers ---------- */

test("data goes down one stack, across the wire, and up the other with headers removed in reverse", () => {
  for (const model of ["tcp-ip", "osi"] as const) {
    const layers = layersOf(model);
    const n = layers.length;
    const steps = layerSteps({ model });
    assert.equal(steps.length, 2 * n + 1);
    assert.deepEqual(positionAt(model, 0), { side: "sender", layer: 0 });
    assert.deepEqual(positionAt(model, n), { side: "wire", layer: n - 1 });
    assert.deepEqual(positionAt(model, n + 1), { side: "receiver", layer: n - 1 });
    assert.deepEqual(positionAt(model, 2 * n), { side: "receiver", layer: 0 });
    assert.deepEqual(headersAt(model, 0), []);
    assert.equal(headersAt(model, n).length, layers.filter((l) => l.header).length, "every header is on at the wire");
    assert.deepEqual(headersAt(model, 2 * n), [], "every header is off at the end");
    for (let s = 1; s <= n; s++) assert.ok(headersAt(model, s).length >= headersAt(model, s - 1).length, "headers only grow on the way down");
    for (let s = n + 1; s <= 2 * n; s++) assert.ok(headersAt(model, s).length <= headersAt(model, s - 1).length, "headers only shrink on the way up");
  }
});
