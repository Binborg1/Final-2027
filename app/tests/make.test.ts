import assert from "node:assert/strict";
import { test } from "node:test";
import type { CatalogCourse, CatalogOutcome } from "@/lib/curriculum/catalog";
import { chaptersFor, composeInstructions } from "@/lib/make/chapters";
import { storageKeyFor } from "@/lib/resources/storage-key";

const outcome = (id: string, level: number | null): CatalogOutcome =>
  ({ id, code: id.toUpperCase(), statement: `Statement ${id}`, fingerprint: "", status: "imported", checkedOn: "", method: "", secondCheck: "pending", indicators: [], indicatorsStatus: "pending", lessonTemplate: null, level }) as CatalogOutcome;

const course = (units: CatalogCourse["units"]): CatalogCourse => ({ id: "sk-1", name: "Course", grade: 10, source: { url: "", publisher: "", retrievedOn: "", versionLabel: null, reuseTerms: null }, units });

test("chapters are the curriculum units at the course's level", () => {
  const c = course([
    { id: "sk-1-u1", name: "Motion", level: 20, outcomes: [outcome("a", 20), outcome("b", 20)] },
    { id: "sk-1-u2", name: "Energy", level: 30, outcomes: [outcome("c", 30)] },
    { id: "sk-1-u3", name: "Skills", outcomes: [outcome("d", null)] },
  ]);
  const at20 = chaptersFor(c, 20);
  assert.equal(at20.mode, "units");
  assert.deepEqual(at20.mode === "units" && at20.chapters.map((ch) => `${ch.name}:${ch.outcomes.map((o) => o.id).join("")}`), ["Motion:ab", "Skills:d"], "Energy is level 30; Skills applies to every level");
});

test("courses without units show their outcomes instead of chapters", () => {
  const c = course([
    { id: "sk-1-l20", name: "20-level outcomes", level: 20, outcomes: [outcome("a", 20)] },
    { id: "sk-1-l30", name: "30-level outcomes", level: 30, outcomes: [outcome("b", 30)] },
  ]);
  const r = chaptersFor(c, 30);
  assert.equal(r.mode, "outcomes");
  assert.deepEqual(r.mode === "outcomes" && r.outcomes.map((o) => o.id), ["b"]);
});

test("quick prompts add fixed phrases to the request, within the server's limit", () => {
  assert.equal(composeInstructions(" A unit test on motion ", ["sk", "notricks", "notes"]), "A unit test on motion Use Saskatchewan places and contexts in examples. Avoid trick questions and double negatives.");
  assert.equal(composeInstructions("x".repeat(700), []).length, 600);
  assert.equal(composeInstructions("", []), "");
});

test("drafts are kept per teacher in this browser", () => {
  assert.equal(storageKeyFor("teacher-a"), "funza.workspace.v1:teacher-a");
  assert.notEqual(storageKeyFor("teacher-a"), storageKeyFor("teacher-b"));
});
