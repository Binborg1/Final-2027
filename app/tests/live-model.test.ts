import assert from "node:assert/strict";
import { test } from "node:test";
import { CODE_ALPHABET, isValidCode, makeCode, normalizeCode } from "@/lib/live/code";
import { canAcceptAnswer, effectiveState, GRACE_MS, lazyClose, needsLazyClose, plan, secondsLeft, stepOf } from "@/lib/live/state";
import { formatToken, hashSecret, newSecret, parseToken, tokenMatches } from "@/lib/live/token";
import { iso, openSession, session, T0 } from "./helpers/live-fixtures";

/*
 * Development step 5: Live mode's model — join codes, student tokens and the
 * session's states on one server clock.
 */

/* ---------- join codes ---------- */

test("a join code is six characters with no look-alikes, and matches the database check", () => {
  let n = 0;
  const code = makeCode(() => n++ % 32);
  assert.equal(code.length, 6);
  assert.ok(isValidCode(code));
  for (const ch of CODE_ALPHABET) assert.match(ch.repeat(6), /^[A-HJ-NP-Z2-9]{6}$/, `${ch} is allowed by the database`);
  assert.ok(!/[01IO]/.test(CODE_ALPHABET), "no 0, 1, I or O");
  assert.equal(normalizeCode(" k7q-2px "), "K7Q2PX");
  assert.equal(isValidCode("K7Q2P0"), false, "0 is not in the alphabet");
  assert.equal(isValidCode("K7Q2P"), false, "too short");
  assert.equal(isValidCode("K7Q2PXX"), false, "too long");
});

/* ---------- student tokens ---------- */

test("a student token is stored only as a hash and checked in constant time", () => {
  const { secret, hash } = newSecret();
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hashSecret(secret), hash);
  assert.notEqual(secret, hash);
  assert.equal(tokenMatches(hash, secret), true);
  assert.equal(tokenMatches(hash, secret + "x"), false);
  assert.equal(tokenMatches(hash, null), false);
  assert.equal(tokenMatches(hash, ""), false);
  assert.equal(tokenMatches("abcd", secret), false, "a stored hash of the wrong length never matches");
});

test("the token header names the participant and carries the secret", () => {
  const { secret } = newSecret();
  const id = "a0000000-0000-4000-8000-000000000001";
  assert.deepEqual(parseToken(formatToken(id, secret)), { participantId: id, secret });
  assert.equal(parseToken(null), null);
  assert.equal(parseToken("not-a-token"), null);
  assert.equal(parseToken(`${id}.short`), null, "a secret that is too short");
  assert.equal(parseToken(`nope.${secret}`), null, "a participant id that isn't a uuid");
  assert.equal(parseToken(`${id}.${secret}<script>`), null);
  assert.equal(parseToken(`${id}.${"a".repeat(300)}`), null, "too long");
});

/* ---------- states and the clock ---------- */

test("the stepper follows the session's state", () => {
  assert.deepEqual(["lobby", "open", "closed", "revealed", "ended"].map((s) => stepOf(s as never)), [1, 2, 3, 4, 5]);
});

test("a session closes itself 2 seconds after its end time if the console is gone", () => {
  const s = openSession();
  const end = T0 + 300_000;
  assert.equal(needsLazyClose(s, end + GRACE_MS), false, "still within the grace");
  assert.equal(needsLazyClose(s, end + GRACE_MS + 1), true);
  assert.equal(effectiveState(s, end + GRACE_MS + 1), "closed");
  assert.equal(effectiveState(s, end), "open");
  const c = lazyClose(s, end + 10_000);
  assert.ok(c);
  assert.deepEqual(c.expect, { state: "open", rev: 1 });
  assert.equal(c.patch.state, "closed");
  assert.equal(c.patch.closed_at, iso(end), "it closed when the time ran out, not when it was noticed");
  assert.equal(c.patch.rev, 2);
  assert.equal(lazyClose(s, end), null);
  assert.equal(secondsLeft(s, T0 + 1_500), 299);
  assert.equal(secondsLeft(s, end + 5), 0);
});

test("answers save while the clock runs and for 2 seconds after it, then lock", () => {
  const s = openSession();
  const end = T0 + 300_000;
  assert.deepEqual(canAcceptAnswer(session(), T0), { ok: false, reason: "not-open" }, "not in the lobby");
  assert.deepEqual(canAcceptAnswer(s, T0 + 1), { ok: true });
  assert.deepEqual(canAcceptAnswer(s, end + 1_999), { ok: true }, "within the grace");
  assert.deepEqual(canAcceptAnswer(s, end + 2_001), { ok: false, reason: "locked" });
  const early = { ...s, state: "closed" as const, endsAt: iso(T0 + 60_000) };
  assert.deepEqual(canAcceptAnswer(early, T0 + 61_000), { ok: true }, "an answer in flight when the teacher ends early still counts");
  assert.deepEqual(canAcceptAnswer(early, T0 + 62_500), { ok: false, reason: "locked" });
  assert.deepEqual(canAcceptAnswer({ ...s, state: "revealed" }, T0 + 1), { ok: false, reason: "locked" });
  assert.deepEqual(canAcceptAnswer({ ...s, state: "ended" }, T0 + 1), { ok: false, reason: "locked" });
});

test("starting the clock sets one end time for the whole set", () => {
  const p = plan("open", session(), T0);
  assert.ok(p.ok && !p.noop);
  assert.deepEqual(p.expect, { state: "lobby", rev: 0 });
  assert.deepEqual(p.patch, { state: "open", opened_at: iso(T0), ends_at: iso(T0 + 300_000), rev: 1 });
  assert.deepEqual(plan("open", openSession(), T0), { ok: true, noop: true }, "pressing Start twice does nothing");
  const again = plan("open", session({ state: "closed", closedAt: iso(T0) }), T0);
  assert.equal(again.ok, false);
});

test("ending early stops the clock now; once closed it stays closed", () => {
  const p = plan("close", openSession(), T0 + 60_000);
  assert.ok(p.ok && !p.noop);
  assert.equal(p.patch.ends_at, iso(T0 + 60_000));
  assert.equal(p.patch.closed_at, iso(T0 + 60_000));
  assert.deepEqual(plan("close", session({ state: "closed", closedAt: iso(T0) }), T0), { ok: true, noop: true });
  assert.equal(plan("close", session(), T0).ok, false, "nothing to close in the lobby");
});

test("Reveal starts at the first question, and only after time is up", () => {
  const closed = openSession({ state: "closed", endsAt: iso(T0 + 60_000), closedAt: iso(T0 + 60_000), rev: 2 });
  const p = plan("reveal", closed, T0 + 90_000, { firstQuestionId: "q1" });
  assert.ok(p.ok && !p.noop);
  assert.deepEqual(p.patch, { state: "revealed", revealed_at: iso(T0 + 90_000), current_question_id: "q1", rev: 3 });
  const refused = plan("reveal", openSession(), T0 + 1_000);
  assert.equal(refused.ok, false, "students are still answering");
  const late = plan("reveal", openSession(), T0 + 400_000, { firstQuestionId: "q1" });
  assert.ok(late.ok && !late.noop, "a session past its time can be revealed straight away");
  assert.equal(late.patch.state, "revealed");
  assert.equal(late.patch.closed_at, iso(T0 + 300_000));
});

test("the projector steps through revealed questions", () => {
  const revealed = session({ state: "revealed", openedAt: iso(T0), endsAt: iso(T0), closedAt: iso(T0), revealedAt: iso(T0), currentQuestionId: "q1", rev: 4 });
  const p = plan("step", revealed, T0, { questionId: "q2" });
  assert.ok(p.ok && !p.noop);
  assert.deepEqual(p.patch, { current_question_id: "q2", rev: 5 });
  assert.deepEqual(plan("step", revealed, T0, { questionId: "q1" }), { ok: true, noop: true });
  assert.equal(plan("step", openSession(), T0, { questionId: "q2" }).ok, false);
});
