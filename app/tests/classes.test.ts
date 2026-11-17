import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDraft } from "@/lib/ai/teach-schema";
import {
  canPublish,
  conceptProblems,
  isValidCode,
  lectureState,
  makeCode,
  normalizeCode,
  publicView,
  publishLecture,
  reviewCounts,
  sanitizeRecord,
  type ClassRecord,
  type DraftConcept,
  type Lecture,
} from "@/lib/classes/model";

const NOW = "2026-11-11T12:00:00.000Z";

function concept(id: string, review: DraftConcept["review"] = "pending"): DraftConcept {
  return {
    id,
    title: `Concept ${id}`,
    explanation: "TCP numbers every byte so the receiver can put segments back in order.",
    alternateExplanation: "Think of page numbers on a printed report.",
    question: {
      kind: "mcq",
      prompt: "Why does TCP number bytes?",
      options: [
        { id: "a", text: "To reorder and detect loss" },
        { id: "b", text: "To encrypt them" },
      ],
      correctOptionId: "a",
    },
    whyCorrect: "Sequence numbers let the receiver reorder segments and spot gaps.",
    hints: ["What happens when segments arrive out of order?"],
    review,
  };
}

function lecture(concepts: DraftConcept[]): Lecture {
  return { id: "tcp-1", title: "TCP", fileName: "tcp.pdf", draftedBy: "ai", objectives: [], concepts, createdAt: NOW, updatedAt: NOW, published: null };
}

function record(lectures: Lecture[]): ClassRecord {
  return { code: "K7Q2PX", name: "Networks", term: "Winter 2027", professor: "Dr. Sample", createdAt: NOW, updatedAt: NOW, lectures };
}

test("class codes avoid look-alike characters and survive sloppy typing", () => {
  let n = 0;
  const code = makeCode(() => n++ % 32);
  assert.equal(code.length, 6);
  assert.ok(isValidCode(code));
  assert.equal(normalizeCode(" k7q-2px "), "K7Q2PX");
  assert.ok(isValidCode("K7Q2PX"));
  assert.ok(!isValidCode("K7Q2P0"), "0 is not in the alphabet");
  assert.ok(!isValidCode("K7Q2P"), "too short");
});

test("a lecture can only be published once every kept concept is approved", () => {
  const l = lecture([concept("1-a", "approved"), concept("2-b"), concept("3-c", "removed")]);
  assert.deepEqual(reviewCounts(l), { approved: 1, pending: 1, removed: 1, kept: 2 });
  assert.equal(canPublish(l), false);
  const approved = { ...l, concepts: l.concepts.map((c) => (c.review === "pending" ? { ...c, review: "approved" as const } : c)) };
  assert.equal(canPublish(approved), true);
  assert.equal(canPublish(lecture([concept("1-a", "removed")])), false, "nothing approved");
});

test("students get the published snapshot only: no drafts, no removed concepts, no review flags", () => {
  const draft = lecture([concept("1-a", "approved"), concept("2-b", "removed")]);
  const published = publishLecture(draft, NOW);
  assert.equal(lectureState(published), "published");

  const view = publicView(record([published, { ...lecture([concept("9-z", "approved")]), id: "unpublished" }]));
  assert.equal(view.lectures.length, 1, "unpublished lectures are hidden");
  assert.deepEqual(view.lectures[0].concepts.map((c) => c.id), ["1-a"]);
  assert.ok(!("review" in view.lectures[0].concepts[0]));
  assert.ok(!JSON.stringify(view).includes("removed"));

  // Editing after publishing does not change what students see until the professor publishes again.
  const edited = { ...published, concepts: published.concepts.map((c) => ({ ...c, explanation: "Changed." })) };
  assert.equal(lectureState(edited), "changed");
  assert.equal(publicView(record([edited])).lectures[0].concepts[0].explanation, draft.concepts[0].explanation);
});

test("the server keeps the stored code and drops what the lesson screen cannot show", () => {
  const sent = {
    ...record([
      lecture([concept("1-a", "approved")]),
      { ...lecture([]), id: "../etc/passwd" },
    ]),
    code: "HACKED",
    createdAt: "2000-01-01T00:00:00.000Z",
  };
  const clean = sanitizeRecord(sent, { code: "K7Q2PX", name: "x", term: "", professor: "x", createdAt: NOW }, NOW);
  assert.equal(clean.code, "K7Q2PX");
  assert.equal(clean.createdAt, NOW);
  assert.deepEqual(clean.lectures.map((l) => l.id), ["tcp-1"], "a lecture with an unsafe id is dropped");
  assert.throws(() => sanitizeRecord({ ...sent, name: " " }, clean, NOW), /name/);
});

test("half-finished edits survive a save, but cannot stay approved", () => {
  const blankExplanation = { ...concept("1-a", "approved"), explanation: "" };
  const emptyOption = { ...concept("2-b"), question: { kind: "mcq", prompt: "Q?", options: [{ id: "a", text: "" }], correctOptionId: "a" } };
  const clean = sanitizeRecord(record([lecture([blankExplanation, emptyOption as DraftConcept])]), record([]), NOW);
  const [first, second] = clean.lectures[0].concepts;
  assert.equal(first.explanation, "", "the professor's blank field is kept, not the concept thrown away");
  assert.equal(first.review, "pending", "an incomplete concept is sent back for review");
  assert.equal(second.question.kind, "mcq");
  assert.equal(clean.lectures[0].concepts.length, 2);
});

test("conceptProblems lists what blocks approval", () => {
  assert.deepEqual(conceptProblems(concept("1-a")), []);
  const bad = { ...concept("1-a"), title: " ", hints: [""], question: { kind: "mcq" as const, prompt: "Q?", options: [{ id: "a", text: "only" }], correctOptionId: "a" } };
  assert.deepEqual(conceptProblems(bad), ["Add a title.", "Give at least two answer options.", "Add at least one hint."]);
});

test("an AI draft keeps its answer key when the options are shuffled", () => {
  const raw = {
    explanation: "Explained.",
    alternateExplanation: "Another way.",
    question: { prompt: "Which?", options: ["right", "wrong 1", "wrong 2", "wrong 3"], correctIndex: 0 },
    hints: ["nudge", "pointer"],
    whyCorrect: "Because.",
  };
  for (const r of [0, 0.3, 0.6, 0.99]) {
    const d = validateDraft(raw, () => r);
    const correct = d.question.options.find((o) => o.id === d.question.correctOptionId);
    assert.equal(correct?.text, "right");
    assert.deepEqual(d.question.options.map((o) => o.id), ["a", "b", "c", "d"]);
  }
  assert.throws(() => validateDraft({ ...raw, question: { ...raw.question, correctIndex: 4 } }), /correctIndex/);
  assert.throws(() => validateDraft({ ...raw, question: { ...raw.question, options: ["a", "A", "b"] } }), /repeat/);
  assert.throws(() => validateDraft({ ...raw, hints: [] }), /hints/);
});
