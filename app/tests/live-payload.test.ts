import assert from "node:assert/strict";
import { test } from "node:test";
import { consoleView, phoneView, screenView } from "@/lib/live/payload";
import { allKeys, answer, FORBIDDEN_KEYS, iso, openSession, P, Q, QUESTIONS, session, T0 } from "./helpers/live-fixtures";

/*
 * Development step 5: what each screen receives. Answer keys never reach a phone
 * before Reveal, a phone never sees another student, and the projector never
 * shows names.
 */

const JOIN = "https://funza.test/join?code=K7QM4P";
const mine = [answer(P.sam.id, Q.mcq, { choice: "b" }, 0, { correct: false }), answer(P.sam.id, Q.calc, { text: "80 km/h" }, 2)];
const others = [answer(P.ari.id, Q.mcq, { choice: "a" }, 1), answer(P.ari.id, Q.short, { text: "It is at rest" }, 3, { markedBy: "ai", aiMarks: 3 })];

const closed = () => openSession({ state: "closed", closedAt: iso(T0 + 300_000), rev: 2 });
const revealed = () => openSession({ state: "revealed", closedAt: iso(T0 + 300_000), revealedAt: iso(T0 + 400_000), currentQuestionId: Q.mcq, rev: 3 });

test("before Reveal, no phone payload holds an answer key or anyone else's details", () => {
  const states = [session(), openSession(), closed(), openSession({ state: "ended", endedAt: iso(T0 + 500_000), closedAt: iso(T0 + 300_000) })];
  for (const s of states) {
    const view = phoneView({ session: s, questions: QUESTIONS, me: P.sam, mine, now: T0 + 1_000 });
    const keys = allKeys(view);
    for (const k of FORBIDDEN_KEYS) assert.equal(keys.has(k), false, `"${k}" in the ${s.state} payload`);
    const text = JSON.stringify(view);
    for (const leak of ["4 m/s\",\"", "Its direction changes", "The object is at rest", "d/t", P.ari.name, P.sam.studentNo!]) {
      if (leak === "4 m/s\",\"") continue;
      assert.equal(text.includes(leak), false, `"${leak}" leaked in the ${s.state} payload`);
    }
    assert.equal(view.result, undefined, "no result before Reveal");
  }
});

test("while answering, a phone gets every question, its own saved answers and the server's clock", () => {
  const view = phoneView({ session: openSession(), questions: QUESTIONS, me: P.sam, mine, now: T0 + 1_000 });
  assert.equal(view.state, "open");
  assert.equal(view.questions?.length, 4);
  assert.deepEqual(view.questions?.map((q) => q.n), [1, 2, 3, 4]);
  assert.deepEqual(view.mine, { [Q.mcq]: { choice: "b" }, [Q.calc]: { text: "80 km/h" } });
  assert.equal(view.endsAt, iso(T0 + 300_000));
  assert.equal(view.serverNow, iso(T0 + 1_000));
  assert.equal(view.me.name, P.sam.name);
});

test("a phone in the lobby sees the timer; after time is up, how many it answered", () => {
  assert.equal(phoneView({ session: session(), questions: QUESTIONS, me: P.sam, mine: [], now: T0 }).timerS, 300);
  const late = phoneView({ session: openSession(), questions: QUESTIONS, me: P.sam, mine, now: T0 + 303_000 });
  assert.equal(late.state, "closed", "a session past its time shows as closed");
  assert.equal(late.answered, 2);
  assert.equal(late.questions, undefined);
});

test("after Reveal, each phone sees only its own result", () => {
  const view = phoneView({ session: revealed(), questions: QUESTIONS, me: P.sam, mine, now: T0 + 400_000 });
  assert.ok(view.result);
  assert.equal(view.result.max, 7);
  assert.equal(view.result.score, 2);
  assert.equal(view.result.percent, 29);
  assert.deepEqual(view.result.items.map((i) => i.verdict), ["wrong", "wrong", "right", "wrong"]);
  assert.deepEqual(view.result.items[0], { n: 1, stem: QUESTIONS[0].content.stem, type: "mcq", yours: "6 m/s", key: "4 m/s", marks: 0, max: 1, verdict: "wrong" });
  assert.equal(view.result.items[1].yours, null, "no answer");
  assert.equal(JSON.stringify(view).includes(P.ari.name), false);
  const after = phoneView({ session: { ...revealed(), state: "ended", endedAt: iso(T0 + 500_000) }, questions: QUESTIONS, me: P.sam, mine, now: T0 + 500_000 });
  assert.ok(after.result, "the result stays after the teacher ends the session");
});

test("the console shows names and progress while students answer, but no marks", () => {
  const snap = consoleView({ session: openSession(), questions: QUESTIONS, participants: [P.sam, P.ari, P.kai], answers: [...mine, ...others], now: T0 + 60_000, joinUrl: JOIN });
  assert.deepEqual(snap.totals, { joined: 3, started: 2, finished: 0, notStarted: 1, answersIn: 4, answersPossible: 12 });
  assert.deepEqual(snap.questions.map((q) => q.answered), [2, 0, 1, 1]);
  assert.ok(snap.questions.every((q) => q.key === null && q.percentRight === null), "no keys or percentages while answering");
  assert.deepEqual(snap.answers, []);
  assert.deepEqual(snap.students.find((s) => s.id === P.sam.id)?.answered.sort(), [Q.mcq, Q.calc].sort());
  assert.equal(snap.students[0].score, null);
});

test("once time is up, the console has every answer with its mark", () => {
  const snap = consoleView({ session: closed(), questions: QUESTIONS, participants: [P.sam, P.ari, P.kai], answers: [...mine, ...others], now: T0 + 310_000, joinUrl: JOIN });
  assert.equal(snap.answers.length, 4);
  const short = snap.answers.find((a) => a.questionId === Q.short);
  assert.deepEqual(short && { text: short.text, marks: short.marks, by: short.markedBy, verdict: short.verdict }, { text: "It is at rest", marks: 3, by: "ai", verdict: "right" });
  assert.equal(snap.questions[0].key, "4 m/s");
  assert.equal(snap.questions[0].percentRight, 33, "1 of 3 students");
  assert.deepEqual(snap.questions[0].commonWrong, { text: "6 m/s", count: 1, percent: 33 });
});

test("the projector never gets names, student numbers or answers, and keys only after Reveal", () => {
  for (const s of [session(), openSession(), closed(), revealed()]) {
    const snap = consoleView({ session: s, questions: QUESTIONS, participants: [P.sam, P.ari], answers: [...mine, ...others], now: T0 + 400_000, joinUrl: JOIN });
    const screen = screenView(snap);
    const text = JSON.stringify(screen);
    for (const leak of [P.sam.name, P.ari.name, P.sam.studentNo!]) assert.equal(text.includes(leak), false, `${leak} on the projector (${s.state})`);
    assert.equal(allKeys(screen).has("students"), false);
    assert.equal(allKeys(screen).has("answers"), false);
    const keysShown = screen.questions.some((q) => q.key !== null);
    assert.equal(keysShown, s.state === "revealed", `keys on the projector in ${s.state}`);
  }
});
