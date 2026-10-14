import assert from "node:assert/strict";
import { test } from "node:test";
import { tutorLine, tutorScript, vizSignature, type TutorScriptContext } from "@/lib/tutor/tutorLine";
import type { Concept } from "@/lib/types";
import type { VisualizationTutorState } from "@/lib/visualizations/tutorState";

const concept: Concept = {
  id: "c1",
  title: "Messages are split into packets",
  explanation: "The explanation.",
  alternateExplanation: "Another angle.",
  question: {
    kind: "mcq",
    prompt: "What happens to a message?",
    options: [
      { id: "a", text: "Nothing" },
      { id: "b", text: "It is split" },
    ],
    correctOptionId: "b",
  },
  whyCorrect: "Because.",
  hints: ["Hint one.", "Hint two."],
};

const checkpoint = {
  beforeStep: 3,
  prompt: "Will they arrive in order?",
  options: [
    { id: "a", text: "Always" },
    { id: "b", text: "Not necessarily" },
  ],
  correctId: "b",
  whenRight: "RIGHT-TEXT",
  whenWrong: "WRONG-TEXT",
};

function viz(partial: Partial<VisualizationTutorState>): VisualizationTutorState {
  return {
    title: "Packet transmission",
    summary: "A message is split into packets.",
    status: "idle",
    started: false,
    caption: "CAPTION-ONE",
    lastCaption: "LAST-CAPTION",
    checkpoint: null,
    checkpointIndex: null,
    answerRight: null,
    ...partial,
  };
}

function ctx(v: VisualizationTutorState | null): TutorScriptContext {
  return { concept, index: 0, total: 3, phase: "asking", attempts: 0, notice: null, finished: false, completed: 0, missed: 0, topicTitle: "Topic", learned: [], viz: v };
}

const spoken = (plan: ReturnType<typeof tutorScript>) => plan.utterances.map((u) => u.text).join(" ");

/* ---------- tutor mode ---------- */

test("without a demo the script is unchanged: explain, then ask", () => {
  const plan = tutorScript(ctx(null));
  assert.equal(plan.preStep, "explaining");
  assert.deepEqual(
    plan.utterances.map((u) => u.step),
    ["explaining", "asking"],
  );
  assert.equal(plan.thenStep, "waiting");
  assert.equal(plan.thenAction, undefined);
});

test("with a demo the tutor explains, introduces it, and starts it; the question waits", () => {
  const plan = tutorScript(ctx(viz({ status: "idle" })));
  assert.equal(plan.preStep, "explaining");
  assert.ok(spoken(plan).includes(concept.explanation));
  assert.ok(spoken(plan).includes("A message is split into packets."), "introduces what the demo shows");
  assert.ok(!spoken(plan).includes(concept.question.prompt), "the lesson question is not asked yet");
  assert.equal(plan.thenAction, "viz-start");
  assert.equal(plan.thenStep, "showing");
});

test("a demo that already ran is restarted without the whole explanation again", () => {
  const plan = tutorScript(ctx(viz({ status: "idle", started: true })));
  assert.ok(!spoken(plan).includes(concept.explanation));
  assert.equal(plan.thenAction, "viz-start");
});

test("while the demo plays the tutor stays quiet and the plan does not change from step to step", () => {
  const a = tutorScript(ctx(viz({ status: "showing", caption: "CAPTION-ONE" })));
  const b = tutorScript(ctx(viz({ status: "showing", caption: "CAPTION-TWO" })));
  assert.deepEqual(a, b);
  assert.equal(a.utterances.length, 0);
  assert.equal(vizSignature(viz({ status: "showing", caption: "CAPTION-ONE" })), vizSignature(viz({ status: "showing", caption: "CAPTION-TWO" })));
});

test("at a checkpoint the tutor asks for a prediction and does not reveal the outcome", () => {
  const plan = tutorScript(ctx(viz({ status: "checkpoint", checkpoint, checkpointIndex: 0 })));
  const text = spoken(plan);
  assert.ok(text.includes(checkpoint.prompt));
  assert.ok(text.includes("A: Always") && text.includes("B: Not necessarily"), "reads the options");
  assert.ok(!text.includes("RIGHT-TEXT") && !text.includes("WRONG-TEXT") && !text.includes("LAST-CAPTION"), "no outcome before the prediction");
  assert.equal(plan.thenStep, "predicting");
  assert.equal(plan.thenAction, undefined, "the demo stays stopped");
});

test("after the prediction the tutor responds to the answer and resumes the demo", () => {
  const right = tutorScript(ctx(viz({ status: "answered", checkpoint, checkpointIndex: 0, answerRight: true })));
  assert.ok(spoken(right).includes("RIGHT-TEXT"));
  assert.equal(right.utterances[0].state, "celebrating");
  assert.equal(right.thenAction, "viz-resume");

  const wrong = tutorScript(ctx(viz({ status: "answered", checkpoint, checkpointIndex: 0, answerRight: false })));
  assert.ok(spoken(wrong).includes("WRONG-TEXT"));
  assert.ok(!spoken(wrong).includes("RIGHT-TEXT"));
  assert.equal(wrong.thenAction, "viz-resume");
  assert.notEqual(vizSignature(viz({ status: "answered", checkpointIndex: 0, answerRight: true })), vizSignature(viz({ status: "answered", checkpointIndex: 0, answerRight: false })));
});

test("when the demo ends the tutor says the last step, then asks the lesson question", () => {
  const plan = tutorScript(ctx(viz({ status: "done" })));
  const text = spoken(plan);
  assert.ok(text.indexOf("LAST-CAPTION") < text.indexOf(concept.question.prompt));
  assert.equal(plan.thenStep, "waiting");
  assert.equal(plan.thenAction, undefined);
});

test("the demo does not change the script once the student has answered the lesson question", () => {
  const base = ctx(viz({ status: "done" }));
  const wrong = tutorScript({ ...base, phase: "incorrect", attempts: 1 });
  assert.equal(wrong.thenAction, "retry");
  const correct = tutorScript({ ...base, phase: "correct" });
  assert.ok(spoken(correct).includes(concept.whyCorrect));
});

/* ---------- the manual voice ---------- */

test("the manual voice introduces the demo, mirrors its captions silently, asks, responds and wraps up", () => {
  const idle = tutorLine(ctx(viz({ status: "idle" })));
  assert.ok(idle.text.includes(concept.explanation) && idle.text.includes("Play"));
  assert.ok(!idle.silent);

  const one = tutorLine(ctx(viz({ status: "showing", caption: "CAPTION-ONE" })));
  const two = tutorLine(ctx(viz({ status: "showing", caption: "CAPTION-TWO" })));
  assert.equal(one.text, "CAPTION-ONE");
  assert.equal(one.silent, true, "the demo narrates its own captions");
  assert.equal(one.key, two.key, "no new spoken line per animation step");

  const ask = tutorLine(ctx(viz({ status: "checkpoint", checkpoint, checkpointIndex: 0 })));
  assert.ok(ask.text.includes(checkpoint.prompt) && !ask.text.includes("RIGHT-TEXT"));
  assert.notEqual(ask.key, one.key);

  const answered = tutorLine(ctx(viz({ status: "answered", checkpoint, checkpointIndex: 0, answerRight: false })));
  assert.ok(answered.text.includes("WRONG-TEXT"));
  assert.notEqual(answered.key, ask.key);

  const done = tutorLine(ctx(viz({ status: "done" })));
  assert.ok(done.text.includes("LAST-CAPTION") && done.text.includes(concept.question.prompt));
});
