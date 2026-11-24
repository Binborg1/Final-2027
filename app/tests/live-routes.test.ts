import assert from "node:assert/strict";
import { test } from "node:test";
import { handleMark, type AiCall, type MarkDeps } from "@/lib/live/handlers/mark";
import { handleAnswer, handleJoin, handleState, MAX_STUDENTS, type PhoneRequest } from "@/lib/live/handlers/phone";
import type { Deps, Result } from "@/lib/live/handlers/result";
import { handleClose, handleCsv, handleEnd, handleMarks, handleOpen, handleRemove, handleReveal, handleStart, snapshot, type TeacherDeps } from "@/lib/live/handlers/teacher";
import type { ConsoleSnapshot, PhoneState } from "@/lib/live/payload";
import { TOKEN_HEADER } from "@/lib/live/token";
import { CALC, MCQ, SHORT, T0, TF } from "./helpers/live-fixtures";
import { emptyDb, memoryStore } from "./helpers/live-store";

/*
 * Development step 5: the live routes, played through whole sessions on a fake
 * clock against an in-memory store that keeps the database's rules.
 */

const TEACHER = "00000000-0000-4000-8000-00000000000a";
const OTHER = "00000000-0000-4000-8000-00000000000b";
const COURSE = "c0000000-0000-4000-8000-000000000001";
const BANK = { mcq: "b0000000-0000-4000-8000-000000000001", tf: "b0000000-0000-4000-8000-000000000002", calc: "b0000000-0000-4000-8000-000000000003", short: "b0000000-0000-4000-8000-000000000004", fill: "b0000000-0000-4000-8000-000000000005", others: "b0000000-0000-4000-8000-000000000006" };
const SESSION = "5e550000-0000-4000-8000-000000000001";
const ORIGIN = "https://funza.test";

function world() {
  const db = emptyDb();
  let t = T0;
  const clock = { now: () => t, at: (ms: number) => (t = T0 + ms) };
  const pings: string[] = [];
  const ping = (_id: string, topic: string, event: string) => void pings.push(`${topic}:${event}`);
  db.courses.set(COURSE, TEACHER);
  const bankRow = (id: string, teacherId: string, c: typeof MCQ, type: string = c.type) => ({ id, teacherId, type, stem: c.stem, options: c.options, answer: c.answer, marks: c.marks, outcome_ref: c.outcomeRef, retired: false, answerCount: 0, correctCount: 0, timesUsed: 0 });
  db.bank.push(bankRow(BANK.mcq, TEACHER, MCQ), bankRow(BANK.tf, TEACHER, TF), bankRow(BANK.calc, TEACHER, CALC), bankRow(BANK.short, TEACHER, SHORT), bankRow(BANK.fill, TEACHER, { ...SHORT, stem: "Speed is ______." }, "fill"), bankRow(BANK.others, OTHER, MCQ));
  let r = 0;
  const teacher = (as = TEACHER): TeacherDeps => ({ store: memoryStore(db, { as, now: clock.now }), now: clock.now, ping, teacherId: as, randomInt: (max) => r++ % max });
  const phone = (): Deps => ({ store: memoryStore(db, { now: clock.now }), now: clock.now, ping });
  return { db, clock, pings, teacher, phone, resetCodes: (n: number) => (r = n) };
}

const req = (headers: Record<string, string> = {}, crossSite = false): PhoneRequest => ({ headers: new Headers(headers), url: `${ORIGIN}/api/live/x`, crossSite });
const data = <T>(r: Result) => {
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  return (r.body as { data: T }).data;
};
const reason = (r: Result) => (r.body.ok ? null : r.body.reason);

const START = { id: SESSION, courseId: COURSE, chapterId: null, resourceVersionId: null, title: "Uniform motion check", timerS: 300, askStudentNo: false };
const ALL = [{ questionId: BANK.mcq }, { questionId: BANK.tf }, { questionId: BANK.calc }, { questionId: BANK.short }];

async function started(w: ReturnType<typeof world>, extra: Partial<typeof START> = {}) {
  return data<{ id: string; code: string }>(await handleStart({ ...START, ...extra, questions: ALL }, w.teacher()));
}

async function join(w: ReturnType<typeof world>, code: string, name: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return handleJoin(req({ "x-real-ip": "203.0.113.7", ...headers }), { code, name, device: `device-${name}`, ...extra }, w.phone());
}

const as = (token: string) => req({ [TOKEN_HEADER]: token });

/* ---------- start ---------- */

test("a teacher starts a session in the lobby from bank questions, each kept with its key", async () => {
  const w = world();
  const { id, code } = await started(w);
  assert.equal(id, SESSION);
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(w.db.sessions[0].state, "lobby");
  assert.deepEqual(w.db.questions.map((q) => [q.position, q.content.type, q.questionId]), [[1, "mcq", BANK.mcq], [2, "tf", BANK.tf], [3, "calc", BANK.calc], [4, "short", BANK.short]]);
  assert.deepEqual(w.db.questions[0].content.answer, MCQ.answer, "the key is snapshotted");
  assert.deepEqual(data(await handleStart({ ...START, questions: ALL }, w.teacher())), { id, code }, "starting again with the same id returns the same session");
});

test("start refuses questions phones can't answer, questions from another bank, and a third open session", async () => {
  const w = world();
  assert.equal(reason(await handleStart({ ...START, questions: [{ questionId: BANK.fill }] }, w.teacher())), "not-on-phones");
  assert.equal(reason(await handleStart({ ...START, questions: [{ questionId: BANK.others }] }, w.teacher())), "bad-question");
  assert.equal(reason(await handleStart({ ...START, courseId: "c0000000-0000-4000-8000-000000000099", questions: ALL }, w.teacher())), "bad-course");
  await started(w);
  await started(w, { id: "5e550000-0000-4000-8000-000000000002" });
  const third = await handleStart({ ...START, id: "5e550000-0000-4000-8000-000000000003", questions: ALL }, w.teacher());
  assert.equal(third.status, 409);
  assert.equal(reason(third), "too-many-open");
  assert.equal((third.body as { data: unknown[] }).data.length, 2, "the open sessions are listed so the teacher can end one");
});

test("a join code already in use by an open session is never handed out twice", async () => {
  const w = world();
  const first = await started(w);
  w.resetCodes(0); // the next session draws the same code first
  const second = await started(w, { id: "5e550000-0000-4000-8000-000000000002" });
  assert.notEqual(second.code, first.code);
});

/* ---------- join ---------- */

test("a student joins with the code and a name; only a hash of their token is stored", async () => {
  const w = world();
  const { code } = await started(w);
  w.pings.length = 0;
  const res = data<{ session: string; participantId: string; token: string; name: string }>(await join(w, code.toLowerCase(), "  Sam   Doe "));
  assert.equal(res.session, SESSION);
  assert.equal(res.name, "Sam Doe");
  const secret = res.token.split(".")[1];
  assert.equal(w.db.participants.length, 1);
  assert.notEqual(w.db.participants[0].tokenHash, secret);
  assert.equal(JSON.stringify(w.db).includes(secret), false, "the secret itself is never stored");
  assert.deepEqual(w.pings, ["teacher:roster"]);
});

test("join explains a wrong code, a missing name or student number, and a session that's over or full", async () => {
  const w = world();
  const { code } = await started(w, { askStudentNo: true });
  assert.equal(reason(await join(w, "K7Q", "Sam")), "bad-code");
  assert.equal(reason(await join(w, "ZZZZZZ", "Sam")), "no-session");
  assert.equal(reason(await join(w, code, "   ")), "bad-name");
  assert.equal(reason(await join(w, code, "Sam")), "needs-student-no");
  assert.equal((await join(w, code, "Sam", { studentNo: "200123" })).status, 200);
  assert.equal(w.db.participants[0].studentNo, "200123");
  assert.equal(reason(await handleJoin(req({}, true), { code, name: "Eve" }, w.phone())), "forbidden", "a page on another site can't join for a student");
  for (let i = w.db.participants.length; i < MAX_STUDENTS; i++) w.db.participants.push({ ...w.db.participants[0], id: `p-${i}`, tokenHash: String(i).padStart(64, "0") });
  assert.equal(reason(await join(w, code, "Late", { studentNo: "1" })), "full");
  w.db.participants.length = 1;
  await handleOpen(w.teacher(), SESSION, ORIGIN);
  w.clock.at(303_000);
  assert.equal(reason(await join(w, code, "Later", { studentNo: "2" })), "closed");
});

test("joining is rate-limited per phone and per network address", async () => {
  const w = world();
  const { code } = await started(w);
  for (let i = 0; i < 10; i++) assert.equal((await join(w, code, `Sam${i}`, { device: "one-phone" })).status, 200);
  const blocked = await join(w, code, "Sam10", { device: "one-phone" });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers?.["Retry-After"]) >= 1);
  w.clock.at(61_000);
  assert.equal((await join(w, code, "Sam11", { device: "one-phone" })).status, 200, "a new minute, a new window");
});

/* ---------- state and answers ---------- */

async function classroom() {
  const w = world();
  const { code } = await started(w);
  const sam = data<{ token: string; participantId: string }>(await join(w, code, "Sam Doe"));
  const ari = data<{ token: string; participantId: string }>(await join(w, code, "Ari"));
  return { w, code, sam, ari };
}

const qid = (w: ReturnType<typeof world>, type: string) => w.db.questions.find((q) => q.content.type === type)!.id;

test("a phone's token works only for its own session, and stops working when the student is removed", async () => {
  const { w, sam, ari } = await classroom();
  assert.equal((await handleState(as(sam.token), SESSION, w.phone())).status, 200);
  assert.equal(reason(await handleState(req(), SESSION, w.phone())), "unknown-token");
  assert.equal(reason(await handleState(as(sam.token.slice(0, -2) + "xx"), SESSION, w.phone())), "unknown-token");
  assert.equal(reason(await handleState(as(sam.token), "5e550000-0000-4000-8000-000000000009", w.phone())), "unknown-token");
  const forged = `${ari.participantId}.${sam.token.split(".")[1]}`;
  assert.equal(reason(await handleState(as(forged), SESSION, w.phone())), "unknown-token", "one student's secret can't open another's answers");
  await handleRemove(w.teacher(), SESSION, { participantId: sam.participantId }, ORIGIN);
  assert.equal(reason(await handleState(as(sam.token), SESSION, w.phone())), "unknown-token");
});

test("answers save only while the clock runs (plus 2 seconds), one per question, marked in code", async () => {
  const { w, sam } = await classroom();
  const send = (questionId: string, response: unknown, crossSite = false) => handleAnswer({ ...as(sam.token), crossSite }, { session: SESSION, questionId, response }, w.phone());
  assert.equal(reason(await send(qid(w, "mcq"), { choice: "a" })), "not-open", "not before the teacher starts");

  await handleOpen(w.teacher(), SESSION, ORIGIN);
  const view = data<PhoneState>(await handleState(as(sam.token), SESSION, w.phone()));
  assert.equal(view.state, "open");
  assert.equal(view.questions?.length, 4);
  assert.equal(JSON.stringify(view).includes("correctId"), false);

  w.pings.length = 0;
  assert.equal((await send(qid(w, "mcq"), { choice: "b" })).status, 200);
  assert.equal((await send(qid(w, "mcq"), { choice: "a" })).status, 200, "a later save replaces the answer");
  assert.deepEqual(w.pings, ["teacher:answers", "teacher:answers"], "answers wake only the console, not every phone");
  assert.equal(w.db.answers.length, 1);
  assert.deepEqual([w.db.answers[0].correct, w.db.answers[0].marks, w.db.answers[0].markedBy], [true, 1, "code"]);
  assert.equal((await send(qid(w, "calc"), { text: "80 km/h" })).status, 200);
  assert.equal(w.db.answers.find((a) => a.questionId === qid(w, "calc"))?.marks, 2);
  assert.equal((await send(qid(w, "short"), { text: "It is at rest" })).status, 200);
  assert.deepEqual([w.db.answers.at(-1)?.marks, w.db.answers.at(-1)?.markedBy], [null, null], "short answers wait for Funza");
  assert.equal((await send(qid(w, "calc"), { text: "  " })).status, 200);
  assert.equal(w.db.answers.some((a) => a.questionId === qid(w, "calc")), false, "clearing a box removes the answer");
  assert.equal(reason(await send(qid(w, "tf"), { choice: "maybe" })), "bad-response");
  assert.equal(reason(await send("9e000001-0000-4000-8000-000000000099", { choice: "a" })), "no-question");
  assert.equal(reason(await send(qid(w, "tf"), { choice: "true" }, true)), "forbidden");

  w.clock.at(301_900);
  assert.equal((await send(qid(w, "tf"), { choice: "true" })).status, 200, "an answer in flight at 0:00 still counts");
  w.clock.at(302_500);
  assert.equal(reason(await send(qid(w, "tf"), { choice: "false" })), "locked");
});

test("a session closes itself on the first request after time is up, even with the laptop asleep", async () => {
  const { w, sam } = await classroom();
  await handleOpen(w.teacher(), SESSION, ORIGIN);
  w.clock.at(310_000);
  w.pings.length = 0;
  const view = data<PhoneState>(await handleState(as(sam.token), SESSION, w.phone()));
  assert.equal(view.state, "closed");
  assert.equal(w.db.sessions[0].state, "closed");
  assert.equal(w.db.sessions[0].closedAt, new Date(T0 + 300_000).toISOString());
  assert.deepEqual(w.pings, ["state:closed", "teacher:closed"]);
  await handleState(as(sam.token), SESSION, w.phone());
  assert.equal(w.pings.length, 2, "only the first request closes it");
});

/* ---------- the teacher's side ---------- */

test("the console follows the session: open, end early, reveal, step, end", async () => {
  const { w, sam, ari } = await classroom();
  const t = w.teacher();
  const send = (token: string, type: string, response: unknown) => handleAnswer(as(token), { session: SESSION, questionId: qid(w, type), response }, w.phone());

  assert.equal(reason(await handleClose(t, SESSION, ORIGIN)), "state", "nothing to end in the lobby");
  const open = data<ConsoleSnapshot>(await handleOpen(t, SESSION, ORIGIN));
  assert.equal(open.session.state, "open");
  assert.equal(open.session.endsAt, new Date(T0 + 300_000).toISOString());
  assert.equal(open.session.joinUrl, `${ORIGIN}/join?code=${open.session.code}`);
  assert.equal((await handleOpen(t, SESSION, ORIGIN)).status, 200, "pressing Start twice does nothing");

  w.clock.at(30_000);
  await send(sam.token, "mcq", { choice: "a" });
  await send(ari.token, "mcq", { choice: "b" });
  await send(ari.token, "tf", { choice: "true" });
  const midway = data<ConsoleSnapshot>(await snapshot(t, SESSION, ORIGIN));
  assert.deepEqual(midway.totals, { joined: 2, started: 2, finished: 0, notStarted: 0, answersIn: 3, answersPossible: 8 });
  assert.equal(reason(await handleReveal(t, SESSION, {}, ORIGIN)), "state", "no Reveal while students are answering");

  w.clock.at(60_000);
  const closed = data<ConsoleSnapshot>(await handleClose(t, SESSION, ORIGIN));
  assert.equal(closed.session.state, "closed");
  assert.equal(closed.session.endsAt, new Date(T0 + 60_000).toISOString(), "End early stops the clock now");
  assert.equal(closed.questions[0].percentRight, 50);

  w.clock.at(90_000);
  w.pings.length = 0;
  const revealed = data<ConsoleSnapshot>(await handleReveal(t, SESSION, {}, ORIGIN));
  assert.equal(revealed.session.state, "revealed");
  assert.equal(revealed.session.currentQuestionId, w.db.questions[0].id);
  assert.deepEqual(w.pings, ["state:revealed", "teacher:revealed"]);
  const samResult = data<PhoneState>(await handleState(as(sam.token), SESSION, w.phone()));
  assert.deepEqual([samResult.result?.score, samResult.result?.max], [1, 7]);

  w.pings.length = 0;
  const stepped = data<ConsoleSnapshot>(await handleReveal(t, SESSION, { questionId: w.db.questions[1].id }, ORIGIN));
  assert.equal(stepped.session.currentQuestionId, w.db.questions[1].id);
  assert.deepEqual(w.pings, ["teacher:step"], "stepping the projector doesn't wake the phones");

  assert.deepEqual(data(await handleEnd(t, SESSION)), { resultsUrl: `/live/${SESSION}/results` });
  assert.equal(w.db.sessions[0].state, "ended");
  const mcqBank = w.db.bank.find((b) => b.id === BANK.mcq)!;
  assert.deepEqual([mcqBank.answerCount, mcqBank.correctCount, mcqBank.timesUsed], [2, 1, 1], "a revealed session teaches the bank");
  assert.equal((await handleEnd(t, SESSION)).status, 200, "ending twice is harmless");
  assert.equal(mcqBank.answerCount, 2);
});

test("another teacher can't see or change the session", async () => {
  const { w } = await classroom();
  const other = w.teacher(OTHER);
  assert.equal((await snapshot(other, SESSION, ORIGIN)).status, 404);
  assert.equal((await handleOpen(other, SESSION, ORIGIN)).status, 404);
  assert.equal((await handleEnd(other, SESSION)).status, 404);
  assert.equal((await handleCsv(other, SESSION)).status, 404);
  assert.equal(w.db.sessions[0].state, "lobby");
});

test("the teacher changes a mark and undoes it; marks are final once the session ends", async () => {
  const { w, sam } = await classroom();
  const t = w.teacher();
  await handleOpen(t, SESSION, ORIGIN);
  await handleAnswer(as(sam.token), { session: SESSION, questionId: qid(w, "short"), response: { text: "It stops" } }, w.phone());
  await handleAnswer(as(sam.token), { session: SESSION, questionId: qid(w, "mcq"), response: { choice: "b" } }, w.phone());
  const short = w.db.answers.find((a) => a.questionId === qid(w, "short"))!;
  const mcq = w.db.answers.find((a) => a.questionId === qid(w, "mcq"))!;
  assert.equal(reason(await handleMarks(t, SESSION, { answerId: short.id, marks: 2 })), "state", "not while students are answering");
  await handleClose(t, SESSION, ORIGIN);

  await handleMarks(t, SESSION, { answerId: short.id, marks: 9 });
  assert.deepEqual([short.marks, short.markedBy, short.correct], [3, "teacher", true], "capped at the question's marks");
  await handleMarks(t, SESSION, { answerId: short.id, undo: true });
  assert.deepEqual([short.marks, short.markedBy], [null, null], "back to unmarked: Funza hadn't marked it");
  await handleMarks(t, SESSION, { answerId: mcq.id, marks: 1 });
  assert.deepEqual([mcq.marks, mcq.markedBy], [1, "teacher"], "the teacher can flip an exact mark too");
  await handleMarks(t, SESSION, { answerId: mcq.id, undo: true });
  assert.deepEqual([mcq.marks, mcq.markedBy], [0, "code"], "Undo on an exact question goes back to the code's mark");

  await handleEnd(t, SESSION);
  assert.equal(reason(await handleMarks(t, SESSION, { answerId: mcq.id, marks: 1 })), "state");
});

test("removing a student works before time is up, and takes their answers with them", async () => {
  const { w, sam, ari } = await classroom();
  const t = w.teacher();
  await handleOpen(t, SESSION, ORIGIN);
  await handleAnswer(as(sam.token), { session: SESSION, questionId: qid(w, "mcq"), response: { choice: "a" } }, w.phone());
  const snap = data<ConsoleSnapshot>(await handleRemove(t, SESSION, { participantId: sam.participantId }, ORIGIN));
  assert.deepEqual(snap.students.map((s) => s.name), ["Ari"]);
  assert.equal(w.db.answers.length, 0);
  await handleClose(t, SESSION, ORIGIN);
  assert.equal(reason(await handleRemove(t, SESSION, { participantId: ari.participantId }, ORIGIN)), "state");
});

test("the CSV lists every student and question", async () => {
  const { w, sam } = await classroom();
  const t = w.teacher();
  await handleOpen(t, SESSION, ORIGIN);
  await handleAnswer(as(sam.token), { session: SESSION, questionId: qid(w, "mcq"), response: { choice: "a" } }, w.phone());
  const r = await handleCsv(t, SESSION);
  assert.equal(r.status, 200);
  assert.match(r.csv ?? "", /Sam Doe,,1,7,14,1,,,/);
  assert.match(r.filename ?? "", /^funza-uniform-motion-check-\d{4}-\d{2}-\d{2}\.csv$/);
});

/* ---------- Funza marks short answers ---------- */

function markDeps(w: ReturnType<typeof world>, reply: (user: string) => string | Error, opts: { configured?: boolean; remaining?: number | null } = {}) {
  const prompts: string[] = [];
  const recorded: AiCall[] = [];
  const deps: MarkDeps = {
    ...w.teacher(),
    ai: {
      configured: () => opts.configured ?? true,
      complete: async ({ user }) => {
        prompts.push(user);
        const out = reply(user);
        if (out instanceof Error) throw out;
        return { text: out, model: "test-model", tokensIn: 10, tokensOut: 5 };
      },
      isBusy: (e) => e instanceof Error && e.message === "busy",
      describe: (e) => (e instanceof Error ? e.message : ""),
    },
    allowance: { remaining: async () => (opts.remaining === undefined ? 40 : opts.remaining), record: async (c) => void recorded.push(c) },
    randomId: (() => {
      let n = 0;
      return () => `r${++n}`;
    })(),
    sleep: async () => {},
  };
  return { deps, prompts, recorded };
}

/** Gives full marks to answers mentioning "rest", none to the rest. */
const fairMarker = (user: string) => {
  const lines = [...user.matchAll(/\{"id":"(r\d+)","text":"([^"]*)"\}/g)];
  return JSON.stringify({ marks: lines.map(([, id, text]) => ({ id, marks: /rest/i.test(text) ? 3 : 0 })), summary: "Most students saw the object is at rest." });
};

async function answeredShort() {
  const { w, sam, ari } = await classroom();
  const t = w.teacher();
  await handleOpen(t, SESSION, ORIGIN);
  await handleAnswer(as(sam.token), { session: SESSION, questionId: qid(w, "short"), response: { text: "It is at rest" } }, w.phone());
  await handleAnswer(as(ari.token), { session: SESSION, questionId: qid(w, "short"), response: { text: "It speeds up" } }, w.phone());
  await handleClose(t, SESSION, ORIGIN);
  return { w, sam, ari };
}

test("Funza marks short answers once time is up, without seeing any names", async () => {
  const { w } = await answeredShort();
  const early = markDeps(w, fairMarker);
  assert.equal(reason(await handleMark(early.deps, SESSION, false)), "too-early", "it waits for answers still in flight");
  w.clock.at(5_000);
  const { deps, prompts, recorded } = markDeps(w, fairMarker);
  const res = data<{ marked: number; failed: unknown[] }>(await handleMark(deps, SESSION, false));
  assert.deepEqual(res, { marked: 2, failed: [] });
  assert.equal(prompts.length, 1, "one call for the question");
  for (const secret of ["Sam Doe", "Ari", ...w.db.participants.map((p) => p.id)]) assert.equal(prompts[0].includes(secret), false, `${secret} sent to the AI`);
  assert.equal(recorded.length, 1, "the call counts against the allowance");
  const short = w.db.questions.find((q) => q.content.type === "short")!;
  assert.deepEqual([short.markState, short.markNote], ["done", "Most students saw the object is at rest."]);
  assert.deepEqual(w.db.answers.filter((a) => a.markedBy === "ai").map((a) => a.marks).sort(), [0, 3]);
  assert.deepEqual(data(await handleMark(markDeps(w, fairMarker).deps, SESSION, false)), { marked: 0, failed: [] }, "a question is marked once");
});

test("when Funza can't mark, the answers stay unmarked and the teacher is told why", async () => {
  const { w } = await answeredShort();
  w.clock.at(5_000);
  const off = await handleMark(markDeps(w, fairMarker, { configured: false }).deps, SESSION, false);
  assert.match((data<{ failed: { failed: string }[] }>(off).failed[0].failed), /No AI/);
  assert.equal(w.db.questions.find((q) => q.content.type === "short")?.markState, "failed");
  assert.ok(w.db.answers.every((a) => a.questionId !== qid(w, "short") || a.marks === null));

  const used = await handleMark(markDeps(w, fairMarker, { remaining: 0 }).deps, SESSION, true);
  assert.match((data<{ failed: { failed: string }[] }>(used).failed[0].failed), /today's Funza actions/);

  let calls = 0;
  const busyThenOk = markDeps(w, (u) => (++calls < 3 ? new Error("busy") : fairMarker(u)));
  assert.deepEqual(data(await handleMark(busyThenOk.deps, SESSION, true)), { marked: 2, failed: [] }, "a busy AI is tried again");
  assert.equal(calls, 3);
});

test("Funza never overwrites a mark the teacher already changed", async () => {
  const { w } = await answeredShort();
  const ariAnswer = w.db.answers.find((a) => a.questionId === qid(w, "short") && (a.response as { text: string }).text === "It speeds up")!;
  await handleMarks(w.teacher(), SESSION, { answerId: ariAnswer.id, marks: 1 });
  w.clock.at(5_000);
  await handleMark(markDeps(w, fairMarker).deps, SESSION, false);
  assert.deepEqual([ariAnswer.marks, ariAnswer.aiMarks, ariAnswer.markedBy], [1, 0, "teacher"]);
  await handleMarks(w.teacher(), SESSION, { answerId: ariAnswer.id, undo: true });
  assert.deepEqual([ariAnswer.marks, ariAnswer.markedBy], [0, "ai"], "Undo goes back to Funza's mark");
});
