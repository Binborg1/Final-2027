import assert from "node:assert/strict";
import { test } from "node:test";
import { AnswerQueue, type SendResult } from "@/lib/live/answer-queue";

/*
 * Development step 5: a phone's answers on their way to the server (FR-11, NFR-6).
 * The newest answer wins, nothing waiting is lost on a reload, and "Saved" means
 * the server has the newest answer.
 */

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

/** A server whose replies the test releases one at a time. */
function server() {
  const calls: { qid: string; response: unknown; resolve: (r: SendResult) => void }[] = [];
  const send = (qid: string, response: unknown) => new Promise<SendResult>((resolve) => calls.push({ qid, response, resolve }));
  return { calls, send };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test("one save at a time per question, and the newest answer is the one saved", async () => {
  const s = server();
  const q = new AnswerQueue({ send: s.send, key: "k" });
  q.set("q1", { choice: "a" });
  q.set("q1", { choice: "b" });
  q.set("q1", { choice: "c" });
  await tick();
  assert.equal(s.calls.length, 1, "the first save is in flight; the others wait");
  assert.equal(q.status("q1"), "saving");
  s.calls[0].resolve({ ok: true });
  await tick();
  assert.equal(s.calls.length, 2);
  assert.deepEqual(s.calls[1].response, { choice: "c" }, "only the newest waiting answer is sent next");
  assert.equal(q.status("q1"), "saving", "not saved until the newest answer is confirmed");
  s.calls[1].resolve({ ok: true });
  await tick();
  assert.equal(q.status("q1"), "saved");
  assert.equal(q.unsent, 0);
});

test("answers to different questions save side by side", async () => {
  const s = server();
  const q = new AnswerQueue({ send: s.send, key: "k" });
  q.set("q1", { choice: "a" });
  q.set("q2", { text: "80" });
  await tick();
  assert.deepEqual(s.calls.map((c) => c.qid), ["q1", "q2"]);
});

test("offline or a server error: it keeps trying, and says so", async () => {
  let n = 0;
  const waits: number[] = [];
  const q = new AnswerQueue({
    key: "k",
    send: async () => (++n < 3 ? (n === 1 ? Promise.reject(new Error("offline")) : { ok: false, status: 503 }) : { ok: true }),
    sleep: async (ms) => void waits.push(ms),
  });
  const states: (string | undefined)[] = [];
  q.set("q1", { choice: "a" });
  states.push(q.status("q1"));
  for (let i = 0; i < 10 && q.status("q1") !== "saved"; i++) await tick();
  assert.equal(q.status("q1"), "saved");
  assert.equal(n, 3);
  assert.deepEqual(waits, [500, 1000], "it waits longer each time");
});

test("too many requests: it waits as long as the server asks", async () => {
  let n = 0;
  const waits: number[] = [];
  const q = new AnswerQueue({ key: "k", send: async () => (++n === 1 ? { ok: false, status: 429, retryAfter: 7 } : { ok: true }), sleep: async (ms) => void waits.push(ms) });
  q.set("q1", { choice: "a" });
  for (let i = 0; i < 10 && q.status("q1") !== "saved"; i++) await tick();
  assert.deepEqual(waits, [7000]);
});

test("after time is up, a question locks and nothing more is sent for it", async () => {
  const s = server();
  const q = new AnswerQueue({ send: s.send, key: "k" });
  q.set("q1", { choice: "a" });
  await tick();
  s.calls[0].resolve({ ok: false, status: 409, reason: "locked" });
  await tick();
  assert.equal(q.status("q1"), "locked");
  q.set("q1", { choice: "b" });
  await tick();
  assert.equal(s.calls.length, 1, "a locked question takes no new answer");
  q.stop();
  q.set("q2", { choice: "a" });
  await tick();
  assert.equal(s.calls.length, 1, "after 0:00 nothing new is queued");
});

test("a phone removed from the session stops sending", async () => {
  const s = server();
  const q = new AnswerQueue({ send: s.send, key: "k" });
  q.set("q1", { choice: "a" });
  await tick();
  s.calls[0].resolve({ ok: false, status: 401 });
  await tick();
  assert.equal(q.gone, true);
  assert.equal(q.status("q1"), "failed");
});

test("answers not yet saved survive a reload and are sent again", async () => {
  const storage = memoryStorage();
  const first = new AnswerQueue({ send: () => new Promise(() => {}), key: "funza.live.s.pending", storage });
  first.set("q1", { choice: "b" });
  first.set("q2", { text: "80 km/h" });
  assert.deepEqual(JSON.parse(storage.m.get("funza.live.s.pending")!), { q1: { choice: "b" }, q2: { text: "80 km/h" } });

  // The page reloads: a new queue reads what was waiting.
  const sent: string[] = [];
  const second = new AnswerQueue({ send: async (qid) => (sent.push(qid), { ok: true }), key: "funza.live.s.pending", storage });
  second.restore();
  assert.deepEqual([...second.waiting().keys()].sort(), ["q1", "q2"]);
  for (let i = 0; i < 5; i++) await tick();
  assert.deepEqual(sent.sort(), ["q1", "q2"]);
  assert.equal(storage.m.has("funza.live.s.pending"), false, "cleared once everything is saved");
});
