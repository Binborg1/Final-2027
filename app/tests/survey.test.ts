import assert from "node:assert/strict";
import { test } from "node:test";
import { RANK_OPTIONS, sanitizeAnswers, sanitizeParticipant, SURVEY, surveyColumns, susScore, toCsv } from "@/lib/survey/questionnaire";

const full = {
  A1: "SSE year 3",
  A2: ["Re-read the slides", "Something else entirely"],
  A3: "Sometimes",
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`B${i + 1}`, i % 2 === 0 ? 5 : 1])),
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`C${i + 1}`, 4])),
  D: { "0": 1, "1": 5, "2": 2, "3": 3, "4": 4 },
  E1: "The demo stopped and I did not know why.",
  E5: "No",
  E6: "promising",
};

test("the survey matches the paper questionnaire item for item", () => {
  const ids = SURVEY.flatMap((s) => s.items.map((i) => i.id));
  assert.deepEqual(ids.slice(0, 3), ["A1", "A2", "A3"]);
  assert.equal(ids.filter((i) => i.startsWith("B")).length, 10);
  assert.equal(ids.filter((i) => i.startsWith("C")).length, 12);
  assert.deepEqual(ids.slice(-6), ["E1", "E2", "E3", "E4", "E5", "E6"]);
  assert.equal(RANK_OPTIONS.length, 5);
});

test("a full submission is kept, with free text capped and choices checked", () => {
  const a = sanitizeAnswers(full)!;
  assert.equal(a.A1, "SSE year 3");
  assert.deepEqual(a.A2, ["Re-read the slides", "Something else entirely"], "A2 allows an 'other' answer");
  assert.equal(a.A3, "Sometimes");
  assert.equal(a.B2, 1);
  assert.deepEqual(a.D, { "0": 1, "1": 5, "2": 2, "3": 3, "4": 4 });
  assert.equal(a.E5, "No");
  const long = sanitizeAnswers({ E1: "x".repeat(5000), A1: "y".repeat(500) })!;
  assert.equal((long.E1 as string).length, 2000);
  assert.equal((long.A1 as string).length, 200);
});

test("malformed or hostile values are dropped, never stored", () => {
  assert.equal(sanitizeAnswers(null), null);
  assert.equal(sanitizeAnswers("B1=5"), null);
  assert.equal(sanitizeAnswers({ Z9: "nope", __proto__: { polluted: true } }), null);
  const a = sanitizeAnswers({ B1: 9, B2: "3", B3: "three", A3: "Always, constantly", C1: [1, 2], D: { "7": 1, "0": 9, "1": "2" } })!;
  assert.equal(a.B1, undefined, "out of range Likert dropped");
  assert.equal(a.B2, 3, "numeric strings accepted");
  assert.equal(a.B3, undefined);
  assert.equal(a.A3, undefined, "a choice that is not an option, with no 'other', is dropped");
  assert.equal(a.C1, undefined);
  assert.deepEqual(a.D, { "1": 2 }, "only valid option indexes and ranks survive");
  assert.equal(sanitizeParticipant(123), "");
  assert.equal(sanitizeParticipant("  P3  "), "P3");
});

test("SUS is scored the standard way and left blank when incomplete", () => {
  assert.equal(susScore(sanitizeAnswers(full)!), 100, "all odd items 5 and even items 1 is the best possible score");
  const middling = sanitizeAnswers(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`B${i + 1}`, 3])))!;
  assert.equal(susScore(middling), 50);
  assert.equal(susScore(sanitizeAnswers({ B1: 5 })!), null);
});

test("the CSV has one column per item, ranks spread out, and quotes what needs quoting", () => {
  const cols = surveyColumns();
  assert.deepEqual(cols.slice(0, 4), ["id", "submittedAt", "participant", "sus"]);
  assert.ok(cols.includes("D_rank_1") && cols.includes("D_rank_5") && !cols.includes("D"));
  const csv = toCsv([{ id: "r1", submittedAt: "2026-10-20T15:00:00.000Z", participant: "P1", answers: sanitizeAnswers({ ...full, E1: 'She said "no", then left' })! }]);
  const [header, row] = csv.split("\r\n");
  assert.equal(header.split(",").length, cols.length);
  assert.ok(row.startsWith("r1,2026-10-20T15:00:00.000Z,P1,100,SSE year 3,Re-read the slides; Something else entirely,Sometimes,5,1"));
  assert.ok(row.includes('"She said ""no"", then left"'));
  assert.ok(row.includes(",1,5,2,3,4,"), "rank columns in option order");
});
