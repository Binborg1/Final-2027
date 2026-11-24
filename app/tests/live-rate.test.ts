import assert from "node:assert/strict";
import { test } from "node:test";
import { allowed, clientAddress, RATES, rateKey, retryAfter } from "@/lib/live/rate";

/*
 * Development step 5: rate limits on the public live endpoints (NFR-12),
 * counted in Postgres. No network address is stored, and a database hiccup never
 * locks a class out.
 */

test("rate-limit keys are hashed: no network address or token is stored", () => {
  const key = rateKey("joinIp", "203.0.113.7");
  assert.match(key, /^joinIp:[0-9a-f]{32}$/);
  assert.equal(key.includes("203.0.113.7"), false);
  assert.equal(rateKey("joinIp", "203.0.113.7"), key, "the same address counts against the same key");
  assert.notEqual(rateKey("joinDevice", "203.0.113.7"), key, "each kind counts separately");
});

test("the limits match the requirements", () => {
  assert.deepEqual(RATES, { joinDevice: 10, joinIp: 100, answer: 60, state: 60 });
});

test("the caller's address comes from Vercel's headers", () => {
  assert.equal(clientAddress(new Headers({ "x-real-ip": "198.51.100.4" })), "198.51.100.4");
  assert.equal(clientAddress(new Headers({ "x-forwarded-for": "198.51.100.9, 10.0.0.1" })), "198.51.100.9");
  assert.equal(clientAddress(new Headers()), "unknown");
});

test("Retry-After counts down to the end of the minute", () => {
  assert.equal(retryAfter(Date.parse("2026-11-26T15:00:00.000Z")), 60);
  assert.equal(retryAfter(Date.parse("2026-11-26T15:00:45.200Z")), 15);
  assert.equal(retryAfter(Date.parse("2026-11-26T15:00:59.900Z")), 1);
});

test("a request goes ahead when the counter says so, and also when the counter can't be reached", async () => {
  const seen: [string, number][] = [];
  assert.equal(await allowed(async (k, l) => (seen.push([k, l]), true), "answer", "token"), true);
  assert.equal(await allowed(async () => false, "answer", "token"), false);
  assert.deepEqual(seen[0][1], 60);
  const logs: string[] = [];
  assert.equal(await allowed(async () => { throw new Error("connection refused"); }, "state", "token", (m) => logs.push(m)), true);
  assert.match(logs[0], /state/);
});
