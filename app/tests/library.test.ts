import assert from "node:assert/strict";
import { test } from "node:test";
import { loadDataset } from "@/lib/curriculum/dataset";
import {
  draftAfter,
  filterFromParams,
  filterRows,
  filterToQuery,
  groupByCourse,
  historyOf,
  kindCounts,
  latestApproved,
  partPrefix,
  questionsToRetire,
  questionNumbers,
  shortDate,
  splitMaterials,
  textBlocks,
  type LibraryRow,
  type VersionMeta,
} from "@/lib/library/model";
import { fromBank } from "@/lib/resources/assemble";
import { defaultBrief } from "@/lib/resources/kinds";
import { studentCopy } from "@/lib/resources/student-copy";
import { toStoredContent } from "@/lib/resources/stored";
import type { Resource, Section } from "@/lib/resources/types";

loadDataset();

const FM2 = "sk-63-110477";
const R1 = "6f1f2c1e-1111-4a2b-8c3d-0000000000a1";

/* ---------- which version is in the Library ---------- */

const versions: VersionMeta[] = [
  { id: "v1", resourceId: "a", number: 1, approvedAt: "2026-11-20T15:00:00Z" },
  { id: "v2", resourceId: "a", number: 2, approvedAt: "2026-11-22T15:00:00Z" },
  { id: "v3", resourceId: "a", number: 3, approvedAt: null },
  { id: "w1", resourceId: "b", number: 1, approvedAt: null },
];

test("the Library shows each material's latest approved version, and never a draft", () => {
  const latest = latestApproved(versions);
  assert.deepEqual(latest.get("a"), { id: "v2", number: 2, at: "2026-11-22T15:00:00Z" });
  assert.equal(latest.has("b"), false, "a material never approved isn't in the Library");
});

test("a draft started after an approval is numbered one more; none when the current version is the approved one", () => {
  const latest = latestApproved(versions).get("a");
  assert.equal(draftAfter("v3", latest), 3);
  assert.equal(draftAfter("v2", latest), null);
  assert.equal(draftAfter(null, latest), null);
  assert.equal(draftAfter("w1", undefined), null);
});

/* ---------- filters and groups ---------- */

const row = (id: string, kind: LibraryRow["kind"], courseId: string, title: string, at: string): LibraryRow => ({
  id,
  title,
  kind,
  courseId,
  chapterTitles: [],
  approved: { id: `${id}-v1`, number: 1, at },
  approvedOn: shortDate(at),
  draft: null,
  published: false,
});
const rows = [
  row("n1", "notes", "sci", "Acceleration · Teaching notes", "2026-11-21T10:00:00Z"),
  row("q1", "quiz", "sci", "Constant speed · Quiz", "2026-11-23T10:00:00Z"),
  row("e1", "exam", "phy", "Énergie · Exam", "2026-11-22T10:00:00Z"),
  row("s1", "presentation", "sci", "Force and motion · Slides", "2026-11-20T10:00:00Z"),
];
const courses = [
  { id: "phy", title: "Physics 20" },
  { id: "sci", title: "Science 10" },
  { id: "empty", title: "English 10" },
];

test("kind chips show only that kind: Notes shows notes without the quizzes", () => {
  assert.deepEqual(filterRows(rows, { kind: "notes", course: "all", q: "" }).map((r) => r.id), ["n1"]);
  assert.deepEqual(filterRows(rows, { kind: "all", course: "sci", q: "" }).map((r) => r.id), ["n1", "q1", "s1"]);
});

test("search ignores case, accents and word order", () => {
  assert.deepEqual(filterRows(rows, { kind: "all", course: "all", q: "energie" }).map((r) => r.id), ["e1"]);
  assert.deepEqual(filterRows(rows, { kind: "all", course: "all", q: "QUIZ speed" }).map((r) => r.id), ["q1"]);
});

test("chip counts follow the chosen course and search, not the chosen kind", () => {
  const counts = kindCounts(rows, { kind: "quiz", course: "sci", q: "" });
  assert.equal(counts.all, 3);
  assert.equal(counts.notes, 1);
  assert.equal(counts.exam, 0);
});

test("groups follow the teacher's course order, newest approval first, and skip empty courses", () => {
  const groups = groupByCourse(rows, courses);
  assert.deepEqual(groups.map((g) => g.course.id), ["phy", "sci"]);
  assert.deepEqual(groups[1].rows.map((r) => r.id), ["q1", "n1", "s1"]);
});

test("filters round-trip through the address, and unknown values fall back to all", () => {
  const f = filterFromParams({ kind: "quiz", course: "sci", q: "speed" }, courses);
  assert.deepEqual(f, { kind: "quiz", course: "sci", q: "speed" });
  assert.equal(filterToQuery(f), "kind=quiz&course=sci&q=speed");
  assert.deepEqual(filterFromParams({ kind: "lesson-plan", course: "someone-else" }, courses), { kind: "all", course: "all", q: "" });
  assert.equal(filterToQuery({ kind: "all", course: "all", q: "  " }), "");
});

/* ---------- a course's Materials card ---------- */

test("a course's card lists approved materials first, then drafts never approved", () => {
  const m = [
    { id: "draft-only", approved: null },
    { id: "old", approved: { version: 1, at: "2026-11-20T10:00:00Z" } },
    { id: "new", approved: { version: 2, at: "2026-11-23T10:00:00Z" } },
  ];
  const { done, inReview } = splitMaterials(m);
  assert.deepEqual(done.map((x) => x.id), ["new", "old"]);
  assert.deepEqual(inReview.map((x) => x.id), ["draft-only"]);
});

/* ---------- history ---------- */

test("history lists approved versions newest first, the current draft on top, and where each went", () => {
  const h = historyOf(
    versions.filter((v) => v.resourceId === "a"),
    [
      { versionId: "v1", channel: "print", at: "2026-11-20T16:00:00Z" },
      { versionId: "v1", channel: "print", at: "2026-11-21T16:00:00Z" },
      { versionId: "v2", channel: "classroom", at: "2026-11-22T16:00:00Z" },
    ],
    "v3",
  );
  assert.deepEqual(h.map((e) => e.number), [3, 2, 1]);
  assert.equal(h[0].approvedAt, null);
  assert.deepEqual(h[1].posts, [{ channel: "classroom", at: "2026-11-22T16:00:00Z" }]);
  assert.deepEqual(h[2].posts, [{ channel: "print", at: "2026-11-21T16:00:00Z" }], "the latest print, once");
  assert.deepEqual(historyOf(versions.filter((v) => v.resourceId === "a"), [], "v2").map((e) => e.number), [2, 1], "no draft row without a draft");
});

/* ---------- reading a material ---------- */

test("text becomes paragraphs and bullet lists, and slide speaker notes come apart only when asked", () => {
  const body = "Speed is distance over time.\n- d = vt\n- v = d / t\n\nSpeaker notes: Ask who walked here.\nThen show the graph.";
  const teacher = textBlocks(body, true);
  assert.deepEqual(teacher.blocks, [
    { kind: "p", text: "Speed is distance over time." },
    { kind: "ul", items: ["d = vt", "v = d / t"] },
  ]);
  assert.equal(teacher.speakerNotes, "Ask who walked here.\nThen show the graph.");
  const student = textBlocks(body);
  assert.equal(student.speakerNotes, "");
  assert.equal(student.blocks.length, 4, "the student copy keeps every line, as print does");
});

const section = (id: string, title: string, items: number, kind: Section["kind"] = "questions"): Section =>
  ({ id, kind, title, body: "", items: Array.from({ length: items }, (_, i) => ({ id: `${id}-${i}` })), claim: null, outcomeIds: [], verbs: [], origin: "ai", reviewedFp: null }) as unknown as Section;

test("questions are numbered straight through, or per section as the template says, and parts are lettered as printed", () => {
  const s = [section("a", "Multiple choice", 2), section("t", "Read this", 0, "text"), section("b", "Part B: Calculations", 2)];
  assert.deepEqual([...questionNumbers(s, false).values()], [1, 2, 3, 4]);
  assert.deepEqual([...questionNumbers(s, true).values()], [1, 2, 1, 2]);
  assert.equal(partPrefix(s, s[0], true), "Part A: ");
  assert.equal(partPrefix(s, s[2], true), "", "a title that already names its part keeps it");
  assert.equal(partPrefix(s, s[0], false), "", "notes have no parts");
});

test("dates are in Saskatchewan time, so a late approval isn't shown as the next day", () => {
  assert.equal(shortDate("2026-11-24T04:30:00Z"), "Nov 23");
  assert.equal(shortDate("nonsense"), "");
});

/* ---------- printing a chosen version ---------- */

/** A tiny stand-in for the Supabase client: equality filters over in-memory rows. */
function fakeSupabase(tables: Record<string, Record<string, unknown>[]>) {
  const asked: { table: string; filters: [string, unknown][] }[] = [];
  const client = {
    from(table: string) {
      const filters: [string, unknown][] = [];
      asked.push({ table, filters });
      const rowsNow = () => (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => {
          filters.push([k, v]);
          return q;
        },
        maybeSingle: async () => ({ data: rowsNow()[0] ?? null, error: null }),
        single: async () => (rowsNow().length === 1 ? { data: rowsNow()[0], error: null } : { data: null, error: { message: "not one row" } }),
      };
      return q;
    },
  };
  return { client: client as never, asked };
}

function versionContent(title: string) {
  const brief = { ...defaultBrief("quiz", [FM2]), courseId: "c1" };
  const draft = { ...fromBank(brief, R1), title };
  const resource: Resource = { id: R1, kind: "quiz", title, courseName: "Science 10", unitName: "", outcomeIds: [FM2], createdAt: "", updatedAt: "", deliveries: [], brief };
  return toStoredContent(resource, draft);
}

function printDb() {
  return fakeSupabase({
    resources: [{ id: R1, kind: "quiz", title: "Speed quiz (new title)", course_id: "c1", created_at: "", updated_at: "", current_version_id: "ver-3" }],
    resource_versions: [
      { id: "ver-1", resource_id: R1, number: 1, approved_at: "2026-11-20T10:00:00Z", content: versionContent("Speed quiz v1") },
      { id: "ver-2", resource_id: R1, number: 2, approved_at: "2026-11-22T10:00:00Z", content: versionContent("Speed quiz v2") },
      { id: "ver-3", resource_id: R1, number: 3, approved_at: null, content: versionContent("Speed quiz v3 draft") },
    ],
    courses: [{ id: "c1", title: "Science 10" }],
    teachers: [{ id: "t1", school: "" }],
  });
}

test("printing from the Library prints the approved version on screen, even while a newer draft is open", async () => {
  const { client, asked } = printDb();
  const copy = await studentCopy(client, "t1", R1, 1);
  assert.equal(copy.ok, true);
  if (!copy.ok) return;
  assert.equal(copy.version, 1);
  assert.equal(copy.title, "Speed quiz v1");
  assert.ok(asked.some((a) => a.table === "resource_versions" && a.filters.some(([k, v]) => k === "resource_id" && v === R1) && a.filters.some(([k, v]) => k === "number" && v === 1)), "found by its material and number");
});

test("a draft version or a missing one is never printed as a student copy", async () => {
  const draft = await studentCopy(printDb().client, "t1", R1, 3);
  assert.deepEqual(draft.ok ? null : draft.status, 409);
  const missing = await studentCopy(printDb().client, "t1", R1, 9);
  assert.deepEqual(missing.ok ? null : missing.status, 404);
  const current = await studentCopy(printDb().client, "t1", R1);
  assert.deepEqual(current.ok ? null : current.status, 409, "without a number, the current version as before, which is the draft here");
});

/* ---------- deleting a material ---------- */

test("deleting a material retires the questions only it used, once each; questions another material uses stay active", () => {
  assert.deepEqual(questionsToRetire(["q1", "q2", "q2", "q3"], ["q3"]), ["q1", "q2"]);
  assert.deepEqual(questionsToRetire([], []), []);
  assert.deepEqual(questionsToRetire(["q1"], ["q1", "q1"]), []);
});

