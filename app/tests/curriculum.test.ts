import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { validateCurriculumBlocks } from "@/lib/ai/teach-schema";
import {
  approvedConcepts,
  canPublish,
  curriculumProblems,
  draftFromBlock,
  lectureState,
  publicView,
  publishingProblems,
  publishLecture,
  sanitizeRecord,
  type ClassRecord,
  type DraftConcept,
  type Lecture,
} from "@/lib/classes/model";
import { CATALOG, findOutcome, outcomeLimitations, outcomeProblems, usableOutcome, type Jurisdiction } from "@/lib/curriculum/catalog";
import { checkBlock, lessonContext } from "@/lib/curriculum/checks";
import { blockConcepts, blockFingerprint, curriculumMeta, motionVisualization, type CurriculumBlock } from "@/lib/curriculum/lesson";
import { sci10Fm2Template } from "@/lib/curriculum/templates/sci10-fm2";
import { validateVisualization } from "@/lib/visualizations/registry";

const NOW = "2026-11-18T12:00:00.000Z";
const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const FM2 = "sk-sci10-fm2";
const meta = curriculumMeta(findOutcome(FM2)!);
const ctx = lessonContext(meta);

/** Confirms every judgment item for the block's current content, as a teacher ticking the checklist would. */
function acknowledge(block: CurriculumBlock): CurriculumBlock {
  const report = checkBlock(block, ctx, meta);
  return { ...block, acknowledged: { fingerprint: report.fingerprint, ids: report.judgments.map((j) => j.id) } };
}
function approve(block: CurriculumBlock): CurriculumBlock {
  const b = acknowledge(block);
  return { ...b, approvedFingerprint: blockFingerprint(b) };
}
function lesson(blocks: CurriculumBlock[], review: (b: CurriculumBlock) => DraftConcept["review"] = () => "pending"): Lecture {
  return {
    id: "sci10-fm2-test",
    title: "Motion at a constant speed",
    fileName: "",
    draftedBy: "template",
    objectives: [],
    concepts: blocks.map((b) => draftFromBlock(b, review(b))),
    createdAt: NOW,
    updatedAt: NOW,
    published: null,
    curriculum: meta,
  };
}
const approvedLesson = () => lesson(sci10Fm2Template().map(approve), () => "approved");
const record = (lectures: Lecture[]): ClassRecord => ({ code: "K7Q2PX", name: "Science 10", term: "Winter 2027", professor: "Ms. Sample", createdAt: NOW, updatedAt: NOW, lectures });
const stored = { code: "K7Q2PX", name: "x", term: "", professor: "x", createdAt: NOW };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/* ---------- catalog ---------- */

test("every catalog outcome is sound: official source, retrieval date, and wording that matches its fingerprint", () => {
  for (const j of CATALOG) for (const c of j.courses) for (const u of c.units) for (const o of u.outcomes) {
    assert.deepEqual(outcomeProblems({ jurisdiction: j, course: c, unit: u, outcome: o }, sha256), [], o.code);
  }
  const fm2 = findOutcome(FM2)!;
  assert.equal(fm2.outcome.code, "SCI10-FM2");
  assert.equal(fm2.outcome.statement, "Investigate and represent the motion of objects that travel at a constant speed in a straight line.");
  assert.equal(fm2.outcome.indicators.length, 0, "no indicator may be listed until it is verified");
  assert.equal(fm2.outcome.indicatorsStatus, "pending");
  assert.ok(outcomeLimitations(fm2).some((l) => /indicators/i.test(l)), "the pending indicators are disclosed");
});

test("invalid curriculum identifiers are refused", () => {
  assert.equal(usableOutcome("SCI10-FM9").ok, false, "an invented code");
  assert.equal(usableOutcome("SCI10-FM2").ok, false, "an official code is not a catalog id");
  assert.equal(usableOutcome("").ok, false);
  assert.equal(usableOutcome(42).ok, false);
  assert.equal(usableOutcome("sk-sci10-fm1").ok, false, "in the catalog, but no lesson template yet");
  assert.equal(usableOutcome(FM2, sha256).ok, true);
});

test("missing or unverified sources make an outcome unusable", () => {
  const variant = (change: (j: Jurisdiction[]) => void) => {
    const c = clone(CATALOG);
    change(c);
    return usableOutcome(FM2, sha256, c);
  };
  const fm2 = (c: Jurisdiction[]) => c[0].courses[0].units[0].outcomes[1];
  const cases: [string, (c: Jurisdiction[]) => void, RegExp][] = [
    ["no source URL", (c) => void (c[0].courses[0].source.url = ""), /source URL/],
    ["unofficial source", (c) => void (c[0].courses[0].source.url = "https://example.com/science10"), /not an official/],
    ["no retrieval date", (c) => void (c[0].courses[0].source.retrievedOn = ""), /retrieval date/],
    ["not checked against the source", (c) => void (fm2(c).status = "unverified"), /not been checked/],
    ["wording altered after fingerprinting", (c) => void (fm2(c).statement += " Extra."), /no longer matches/],
    ["unverified indicator", (c) => {
      fm2(c).indicatorsStatus = "verified";
      fm2(c).indicators = [{ id: "x", label: "a", text: "invented", status: "unverified" }];
    }, /indicator that is not verified/],
  ];
  for (const [name, change, why] of cases) {
    const res = variant(change);
    assert.equal(res.ok, false, name);
    if (!res.ok) assert.match(res.reason, why, name);
  }
});

test("AI blocks that cite an unsupplied outcome or indicator are rejected", () => {
  const good = (overrides: Record<string, unknown> = {}) => ({
    blocks: [
      {
        kind: "objective",
        title: "Goal",
        body: "Text",
        secondLook: "Other",
        teaches: "t",
        evidence: "e",
        outcomeIds: [FM2],
        indicatorIds: [],
        motion: null,
        items: [{ prompt: "Q?", options: ["a", "b", "c", "d"], correctIndex: 0, hints: ["h"], whyCorrect: "w", fact: null }],
        ...overrides,
      },
    ],
  });
  const opts = { allowedOutcomeIds: [FM2], allowedIndicatorIds: [], kinds: ["objective" as const] };
  assert.equal(validateCurriculumBlocks(good(), opts)[0].outcomeIds[0], FM2);
  assert.throws(() => validateCurriculumBlocks(good({ outcomeIds: ["SCI10-FM9"] }), opts), /not an outcome the application supplied/);
  assert.throws(() => validateCurriculumBlocks(good({ outcomeIds: [] }), opts), /cites no outcome/);
  assert.throws(() => validateCurriculumBlocks(good({ indicatorIds: ["FM2.a"] }), opts), /not verified/);
});

/* ---------- lesson structure ---------- */

test("incorrect lesson structure is refused, from the AI and at publishing", () => {
  const kinds = ["objective", "explanation", "graph", "prediction", "assessment"] as const;
  const opts = { allowedOutcomeIds: [FM2], allowedIndicatorIds: [], kinds };
  assert.throws(() => validateCurriculumBlocks({ blocks: [] }, opts), /Expected 5 block/);
  const wrongOrder = { blocks: kinds.map((_, i) => ({ kind: kinds[(i + 1) % 5] })) };
  assert.throws(() => validateCurriculumBlocks(wrongOrder, opts), /should be "objective"/);

  const blocks = sci10Fm2Template();
  const graph = blocks.find((b) => b.kind === "graph")!;
  const oneObject = { ...graph, motion: { ...graph.motion!, objects: [graph.motion!.objects[0]] } };
  assert.equal(checkBlock(oneObject, ctx, meta).structuralOk, false, "a comparison graph needs two objects");
  const assessment = blocks.find((b) => b.kind === "assessment")!;
  assert.equal(checkBlock({ ...assessment, items: assessment.items.slice(0, 1) }, ctx, meta).structuralOk, false, "an assessment needs 2 to 4 questions");

  // A lesson whose graph block was rejected cannot be published, even if everything else is approved.
  const noGraph = lesson(blocks.map(approve), (b) => (b.kind === "graph" ? "removed" : "approved"));
  assert.equal(canPublish(noGraph), false);
  assert.ok(curriculumProblems(noGraph).some((p) => /interactive distance-time graph/.test(p)));
});

test("the template builds valid, registered visualizations whose answers are recomputed", () => {
  const blocks = sci10Fm2Template();
  for (const b of blocks.filter((x) => x.kind === "graph" || x.kind === "prediction")) {
    const viz = motionVisualization(b);
    assert.ok(viz, `${b.kind} builds a graph`);
    assert.ok(validateVisualization(viz), `${b.kind} passes the registry`);
  }
  for (const b of blocks) {
    const r = checkBlock(b, ctx, meta);
    assert.equal(r.structuralOk, true, `${b.kind}: ${r.structural.filter((c) => !c.ok).map((c) => c.detail).join("; ")}`);
    assert.notEqual(r.factualSummary, "failed", `${b.kind}: ${r.factual.filter((c) => !c.ok).map((c) => c.detail).join("; ")}`);
  }
  const prediction = motionVisualization(blocks.find((b) => b.kind === "prediction")!)!;
  assert.equal(prediction.type, "function-graph");
  if (prediction.type === "function-graph") {
    const cp = prediction.params.checkpoints[0];
    assert.equal(cp.options.find((o) => o.id === cp.correctId)?.text, "15 m", "3 m/s for 5 s");
  }
});

/* ---------- factual checks ---------- */

test("failed factual checks block approval", () => {
  const blocks = sci10Fm2Template();
  const prediction = blocks.find((b) => b.kind === "prediction")!;
  const wrongKey = acknowledge({ ...prediction, items: [{ ...prediction.items[0], correctOptionId: "a" }] }); // "8 m"
  const r1 = checkBlock(wrongKey, ctx, meta);
  assert.equal(r1.factualSummary, "failed");
  assert.ok(r1.approvalProblems.some((p) => /15 m/.test(p)), "says what the right value is");

  const twoRight = { ...prediction, items: [{ ...prediction.items[0], options: prediction.items[0].options.map((o) => (o.id === "a" ? { ...o, text: "15.0 m" } : o)) }] };
  assert.equal(checkBlock(twoRight, ctx, meta).factualSummary, "failed", "a distractor with the right value");

  const graph = blocks.find((b) => b.kind === "graph")!;
  const slowerMarked = { ...graph, items: [{ ...graph.items[0], correctOptionId: "b" }] };
  assert.equal(checkBlock(slowerMarked, ctx, meta).factualSummary, "failed", "marking Ben as faster");

  const swapped = { ...graph, motion: { ...graph.motion!, objects: [{ label: "Ava", speed: 1 }, { label: "Ben", speed: 5 }] } };
  assert.equal(checkBlock(swapped, ctx, meta).factualSummary, "failed", "changing the speeds re-runs the check");

  const objective = blocks.find((b) => b.kind === "objective")!;
  const r2 = checkBlock(objective, ctx, meta);
  assert.equal(r2.factualSummary, "not-checkable");
  assert.ok(r2.judgments.some((j) => j.id === "answer-q1"), "an uncheckable answer becomes a teacher judgment");
});

/* ---------- approval transitions ---------- */

test("approval needs passing checks and confirmed judgments, and any material edit voids it", () => {
  const block = sci10Fm2Template().find((b) => b.kind === "explanation")!;
  assert.ok(checkBlock(block, ctx, meta).approvalProblems.some((p) => /judgment/.test(p)), "unconfirmed judgments block approval");
  const confirmed = acknowledge(block);
  assert.deepEqual(checkBlock(confirmed, ctx, meta).approvalProblems, []);

  const edited = { ...confirmed, body: `${confirmed.body} More.` };
  const r = checkBlock(edited, ctx, meta);
  assert.equal(r.acknowledged.length, 0, "confirmations were for the old content");
  assert.equal(r.acknowledgementsCleared, true);
  assert.notEqual(r.fingerprint, checkBlock(confirmed, ctx, meta).fingerprint);

  // On the server: an approved block whose content no longer matches its approval goes back to review.
  const ok = approve(block);
  const tampered = { ...ok, body: "Changed after approval." };
  const saved = sanitizeRecord(record([lesson([ok, tampered], () => "approved")].map((l) => ({ ...l, concepts: [draftFromBlock(ok, "approved"), draftFromBlock({ ...tampered, id: "b-other" }, "approved")] }))), stored, NOW);
  const [kept, reset] = saved.lectures[0].concepts;
  assert.equal(kept.review, "approved", "an unchanged approval stands");
  assert.equal(reset.review, "pending", "a changed block loses its approval");
  assert.equal(reset.block?.approvedFingerprint, null);
});

test("the server takes the outcome from the catalog, not from the browser", () => {
  const l = approvedLesson();
  const sent = { ...l, curriculum: { ...meta, statement: "Something the browser made up.", code: "SCI10-FAKE" } };
  const saved = sanitizeRecord(record([sent]), stored, NOW).lectures[0];
  assert.equal(saved.curriculum?.code, "SCI10-FM2");
  assert.equal(saved.curriculum?.statement, meta.statement);

  const unknown = { ...l, curriculum: { ...meta, outcomeId: "sk-sci10-fm9" } };
  const lost = sanitizeRecord(record([unknown]), stored, NOW).lectures[0];
  assert.equal(lost.curriculum, undefined);
  assert.ok(lost.concepts.every((c) => c.review === "pending"), "without a valid outcome no block stays approved");
  assert.equal(canPublish(lost), false);
});

/* ---------- publishing ---------- */

test("publishing restrictions: only a fully approved, checked lesson, and only its exact approved content", () => {
  const draft = lesson(sci10Fm2Template());
  assert.equal(canPublish(draft), false, "nothing approved");

  const ready = approvedLesson();
  assert.deepEqual(curriculumProblems(ready), []);
  assert.equal(canPublish(ready), true);

  const published = publishLecture(ready, NOW);
  assert.deepEqual(publishingProblems(record([ready]), record([published])), [], "a proper publish is accepted");
  assert.equal(lectureState(published), "published");
  assert.equal(approvedConcepts(ready).length, 7, "5 blocks, the assessment expanded into 3 questions");

  const forged = { ...published, published: { ...published.published!, concepts: published.published!.concepts.map((c) => ({ ...c, explanation: "Unreviewed text" })) } };
  assert.match(publishingProblems(record([ready]), record([forged]))[0], /exactly its approved content/);

  const notReady = { ...draft, published: { at: NOW, title: draft.title, concepts: blockConcepts(sci10Fm2Template()[0]) } };
  assert.match(publishingProblems(record([draft]), record([notReady]))[0], /cannot be published/);

  // Students see the snapshot only: no blocks, review flags, judgments or drafts.
  const view = publicView(record([published, draft]));
  assert.equal(view.lectures.length, 1);
  assert.equal(view.lectures[0].outcome?.code, "SCI10-FM2");
  const json = JSON.stringify(view);
  for (const leak of ['"block"', '"review"', "approvedFingerprint", "acknowledged", "teaches"]) assert.ok(!json.includes(leak), leak);
  assert.ok(view.lectures[0].concepts.some((c) => c.visualization?.type === "function-graph"), "the interactive graph reaches students");
});

/* ---------- university compatibility ---------- */

test("university lectures keep working exactly as before", () => {
  const concept: DraftConcept = {
    id: "1-tcp",
    title: "TCP",
    explanation: "TCP numbers bytes.",
    alternateExplanation: "Page numbers.",
    question: { kind: "mcq", prompt: "Why?", options: [{ id: "a", text: "Order" }, { id: "b", text: "Speed" }], correctOptionId: "a" },
    whyCorrect: "Order.",
    hints: ["Think."],
    review: "approved",
  };
  const lecture: Lecture = { id: "tcp-1", title: "TCP", fileName: "tcp.pdf", draftedBy: "ai", objectives: [], concepts: [concept], createdAt: NOW, updatedAt: NOW, published: null };
  const saved = sanitizeRecord(record([lecture]), stored, NOW).lectures[0];
  assert.equal(saved.curriculum, undefined);
  assert.equal(saved.concepts[0].review, "approved");
  assert.equal(canPublish(saved), true);
  assert.deepEqual(curriculumProblems(saved), []);
  const published = publishLecture(saved, NOW);
  assert.deepEqual(publishingProblems(record([saved]), record([published])), []);
  assert.equal(publicView(record([published])).lectures[0].outcome, undefined);
  assert.equal(lectureState(published), "published");
});
