import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { CATALOG, findOutcome, outcomeLimitations, outcomeProblems, usableOutcome, type Jurisdiction } from "@/lib/curriculum/catalog";
import { COURSES, STAGED_INDICATORS } from "@/lib/curriculum/sources";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const FM2 = "sk-sci10-fm2";
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

test("staged indicators and the course list stay outside the verified catalog", () => {
  assert.equal(findOutcome(FM2)!.outcome.indicators.length, 0, "staged indicators never enter the catalog");
  assert.ok(STAGED_INDICATORS[FM2].items.some((i) => i.text === null), "uncaptured wording is shown as missing, not filled in");
  assert.equal(COURSES.filter((c) => c.catalogId).length, 1, "only Science 10 has catalog content");
  for (const c of COURSES) assert.equal(c.grade, c.level === 10 ? 10 : c.level === 20 ? 11 : 12, c.name);
});
