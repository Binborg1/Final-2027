import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CATALOG, findOutcome, outcomeLimitations, usableOutcome, type Jurisdiction } from "@/lib/curriculum/catalog";
import { loadDataset } from "@/lib/curriculum/dataset";
import { toCatalogCourse, type Dataset } from "@/lib/curriculum/imported";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const FM2 = "sk-63-110477";
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const data = JSON.parse(readFileSync("src/data/curriculum/sk.json", "utf8")) as Dataset;
const science10: Jurisdiction[] = [{ id: "sk", name: "Saskatchewan", courses: [toCatalogCourse(data.courses.find((c) => c.curriculumId === 63)!, data.importedOn)] }];

/* ---------- catalog ---------- */

test("Science 10 comes from the import, with its official wording and indicators", () => {
  loadDataset();
  const fm2 = findOutcome(FM2)!;
  assert.equal(fm2.outcome.code, "SCI10-FM2");
  assert.equal(fm2.outcome.statement, "Investigate and represent the motion of objects that travel at a constant speed in a straight line.");
  assert.equal(fm2.outcome.status, "cross-checked", "the Ministry's CSV has the same words");
  assert.equal(fm2.outcome.indicatorsStatus, "imported");
  assert.ok(fm2.outcome.indicators.length >= 8);
  assert.ok(outcomeLimitations(fm2).some((l) => /automatically/.test(l)), "the automatic copy is disclosed");
});

test("invalid curriculum identifiers are refused", () => {
  loadDataset();
  assert.equal(usableOutcome("SCI10-FM9").ok, false, "an invented code");
  assert.equal(usableOutcome("SCI10-FM2").ok, false, "an official code is not a catalog id");
  assert.equal(usableOutcome("").ok, false);
  assert.equal(usableOutcome(42).ok, false);
  assert.equal(usableOutcome(FM2, sha256).ok, true);
});

test("missing or unverified sources make an outcome unusable", () => {
  const variant = (change: (j: Jurisdiction[]) => void) => {
    const c = clone(science10);
    change(c);
    return usableOutcome(FM2, sha256, c);
  };
  const fm2 = (c: Jurisdiction[]) => c[0].courses[0].units.flatMap((u) => u.outcomes).find((o) => o.id === FM2)!;
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
  assert.equal(usableOutcome(FM2, sha256, science10).ok, true, "unchanged, it is usable");
  for (const [name, change, why] of cases) {
    const res = variant(change);
    assert.equal(res.ok, false, name);
    if (!res.ok) assert.match(res.reason, why, name);
  }
});

test("no outcome is copied by hand any more: every course comes from the import", () => {
  assert.equal(CATALOG.flatMap((j) => j.courses).length, 0);
});
