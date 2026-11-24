import assert from "node:assert/strict";
import { test } from "node:test";
import { keyNumbers, markExact, verdict } from "@/lib/live/mark";
import { numberHint, parseStudentNumber } from "@/lib/live/number";
import { contentFromBank, displayKey, displayResponse, parseContent, parseResponse, publicQuestion, unitOf } from "@/lib/live/questions";
import { CALC, MCQ, SHORT, TF } from "./helpers/live-fixtures";

/*
 * Development step 5: exact marking. Multiple choice, true or false and numbers
 * are marked in code; a typed number is read strictly (no expressions, no commas)
 * and compared with a tolerance.
 */

test("a student's number is read strictly", () => {
  const ok = (text: string, unit: string, value: number) => {
    const r = parseStudentNumber(text, unit);
    assert.ok(r.ok, `${JSON.stringify(text)} should be read`);
    assert.ok(Math.abs(r.value - value) < 1e-9, `${JSON.stringify(text)} → ${r.value}, expected ${value}`);
  };
  const bad = (text: string, unit: string, reason: string) => assert.deepEqual(parseStudentNumber(text, unit), { ok: false, reason }, JSON.stringify(text));

  ok("13.3", "min", 13.3);
  ok("+4", "", 4);
  ok("-4", "", -4);
  ok("−4", "", -4);
  ok(".5", "", 0.5);
  ok("5.", "", 5);
  ok("12 500", "", 12500);
  ok("1.5e3", "", 1500);
  ok("1.5×10^3", "", 1500);
  ok("1.5 x 10^3", "", 1500);
  ok("2.5 × 10^-3", "", 0.0025);
  ok("13.3 min", "min", 13.3);
  ok("13.3min", "min", 13.3);
  ok("80 KM/H", "km/h", 80);
  ok("4 m/s", "m/s", 4);
  ok("9.8 m/s²", "m/s^2", 9.8);
  ok("50%", "%", 50);
  ok("  42  ", "", 42);

  bad("", "", "empty");
  bad("   ", "", "empty");
  bad("1,5", "", "comma");
  bad("1,500", "", "comma");
  bad("12 or 13", "", "format");
  bad("1/2", "", "format");
  bad("sqrt(50)", "", "format");
  bad("1.2.3", "", "format");
  bad("--5", "", "format");
  bad("1 2", "", "format");
  bad("1234 567", "", "format");
  bad("2^10", "", "format");
  bad("13.3 s", "min", "unit");
  bad("4 m/s", "", "unit");
  bad("1e20", "", "range");
});

test("a phone explains a number it can't read", () => {
  assert.match(numberHint("comma"), /point/);
  assert.match(numberHint("unit", "km/h"), /km\/h/);
  assert.equal(numberHint("empty"), "");
});

test("a number question's unit comes from its calculation, else from the key", () => {
  assert.equal(unitOf(CALC), "km/h");
  assert.equal(unitOf({ ...CALC, answer: { answer: "13.3 min" } }), "min");
  assert.equal(unitOf({ ...CALC, answer: { answer: "25 s" } }), "s");
  assert.equal(unitOf({ ...CALC, answer: { answer: "3.0 × 10^8 m/s" } }), "m/s");
  assert.equal(unitOf({ ...CALC, answer: { answer: "42" } }), "");
  assert.equal(unitOf(MCQ), "", "only number questions have a unit box");
});

test("a number is right within 0.5% (or 0.01) of the recomputed value or the key as written", () => {
  assert.deepEqual(keyNumbers(CALC), [80]);
  const rounded = { ...CALC, answer: { answer: "13.3 min", calc: { expr: "d*1000/v/60", vars: { d: 12, v: 15 }, unit: "min", show: "" } } };
  assert.equal(keyNumbers(rounded).length, 2, "13.33… computed and 13.3 written");
  assert.deepEqual(markExact(CALC, { text: "80" }), { correct: true, marks: 2 });
  assert.deepEqual(markExact(CALC, { text: "80 km/h" }), { correct: true, marks: 2 });
  assert.deepEqual(markExact(CALC, { text: "80.3" }), { correct: true, marks: 2 }, "within 0.5%");
  assert.deepEqual(markExact(CALC, { text: "80.5" }), { correct: false, marks: 0 }, "outside 0.5%");
  assert.deepEqual(markExact(CALC, { text: "120 km/h" }), { correct: false, marks: 0 });
  assert.deepEqual(markExact(CALC, { text: "80 m/s" }), { correct: false, marks: 0 }, "the wrong unit");
  assert.deepEqual(markExact(CALC, { text: "160/2" }), { correct: false, marks: 0 }, "no expressions");
  assert.deepEqual(markExact(rounded, { text: "13.3" }), { correct: true, marks: 2 });
  assert.deepEqual(markExact(rounded, { text: "13.33" }), { correct: true, marks: 2 });
  const wrongKeyText = { ...CALC, answer: { answer: "70 km/h", calc: CALC.answer.calc } };
  assert.deepEqual(markExact(wrongKeyText, { text: "80" }), { correct: true, marks: 2 }, "the recomputed value counts even if the key text was mistyped");
  assert.equal(markExact({ ...CALC, answer: { answer: "about a minute" } }, { text: "60" }), null, "a key with no number is left for the teacher");
});

test("multiple choice and true or false are marked exactly; short answers are left for Funza", () => {
  assert.deepEqual(markExact(MCQ, { choice: "a" }), { correct: true, marks: 1 });
  assert.deepEqual(markExact(MCQ, { choice: "b" }), { correct: false, marks: 0 });
  assert.deepEqual(markExact(TF, { choice: "true" }), { correct: true, marks: 1 });
  assert.deepEqual(markExact(TF, { choice: "false" }), { correct: false, marks: 0 });
  assert.equal(markExact(SHORT, { text: "It is at rest" }), null);
  assert.equal(markExact({ ...MCQ, answer: { correctId: null } }, { choice: "a" }), null, "no key marked");
  assert.equal(markExact({ ...TF, answer: { tf: null } }, { choice: "true" }), null);
});

test("a verdict is right at full marks, partly in between, and unmarked until marked", () => {
  assert.equal(verdict(3, 3), "right");
  assert.equal(verdict(1, 3), "partly");
  assert.equal(verdict(0, 3), "wrong");
  assert.equal(verdict(null, 3), "unmarked");
});

test("a phone's answer is read only in the question's own shape", () => {
  assert.deepEqual(parseResponse(MCQ, { choice: "c" }), { choice: "c" });
  assert.equal(parseResponse(MCQ, { choice: "z" }), null, "an option that doesn't exist");
  assert.equal(parseResponse(MCQ, { text: "a" }), null);
  assert.deepEqual(parseResponse(TF, { choice: "false" }), { choice: "false" });
  assert.equal(parseResponse(TF, { choice: "maybe" }), null);
  assert.deepEqual(parseResponse(CALC, { text: " 80 " }), { text: "80" });
  assert.equal(parseResponse(CALC, { text: "   " }), "empty", "clearing a box removes the answer");
  assert.equal(parseResponse(CALC, { text: "9".repeat(61) }), null, "too long for a number");
  assert.deepEqual(parseResponse(SHORT, { text: "At\u0000 rest" }), { text: "At rest" }, "control characters are dropped");
  assert.equal(parseResponse(SHORT, { text: "x".repeat(1001) }), null);
  assert.equal(parseResponse(SHORT, "text"), null);
});

test("answers and keys are shown in words", () => {
  assert.equal(displayResponse(MCQ, { choice: "b" }), "6 m/s");
  assert.equal(displayResponse(TF, { choice: "false" }), "False");
  assert.equal(displayResponse(SHORT, { text: "At rest" }), "At rest");
  assert.equal(displayKey(MCQ), "4 m/s");
  assert.equal(displayKey(TF), "True");
  assert.equal(displayKey(CALC), "80 km/h");
  assert.equal(displayKey(SHORT), "The object is at rest (its position does not change).");
});

test("a phone sees only the question, never its key", () => {
  const q = publicQuestion("id", 1, MCQ);
  assert.deepEqual(Object.keys(q).sort(), ["id", "marks", "n", "options", "stem", "type", "unit"].filter((k) => k in q).sort());
  assert.deepEqual(q.options, MCQ.options);
  assert.equal(publicQuestion("id", 3, CALC).unit, "km/h");
  assert.equal(JSON.stringify(publicQuestion("id", 4, SHORT)).includes("rest"), false, "the rubric and solution stay on the server");
});

test("snapshots are read defensively, and only phone types are kept", () => {
  assert.deepEqual(parseContent(MCQ), MCQ);
  assert.equal(parseContent({ ...MCQ, type: "fill" }), null);
  assert.equal(parseContent({ ...MCQ, stem: "  " }), null);
  assert.equal(parseContent(null), null);
  const fromBank = contentFromBank({ type: "tf", stem: "Speed is a vector.", options: null, answer: { tf: false }, marks: 1, outcome_ref: "sk-63-1" });
  assert.deepEqual(fromBank, { type: "tf", stem: "Speed is a vector.", options: null, answer: { tf: false }, marks: 1, outcomeRef: "sk-63-1" });
  assert.equal(contentFromBank({ type: "match", stem: "Match", options: null, answer: { pairs: [] }, marks: 2, outcome_ref: null }), null);
});
