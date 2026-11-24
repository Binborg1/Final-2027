import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell, csvFilename, resultsCsv } from "@/lib/live/csv";
import { liveResults, mostMissed } from "@/lib/live/results";
import { answer, P, Q, QUESTIONS } from "./helpers/live-fixtures";

/*
 * Development step 5: results (FR-14) and the CSV export (FR-15).
 */

const ANSWERS = [
  answer(P.sam.id, Q.mcq, { choice: "a" }, 1),
  answer(P.ari.id, Q.mcq, { choice: "b" }, 0, { correct: false }),
  answer(P.kai.id, Q.mcq, { choice: "b" }, 0, { correct: false }),
  answer(P.sam.id, Q.tf, { choice: "true" }, 1),
  answer(P.ari.id, Q.tf, { choice: "true" }, 1),
  answer(P.kai.id, Q.tf, { choice: "false" }, 0, { correct: false }),
  answer(P.sam.id, Q.calc, { text: "80" }, 2),
  answer(P.ari.id, Q.calc, { text: "120 km/h" }, 0, { correct: false }),
  answer(P.sam.id, Q.short, { text: "It is at rest" }, 3),
  answer(P.ari.id, Q.short, { text: "It stops" }, 1, { correct: false, markedBy: "ai" }),
  answer(P.kai.id, Q.short, { text: "?" }, null),
];

test("percent right is of the students who joined; partly and unmarked are counted apart", () => {
  const r = liveResults({ questions: QUESTIONS, participants: [P.sam, P.ari, P.kai], answers: ANSWERS });
  assert.equal(r.joined, 3);
  assert.equal(r.totalMarks, 7);
  assert.deepEqual(r.questions.map((q) => q.percentRight), [33, 67, 33, 33]);
  const short = r.questions[3];
  assert.deepEqual([short.right, short.partly, short.wrong, short.unmarked], [1, 1, 0, 1]);
  assert.deepEqual(r.questions[0].options?.map((o) => [o.text, o.count]), [["4 m/s", 1], ["6 m/s", 2], ["18 m/s", 0], ["144 m/s", 0]]);
  assert.deepEqual(r.questions[1].options?.map((o) => [o.text, o.count]), [["True", 2], ["False", 1]]);
});

test("the most common wrong answer is shown for exact questions", () => {
  const r = liveResults({ questions: QUESTIONS, participants: [P.sam, P.ari, P.kai], answers: ANSWERS });
  assert.deepEqual(r.questions[0].commonWrong, { text: "6 m/s", count: 2, percent: 67 });
  assert.deepEqual(r.questions[2].commonWrong, { text: "120 km/h", count: 1, percent: 33 });
  assert.equal(r.questions[3].commonWrong, null, "short answers have no single wrong answer");
});

test("students' scores, the class average and the split by outcome", () => {
  const r = liveResults({ questions: QUESTIONS, participants: [P.sam, P.ari, P.kai], answers: ANSWERS });
  assert.deepEqual(r.students.map((s) => [s.name, s.score, s.percent]), [["Sam Doe", 7, 100], ["Ari", 2, 29], ["Kai", 0, 0]]);
  assert.equal(r.classAverage, 43);
  const motion = r.byOutcome.find((o) => o.outcomeRef === "sk-63-110477");
  assert.deepEqual(motion, { outcomeRef: "sk-63-110477", percentRight: 33, questions: 3 });
});

test("most missed: lowest percent right first, ties by position", () => {
  const r = liveResults({ questions: QUESTIONS, participants: [P.sam, P.ari, P.kai], answers: ANSWERS });
  assert.deepEqual(mostMissed(r).map((q) => q.n), [1, 3, 4]);
});

test("after the 30-day purge, results come from the anonymous counts", () => {
  const purged = QUESTIONS.map((q, i) => ({ ...q, answerCount: 10, correctCount: i * 2 }));
  const r = liveResults({ questions: purged, participants: [], answers: [], purged: true });
  assert.deepEqual(r.questions.map((q) => q.percentRight), [0, 20, 40, 60]);
  assert.deepEqual(r.students, []);
  assert.equal(r.classAverage, null);
});

test("CSV cells are quoted, and text that looks like a formula can't run", () => {
  assert.equal(csvCell("Sam"), "Sam");
  assert.equal(csvCell("Doe, Sam"), '"Doe, Sam"');
  assert.equal(csvCell('She said "hi"'), '"She said ""hi"""');
  assert.equal(csvCell("two\nlines"), '"two\nlines"');
  assert.equal(csvCell("=SUM(A1:A9)"), "'=SUM(A1:A9)");
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell("-cmd"), "'-cmd");
  assert.equal(csvCell("@x"), "'@x");
  assert.equal(csvCell("\tx"), "'\tx");
  assert.equal(csvCell(-4), "-4", "numbers are left alone");
  assert.equal(csvCell(null), "");
});

test("the CSV has one row per student and one per question, opens in Excel, and has a safe name", () => {
  const r = liveResults({ questions: QUESTIONS, participants: [P.sam, P.ari, P.kai], answers: ANSWERS });
  const marks = new Map<string, Map<string, number | null>>();
  for (const a of ANSWERS) marks.set(a.participantId, (marks.get(a.participantId) ?? new Map()).set(a.questionId, a.marks));
  const csv = resultsCsv(r, marks);
  assert.equal(csv.charCodeAt(0), 0xfeff, "a byte-order mark for Excel");
  const lines = csv.slice(1).split("\r\n");
  assert.equal(lines[0], "Student,Student number,Score,Out of,Percent,Q1 (1),Q2 (1),Q3 (2),Q4 (3)");
  assert.equal(lines[1], "Sam Doe,200123,7,7,100,1,1,2,3");
  assert.equal(lines[3], "Kai,,0,7,0,0,0,,", "unanswered and unmarked are empty");
  assert.ok(lines.some((l) => l.startsWith("Q1. A cart moves") && l.includes("6 m/s (2)")));
  assert.equal(csvFilename("Uniform motion: check #1 — élan", new Date("2026-11-26T15:00:00Z")), "funza-uniform-motion-check-1-elan-2026-11-26.csv");
  assert.equal(csvFilename("!!!", new Date("2026-11-26T15:00:00Z")), "funza-live-2026-11-26.csv");
});
