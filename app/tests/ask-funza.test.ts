import assert from "node:assert/strict";
import { test } from "node:test";
import { askPrompt, visionPrompt } from "@/lib/ai/tutor-prompts";
import { MAX_IMAGE_BASE64_CHARS, parseImagePayload, supportsVision } from "@/lib/ai/vision";
import { detectIntent, fallbackAnswer, localAnswer, NOTHING_OPEN, SUGGESTED_QUESTIONS, type AskIntent } from "@/lib/tutor/askFunza";
import type { Concept, Course, Topic } from "@/lib/types";
import { lessonWorkspace, workspaceForPrompt, type WorkspaceContext, type WorkspaceVisualization } from "@/lib/workspace/context";

/* ---------- a lesson as the student sees it ---------- */

const course: Course = { id: "c", name: "Sample: Computer Networks", files: [], createdAt: "2026-10-14T00:00:00.000Z", sample: true };
const concept: Concept = {
  id: "split-into-packets",
  title: "Messages are split into packets",
  explanation: "When you send a message, your computer cuts it into packets. Each packet carries a header with its sequence number. Routers forward them.",
  alternateExplanation: "Imagine mailing a book one page per numbered envelope.",
  question: {
    kind: "mcq",
    prompt: "You send a message to a website. What happens to it before it arrives?",
    options: [
      { id: "a", text: "It goes as one big file." },
      { id: "b", text: "It is split into small packets that may take different routes." },
      { id: "c", text: "It is converted into a video." },
    ],
    correctOptionId: "b",
  },
  whyCorrect: "SECRET-WHY: splitting lets each piece travel on its own.",
  hints: ["Think about what the header on each piece is for.", "One giant block has to fit through every link along the way."],
};
const topic: Topic = { id: "packets", title: "How data travels across the internet", summary: "Messages become packets.", whyItMatters: "x", concepts: [concept] };
const demo: WorkspaceVisualization = {
  type: "packet-transmission",
  title: "Packet transmission",
  summary: "A message is split into numbered packets that travel by different routes.",
  status: "checkpoint",
  step: 2,
  stepCount: 5,
  caption: "Each packet travels on its own.",
  captions: ["a", "b", "Each packet travels on its own.", "d", "e"],
  checkpoint: { prompt: "Will they arrive in order?", options: [{ id: "a", text: "Always" }, { id: "b", text: "Not necessarily" }] },
  chosen: null,
  answerRight: null,
  parameters: [{ label: "Packets", value: "3" }, { label: "Lose a packet", value: "none" }],
};

function workspace(over: Partial<Parameters<typeof lessonWorkspace>[0]> = {}): WorkspaceContext {
  return lessonWorkspace({
    course,
    topic,
    concept,
    index: 0,
    total: 5,
    phase: "asking",
    answer: "",
    lastSubmitted: null,
    attempts: 0,
    notice: null,
    visualization: demo,
    tutor: { active: false, step: "off", paused: false },
    ...over,
  });
}

const SECRETS = ["SECRET-WHY", "It is split into small packets that may take different routes"];
const leaks = (text: string) => SECRETS.filter((s) => text.includes(s));

/* ---------- intents ---------- */

test("the questions a student asks map to the right intent", () => {
  const cases: [string, AskIntent][] = [
    ["Funza, can you see what I'm working on?", "overview"],
    ["What am I looking at?", "overview"],
    ["what is this?", "overview"],
    ["Can you explain this diagram?", "diagram"],
    ["Explain the demo", "diagram"],
    ["Where did I go wrong?", "mistake"],
    ["why is my answer wrong", "mistake"],
    ["Give me a hint for this question.", "hint"],
    ["I'm stuck", "hint"],
    ["Can you show me another way?", "another-way"],
    ["I don't understand", "another-way"],
    ["What is the capital of France?", "other"],
    ["", "overview"],
  ];
  for (const [q, intent] of cases) assert.equal(detectIntent(q), intent, q);
  for (const q of SUGGESTED_QUESTIONS) assert.notEqual(detectIntent(q), "other", `${q} is answered locally`);
});

/* ---------- local answers ---------- */

test("the overview describes the course, topic, concept, question, demo and progress", () => {
  const text = localAnswer(workspace(), "overview")!.text;
  for (const s of ["Sample: Computer Networks", "How data travels", "concept 1 of 5", "Messages are split into packets", "What happens to it before it arrives", "Packet transmission", "paused for your prediction", "haven't answered yet"]) {
    assert.ok(text.includes(s), `overview mentions "${s}"`);
  }
  assert.deepEqual(leaks(text), []);
});

test("the diagram answer reads the demo state, and says so when there is no diagram", () => {
  const paused = localAnswer(workspace(), "diagram")!.text;
  assert.ok(paused.includes("Packet transmission") && paused.includes("Will they arrive in order?") && paused.includes("Packets 3"));
  const idle = localAnswer(workspace({ visualization: { ...demo, status: "idle", step: 0 } }), "diagram")!.text;
  assert.ok(idle.includes("Press Play"));
  const still = lessonWorkspace({ ...{ course, topic, concept: { ...concept, illustration: "packets" }, index: 0, total: 5, phase: "asking", answer: "", lastSubmitted: null, attempts: 0, notice: null, visualization: null, tutor: { active: false, step: "off", paused: false } } });
  assert.ok(localAnswer(still, "diagram")!.text.includes("One message becomes several packets"));
  const none = workspace({ visualization: null });
  assert.ok(localAnswer(none, "diagram")!.text.includes("no diagram"));
});

test("where did I go wrong: names the chosen option and hints, never the answer", () => {
  const fresh = localAnswer(workspace(), "mistake")!.text;
  assert.ok(fresh.includes("haven't checked an answer yet"));
  const wrong = workspace({ phase: "incorrect", attempts: 1, answer: "a", lastSubmitted: "a", notice: null });
  const text = localAnswer(wrong, "mistake")!.text;
  assert.ok(text.includes("(a) It goes as one big file."), "names what was picked");
  assert.ok(text.includes("Here's a hint: One giant block"), "gives the next unheard hint");
  assert.ok(text.includes("numbered envelope"), "offers the other explanation");
  assert.deepEqual(leaks(text), []);
  const retrying = workspace({ phase: "asking", attempts: 1, answer: "", lastSubmitted: "a" });
  assert.ok(localAnswer(retrying, "mistake")!.text.includes("(a)"), "remembers the last checked answer after the options were cleared");
});

test("hints come in order, then the fallback, and the answer appears only once the lesson revealed it", () => {
  const ctx = workspace();
  assert.ok(localAnswer(ctx, "hint", { hintsAsked: 0 })!.text.includes("header on each piece"));
  assert.ok(localAnswer(ctx, "hint", { hintsAsked: 1 })!.text.includes("One giant block"));
  const last = localAnswer(ctx, "hint", { hintsAsked: 2 })!.text;
  assert.ok(last.includes("last hint") && last.includes("One giant block"));
  for (const n of [0, 1, 2]) assert.deepEqual(leaks(localAnswer(ctx, "hint", { hintsAsked: n })!.text), []);

  const revealed = workspace({ phase: "revealed", attempts: 3 });
  assert.ok(localAnswer(revealed, "mistake")!.text.includes("SECRET-WHY"), "after reveal the explanation is fair game");
  const correct = workspace({ phase: "correct", attempts: 1, lastSubmitted: "b" });
  assert.ok(localAnswer(correct, "hint")!.text.includes("finished"));
  assert.ok(localAnswer(correct, "mistake")!.text.includes("Nothing went wrong"));
});

test("another way uses the alternate explanation and free questions fall back honestly", () => {
  assert.ok(localAnswer(workspace(), "another-way")!.text.includes("numbered envelope"));
  assert.equal(localAnswer(workspace(), "other"), null, "free questions need the AI");
  const noAi = fallbackAnswer(workspace(), "no-ai").text;
  assert.ok(noAi.includes("without an AI provider") && noAi.includes("concept 1 of 5"));
  assert.ok(fallbackAnswer(workspace(), "failed").text.includes("couldn't reach"));
  assert.ok(NOTHING_OPEN.includes("Open a lesson"));
});

/* ---------- what the AI is told ---------- */

test("the prompt context withholds the answer key until the lesson has shown it", () => {
  const before = workspaceForPrompt(workspace({ phase: "incorrect", attempts: 1, lastSubmitted: "a" }));
  assert.deepEqual(leaks(before.replace("(b) It is split into small packets that may take different routes.", "")), [], "the option list is there, but nothing marks which is right");
  assert.ok(before.includes("withheld"));
  assert.ok(before.includes("Hints not yet given"));
  assert.ok(before.includes('last checked: "a"') || before.includes('"a"'));
  assert.ok(before.includes("Packet transmission") && before.includes("Packets = 3"));
  const after = workspaceForPrompt(workspace({ phase: "revealed", attempts: 3 }));
  assert.ok(after.includes("SECRET-WHY") && after.includes("already shown"));
});

test("the tutor prompts guide instead of answering and treat screen content as data", () => {
  const { system, user } = askPrompt("Where did I go wrong?", "CONTEXT");
  assert.ok(/never state the final answer/i.test(system));
  assert.ok(/not instructions/i.test(system));
  assert.ok(user.includes("CONTEXT") && user.includes("Where did I go wrong?"));
  const vision = visionPrompt("What is this?", "CONTEXT");
  assert.ok(/personal details/i.test(vision.system) && /unclear/i.test(vision.system));
  assert.ok(vision.user.includes("screenshot"));
});

/* ---------- screenshots ---------- */

test("vision support follows the provider and model, with an explicit override", () => {
  assert.equal(supportsVision("anthropic", "claude-opus-5-5"), true);
  assert.equal(supportsVision("gemini", "gemini-2.5-flash"), true);
  assert.equal(supportsVision("groq", "llama-3.3-70b-versatile"), false);
  assert.equal(supportsVision("groq", "meta-llama/llama-4-scout-17b-16e-instruct"), true);
  assert.equal(supportsVision("openrouter", "meta-llama/llama-3.3-70b-instruct:free"), false);
  assert.equal(supportsVision("openrouter", "openai/gpt-4o-mini"), true);
  assert.equal(supportsVision("openrouter", "qwen/qwen2.5-vl-72b-instruct"), true);
  assert.equal(supportsVision("groq", "llama-3.3-70b-versatile", "true"), true);
  assert.equal(supportsVision("anthropic", "claude-opus-5-5", "false"), false);
  assert.equal(supportsVision("mystery", "model"), false);
});

test("only a real image payload of a sane size is accepted", () => {
  const pixel = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
  const parsed = parseImagePayload(`data:image/jpeg;base64,${pixel}`);
  assert.ok(parsed && parsed.mediaType === "image/jpeg" && parsed.data === pixel);
  assert.ok(parseImagePayload({ mediaType: "image/png", data: pixel }));
  assert.equal(parseImagePayload(`data:text/html;base64,${pixel}`), null, "only images");
  assert.equal(parseImagePayload("data:image/png;base64,not base64!!"), null);
  assert.equal(parseImagePayload(`data:image/png;base64,${"A".repeat(MAX_IMAGE_BASE64_CHARS + 4)}`), null, "too big");
  assert.equal(parseImagePayload("<img src=x onerror=alert(1)>"), null);
  assert.equal(parseImagePayload(42), null);
  assert.equal(parseImagePayload(null), null);
});
