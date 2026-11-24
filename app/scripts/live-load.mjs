#!/usr/bin/env node
/**
 * Live mode load test (development step 5, "done when"): simulated phones join a
 * real session by its code, wait for the teacher to start, answer every question
 * (changing some answers), and check that every answer the server acknowledged is
 * the one it kept. The teacher runs the session by hand from the console.
 *
 *   node scripts/live-load.mjs --base https://<preview>.vercel.app --code K7QM4P --phones 35
 *     [--realtime --supabase-url https://<project>.supabase.co --key sb_publishable_…]
 *     [--late] [--out report.json]
 *
 * Exits with 1 if any acknowledged answer was lost, an answer key reached a phone
 * before Reveal, or the 95th-percentile time to see the questions was over 1 s.
 */

import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((out, a, i, all) => {
    if (a.startsWith("--")) out.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
    return out;
  }, []),
);
const BASE = String(args.base ?? "").replace(/\/$/, "");
const CODE = String(args.code ?? "").toUpperCase();
const PHONES = Number(args.phones ?? 35);
if (!BASE || !CODE) {
  console.error("Usage: node scripts/live-load.mjs --base <url> --code <join code> [--phones 35] [--realtime --supabase-url <url> --key <publishable key>] [--late] [--out report.json]");
  process.exit(2);
}

const FORBIDDEN = ["answer", "correctId", "tf", "rubric", "solution", "calc", "content", "token_hash"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pct = (xs, p) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] : null);
const stats = (xs) => ({ n: xs.length, p50: pct(xs, 50), p95: pct(xs, 95), max: xs.length ? Math.max(...xs) : null });

const timing = { join: [], state: [], answer: [], seeQuestions: [], seeReveal: [] };
const counts = {};
const count = (k) => (counts[k] = (counts[k] ?? 0) + 1);
let lost = 0;
let leaks = 0;

function keysOf(v, out = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      out.add(k);
      keysOf(x, out);
    }
  }
  return out;
}

async function call(kind, path, init = {}) {
  const t = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
    const json = await res.json().catch(() => null);
    timing[kind].push(Date.now() - t);
    count(`${kind} ${res.status}`);
    return { status: res.status, json, sent: t, received: Date.now() };
  } catch {
    count(`${kind} network-error`);
    return { status: 0, json: null, sent: t, received: Date.now() };
  }
}

function answerFor(q) {
  if (q.type === "mcq") return { choice: q.options[Math.floor(Math.random() * q.options.length)].id };
  if (q.type === "tf") return { choice: Math.random() < 0.5 ? "true" : "false" };
  if (q.type === "calc") return { text: `${Math.round(rand(1, 100) * 10) / 10}${q.unit ? ` ${q.unit}` : ""}` };
  return { text: `Simulated answer ${Math.floor(rand(1, 1000))}` };
}

async function listen(sessionId, onPing) {
  if (!args.realtime) return () => {};
  const { RealtimeClient } = await import("@supabase/supabase-js");
  const url = String(args["supabase-url"] ?? "");
  const key = String(args.key ?? "");
  const client = new RealtimeClient(`${url.replace(/^http/, "ws")}/realtime/v1`, { params: { apikey: key } });
  const ch = client.channel(`live:${sessionId}`);
  ch.on("broadcast", { event: "*" }, onPing).subscribe();
  return () => client.removeAllChannels();
}

async function phone(i) {
  await sleep(rand(0, 10_000));
  const joined = await call("join", "/api/live/join", { method: "POST", body: JSON.stringify({ code: CODE, name: `Sim ${i + 1}`, studentNo: String(900000 + i), device: randomUUID() }) });
  if (!joined.json?.ok) return console.error(`phone ${i + 1}: join failed (${joined.status} ${joined.json?.reason ?? ""})`);
  const { session, token } = joined.json.data;
  const headers = { "x-funza-token": token };
  let offset = 0;
  let wake = null;
  const stop = await listen(session, () => wake?.());

  const state = async () => {
    const r = await call("state", `/api/live/state?session=${session}`, { headers });
    if (r.json?.ok) offset = Date.parse(r.json.data.serverNow) - (r.sent + r.received) / 2;
    return r.json?.ok ? r.json.data : null;
  };
  const waitFor = async (pred) => {
    for (;;) {
      const s = await state();
      if (s && pred(s)) return s;
      await Promise.race([sleep(2000), new Promise((r) => (wake = r))]);
    }
  };

  // Wait for "Start answering".
  const open = await waitFor((s) => s.state !== "lobby");
  if (open.state !== "open") return stop();
  const seenAt = Date.now() + offset;
  timing.seeQuestions.push(Math.max(0, seenAt - Date.parse(open.openedAt)));
  for (const k of keysOf(open)) if (FORBIDDEN.includes(k)) leaks++;

  const acked = new Map();
  const endsAt = Date.parse(open.endsAt);
  const save = async (q, response) => {
    const r = await call("answer", "/api/live/answer", { method: "POST", headers, body: JSON.stringify({ session, questionId: q.id, response }) });
    if (r.status === 200) acked.set(q.id, response);
    return r.status;
  };
  for (const q of open.questions) {
    if (Date.now() + offset > endsAt - 4_000) break;
    await sleep(rand(500, 4_000));
    await save(q, answerFor(q));
    if (Math.random() < 0.2) await save(q, answerFor(q)); // a change of mind
  }

  // Just before 0:00: what the server kept must be what it acknowledged.
  await sleep(Math.max(0, endsAt - 3_000 - (Date.now() + offset)));
  const check = await state();
  if (check?.mine) {
    for (const [qid, r] of acked) if (JSON.stringify(check.mine[qid]) !== JSON.stringify(r)) lost++;
    for (const k of keysOf(check)) if (FORBIDDEN.includes(k)) leaks++;
  }
  if (args.late && open.questions[0]) {
    await sleep(Math.max(0, endsAt + 1_000 - (Date.now() + offset)));
    count(`late +1s → ${await save(open.questions[0], answerFor(open.questions[0]))}`);
    await sleep(2_000);
    count(`late +3s → ${await save(open.questions[0], answerFor(open.questions[0]))}`);
  }

  // After Reveal, the phone's own result lists what it answered.
  const revealed = await waitFor((s) => s.state === "revealed" || s.state === "ended");
  if (revealed.revealedAt) timing.seeReveal.push(Math.max(0, Date.now() + offset - Date.parse(revealed.revealedAt)));
  stop();
}

console.log(`Joining ${PHONES} simulated phones to ${CODE} on ${BASE}${args.realtime ? " (Realtime on)" : " (polling every 2 s)"}…`);
console.log("Start answering from the console when you are ready; reveal when time is up.");
await Promise.all(Array.from({ length: PHONES }, (_, i) => phone(i)));

const report = {
  phones: PHONES,
  join: stats(timing.join),
  state: stats(timing.state),
  answer: stats(timing.answer),
  seeQuestionsMs: stats(timing.seeQuestions),
  seeRevealMs: stats(timing.seeReveal),
  statuses: counts,
  lostAnswers: lost,
  keyLeaksBeforeReveal: leaks,
};
console.log(JSON.stringify(report, null, 2));
if (args.out) writeFileSync(String(args.out), JSON.stringify(report, null, 2));
const slow = (report.seeQuestionsMs.p95 ?? 0) > 1000;
if (lost > 0 || leaks > 0 || slow) {
  console.error(`FAILED: ${lost} lost answers, ${leaks} key leaks, p95 time to see the questions ${report.seeQuestionsMs.p95} ms.`);
  process.exit(1);
}
console.log("PASSED: no lost answers, no key leaks, questions seen within 1 s (p95).");
