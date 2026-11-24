import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { atLevel, chapterSeeds, outcomeTitle } from "@/lib/courses/seed";
import { addCourseSchema, moved } from "@/lib/courses/model";
import type { Dataset, DatasetCourse } from "@/lib/curriculum/imported";
import { fromBank } from "@/lib/resources/assemble";
import { bankRowsFor } from "@/lib/resources/bank-rows";
import { approvalBlockers, computeChecks, itemFp } from "@/lib/resources/checks";
import { defaultBrief } from "@/lib/resources/kinds";
import { sanitizeBrief } from "@/lib/resources/sanitize";
import { readStoredContent, toStoredContent } from "@/lib/resources/stored";
import type { Draft, Item, Resource } from "@/lib/resources/types";
import { loadDataset } from "@/lib/curriculum/dataset";

// Outcomes come from the imported dataset, as on the server.
loadDataset();

const dataset = JSON.parse(readFileSync("src/data/curriculum/sk.json", "utf8")) as Dataset;
const course = (name: string): DatasetCourse => {
  const c = dataset.courses.find((x) => x.name === name);
  assert.ok(c, `${name} is in the dataset`);
  return c;
};

/* ---------- chapters from the curriculum ---------- */

test("a course with units gets one chapter per unit, with the dataset's outcome ids", () => {
  const sci = course("Science 10");
  const seeds = chapterSeeds(sci, 10);
  assert.equal(seeds.length, 4);
  assert.deepEqual(seeds.map((s) => s.position), [0, 1, 2, 3]);
  assert.ok(seeds.every((s) => s.source_kind === "unit" && s.source_ref?.startsWith("sk-63-u")));
  const fm = seeds.find((s) => s.title === "Force and Motion in Our World");
  assert.ok(fm, "the Force and Motion unit is a chapter");
  assert.ok(fm.outcome_refs.includes("sk-63-110477"), "SCI10-FM2 is in Force and Motion");
  assert.equal(seeds.reduce((n, s) => n + s.outcome_refs.length, 0), 13, "every Science 10 outcome is in a chapter");
});

test("Practical and Applied Arts courses get one chapter per module", () => {
  const seeds = chapterSeeds(course("Accounting 10, 20, 30"), 10);
  assert.ok(seeds.length > 5);
  assert.ok(seeds.every((s) => s.source_kind === "module" && s.outcome_refs.length === 1 && s.source_ref === s.outcome_refs[0]));
  assert.match(seeds[0].title, /^Module /);
});

test("courses with outcomes but no units (Mathematics) get one chapter per outcome", () => {
  const seeds = chapterSeeds(course("Workplace and Apprenticeship Mathematics 10"), 10);
  assert.ok(seeds.length >= 5);
  assert.ok(seeds.every((s) => s.source_kind === "outcome" && s.outcome_refs.length === 1));
  assert.ok(seeds.every((s) => s.title.length <= 90));
});

test("courses without web outcomes get chapters from their curriculum document, or one empty chapter", () => {
  const history = chapterSeeds(course("History 30: Canadian Studies"), 30);
  assert.ok(history.length > 0);
  assert.ok(history.every((s) => s.source_kind === "custom" && s.source_ref === null && s.outcome_refs.length === 0));
  assert.deepEqual(chapterSeeds({ units: [], outcomes: [], document: undefined }, 10).map((s) => s.title), ["Chapter 1"]);
});

test("an outcome belongs to a level by its levels, its level, or to every level when it has neither", () => {
  assert.equal(atLevel({ level: 20, levels: undefined }, 20), true);
  assert.equal(atLevel({ level: 20, levels: undefined }, 30), false);
  assert.equal(atLevel({ level: null, levels: [] }, 30), true);
  assert.equal(atLevel({ level: null, levels: [10, 20] }, 30), false);
});

test("long outcome titles are cut at a word", () => {
  const t = outcomeTitle({ code: "P20.1", statement: "Demonstrate understanding of absolute value of real numbers and solve problems that involve absolute value in many different contexts", title: undefined });
  assert.ok(t.length <= 90);
  assert.match(t, /^P20\.1: Demonstrate/);
  assert.match(t, /…$/);
});

test("moving a chapter swaps it with its neighbour, and can't go past either end", () => {
  assert.deepEqual(moved(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moved(["a", "b", "c"], "b", 1), ["a", "c", "b"]);
  assert.equal(moved(["a", "b"], "a", -1), null);
  assert.equal(moved(["a", "b"], "b", 1), null);
  assert.equal(moved(["a"], "x", 1), null);
});

test("a new course is a curriculum course at a real level, or a named course of the teacher's own", () => {
  assert.equal(addCourseSchema.safeParse({ curriculumCourseId: "sk-63", level: 10 }).success, true);
  assert.equal(addCourseSchema.safeParse({ curriculumCourseId: "sk-63", level: 11 }).success, false);
  assert.equal(addCourseSchema.safeParse({ title: "  Science 10, period 2 " }).success, true);
  assert.equal(addCourseSchema.safeParse({ title: "   " }).success, false);
});

/* ---------- the question bank ---------- */

const FM2 = "sk-63-110477";
const FM3 = "sk-63-110487";
const fakeHash = (text: string) => `h${text.length}:${text.slice(0, 40)}`;

test("approving copies each question into the chapter that holds its outcome, with its answer key", () => {
  const draft = fromBank(defaultBrief("quiz", [FM2, FM3]), "r-bank");
  const chapters = [
    { id: "ch-other", outcomeRefs: ["sk-63-110470"] },
    { id: "ch-fm2", outcomeRefs: [FM2] },
    { id: "ch-fm3", outcomeRefs: [FM3] },
  ];
  const rows = bankRowsFor(draft, chapters, fakeHash);
  const items = draft.sections.flatMap((s) => s.items);
  assert.equal(rows.length, items.length);
  assert.deepEqual(rows.map((r) => r.position), rows.map((_, i) => i + 1));
  for (const r of rows) assert.equal(r.chapter_id, r.outcome_ref === FM3 ? "ch-fm3" : "ch-fm2");
  const mcq = rows.find((r) => r.type === "mcq")!;
  assert.ok(mcq.options && mcq.options.length > 1);
  assert.ok(typeof mcq.answer.correctId === "string");
  const tf = rows.find((r) => r.type === "tf");
  if (tf) assert.equal(typeof tf.answer.tf, "boolean");
  assert.equal(bankRowsFor(draft, [], fakeHash).length, 0, "no chapter, no bank rows");
});

test("a question's bank fingerprint ignores its marks, so a re-marked question isn't copied again", () => {
  const draft = fromBank(defaultBrief("quiz", [FM2]), "r-fp");
  const remarked: Draft = { ...draft, sections: draft.sections.map((s) => ({ ...s, items: s.items.map((i: Item) => ({ ...i, marks: i.marks + 1 })) })) };
  const ch = [{ id: "ch", outcomeRefs: [FM2] }];
  assert.deepEqual(bankRowsFor(remarked, ch, fakeHash).map((r) => r.fingerprint), bankRowsFor(draft, ch, fakeHash).map((r) => r.fingerprint));
  const reworded: Draft = { ...draft, sections: draft.sections.map((s, si) => ({ ...s, items: s.items.map((i, ii) => (si === 0 && ii === 0 ? { ...i, prompt: `${i.prompt} (changed)` } : i)) })) };
  assert.notEqual(bankRowsFor(reworded, ch, fakeHash)[0].fingerprint, bankRowsFor(draft, ch, fakeHash)[0].fingerprint);
});

test("notes without questions add nothing to the bank", () => {
  const notes = fromBank({ ...defaultBrief("notes", [FM2]), checkQuestions: false }, "r-notes");
  assert.equal(bankRowsFor(notes, [{ id: "ch", outcomeRefs: [FM2] }], fakeHash).length, 0);
});

/* ---------- drafts as stored versions ---------- */

function storedPair(): { resource: Resource; draft: Draft } {
  const brief = { ...defaultBrief("quiz", [FM2]), courseId: "6f1f2c1e-1111-4a2b-8c3d-000000000001", chapterIds: ["6f1f2c1e-1111-4a2b-8c3d-000000000002"], material: { name: "notes.pdf", use: "source" as const, text: "secret notes" } };
  const draft = fromBank(brief, "6f1f2c1e-1111-4a2b-8c3d-0000000000aa");
  const resource: Resource = { id: draft.resourceId, kind: "quiz", title: draft.title, courseName: "Science 10", unitName: "Force and Motion in Our World", outcomeIds: [FM2], createdAt: "", updatedAt: "", deliveries: [], brief };
  return { resource, draft };
}

test("a stored version never keeps the attached file's text", () => {
  const { resource, draft } = storedPair();
  const stored = toStoredContent(resource, draft);
  assert.equal(stored.resource.brief.material?.text, "");
  assert.equal(stored.resource.brief.material?.name, "notes.pdf");
});

test("reading a version back takes the version number and approval from the database row", () => {
  const { resource, draft } = storedPair();
  const content = toStoredContent(resource, { ...draft, version: 7, status: "approved" });
  const row = { id: resource.id, kind: "quiz", title: "Motion quiz", created_at: "2026-11-23T01:00:00Z", updated_at: "2026-11-23T02:00:00Z" };
  const asDraft = readStoredContent(row, { number: 2, approved_at: null, content });
  assert.ok(asDraft);
  assert.equal(asDraft.draft.version, 2);
  assert.equal(asDraft.draft.status, "draft");
  assert.equal(asDraft.resource.title, "Motion quiz");
  assert.equal(asDraft.resource.brief.courseId, "6f1f2c1e-1111-4a2b-8c3d-000000000001");
  const asApproved = readStoredContent(row, { number: 2, approved_at: "2026-11-23T03:00:00Z", content });
  assert.equal(asApproved?.draft.status, "approved");
  assert.equal(asApproved?.draft.approved?.version, 2);
  assert.equal(readStoredContent({ ...row, kind: "exam" }, { number: 1, approved_at: null, content }), null, "a kind that doesn't match the row is refused");
  assert.equal(readStoredContent(row, { number: 1, approved_at: null, content: "nonsense" }), null);
});

test("the server's approval check refuses a stored draft nobody has reviewed", () => {
  const { resource, draft } = storedPair();
  const row = { id: resource.id, kind: "quiz", title: draft.title, created_at: "", updated_at: "" };
  const fresh = readStoredContent(row, { number: 1, approved_at: null, content: toStoredContent(resource, draft) })!;
  assert.ok(approvalBlockers(computeChecks(fresh.draft)).length > 0);
  const reviewed: Draft = { ...fresh.draft, sections: fresh.draft.sections.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i, reviewedFp: itemFp(i) })) })), globals: { readingLevel: true, indicatorsPending: true } };
  const again = readStoredContent(row, { number: 1, approved_at: null, content: toStoredContent(resource, reviewed) })!;
  assert.deepEqual(approvalBlockers(computeChecks(again.draft)), []);
});

test("the brief keeps only real database ids for its course and chapters", () => {
  const b = sanitizeBrief({ ...defaultBrief("quiz", [FM2]), courseId: "6F1F2C1E-1111-4A2B-8C3D-000000000001", chapterIds: ["6f1f2c1e-1111-4a2b-8c3d-000000000002", "6f1f2c1e-1111-4a2b-8c3d-000000000002", "not-an-id", 42] });
  assert.ok(b);
  assert.equal(b.courseId, "6f1f2c1e-1111-4a2b-8c3d-000000000001");
  assert.deepEqual(b.chapterIds, ["6f1f2c1e-1111-4a2b-8c3d-000000000002"]);
  assert.equal(sanitizeBrief({ ...defaultBrief("quiz", [FM2]), courseId: "sk-63" })?.courseId, null);
});
