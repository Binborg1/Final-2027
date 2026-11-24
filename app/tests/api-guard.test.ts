import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { seal, sealTokens, tokensFor } from "@/lib/lms/session";
import { makeRequest, restoreFetch, sessionCookies, setCookies, stubAuth, TEACHER_A, TEACHER_B, setTestEnv } from "./helpers/auth";

/*
 * Development step 3: /api/teach and every /api/lms/google/* route answer 401
 * without a signed-in teacher, and the Classroom cookie works only for the
 * teacher it was sealed for.
 */

const SECRET = "a-test-secret-that-is-long-enough-123456";
const ORIGIN = { origin: "http://localhost:3000" };

setTestEnv();
const env = { ...process.env };
beforeEach(() => {
  process.env = { ...env, GOOGLE_CLIENT_ID: "client-123.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "shh", FUNZA_SESSION_SECRET: SECRET };
  for (const k of ["GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "FUNZA_AI_API_KEY", "FUNZA_AI_PROVIDER"]) delete process.env[k];
});
afterEach(() => {
  restoreFetch();
  process.env = { ...env };
});

type Handler = (request: ReturnType<typeof makeRequest>) => Promise<Response>;
const ROUTES: { path: string; method: "GET" | "POST"; load: () => Promise<Record<string, unknown>> }[] = [
  { path: "/api/teach", method: "GET", load: () => import("@/app/api/teach/route") },
  { path: "/api/teach", method: "POST", load: () => import("@/app/api/teach/route") },
  { path: "/api/lms/google/callback?state=x&code=y", method: "GET", load: () => import("@/app/api/lms/google/callback/route") },
  { path: "/api/lms/google/classes", method: "GET", load: () => import("@/app/api/lms/google/classes/route") },
  { path: "/api/lms/google/connect?returnTo=/make", method: "GET", load: () => import("@/app/api/lms/google/connect/route") },
  { path: "/api/lms/google/disconnect", method: "POST", load: () => import("@/app/api/lms/google/disconnect/route") },
  { path: "/api/lms/google/doc", method: "POST", load: () => import("@/app/api/lms/google/doc/route") },
  { path: "/api/lms/google/post", method: "POST", load: () => import("@/app/api/lms/google/post/route") },
  { path: "/api/lms/google/status", method: "GET", load: () => import("@/app/api/lms/google/status/route") },
  { path: "/api/lms/google/topics?course=abc", method: "GET", load: () => import("@/app/api/lms/google/topics/route") },
];

async function call(route: (typeof ROUTES)[number], cookies?: Record<string, string>) {
  const handler = (await route.load())[route.method] as Handler;
  return handler(makeRequest(route.path, { method: route.method, cookies, headers: route.method === "POST" ? { ...ORIGIN, "content-type": "application/json" } : {}, body: route.method === "POST" ? "{}" : undefined }));
}

test("every teacher API route answers 401 without a session", async () => {
  stubAuth([]);
  for (const route of ROUTES) {
    const res = await call(route);
    assert.equal(res.status, 401, `${route.method} ${route.path}`);
    assert.equal(((await res.json()) as { reason: string }).reason, "signed-out", `${route.method} ${route.path}`);
  }
});

test("a session Supabase Auth no longer accepts gets 401 too", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  stubAuth([]); // Supabase Auth refuses the token: signed out elsewhere, deleted, or forged.
  for (const route of ROUTES) assert.equal((await call(route, cookies)).status, 401, `${route.method} ${route.path}`);
});

test("a signed-in teacher gets through the guard", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  stubAuth([TEACHER_A]);
  const original = console.error;
  console.error = () => {}; // This test has no database, so today's allowance is unknown.
  const teach = await call(ROUTES[0], cookies).finally(() => (console.error = original));
  assert.equal(teach.status, 200);
  assert.deepEqual(await teach.json(), { configured: false, remaining: null });
  const draft = await call(ROUTES[1], cookies);
  assert.equal(draft.status, 400, "past the guard, the empty brief is refused as a bad request");
  const status = await call(ROUTES.find((r) => r.path.endsWith("/status"))!, cookies);
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), { configured: true, connected: false });
});

/* ---------- Live mode (development step 5) ---------- */

const LIVE_ID = "5e550000-0000-4000-8000-000000000001";
type LiveHandler = (request: ReturnType<typeof makeRequest>, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
const LIVE: { path: string; method: "GET" | "POST"; load: () => Promise<Record<string, unknown>> }[] = [
  { path: "/api/live/start", method: "POST", load: () => import("@/app/api/live/start/route") },
  { path: `/api/live/${LIVE_ID}`, method: "GET", load: () => import("@/app/api/live/[id]/route") },
  { path: `/api/live/${LIVE_ID}/open`, method: "POST", load: () => import("@/app/api/live/[id]/open/route") },
  { path: `/api/live/${LIVE_ID}/close`, method: "POST", load: () => import("@/app/api/live/[id]/close/route") },
  { path: `/api/live/${LIVE_ID}/mark`, method: "POST", load: () => import("@/app/api/live/[id]/mark/route") },
  { path: `/api/live/${LIVE_ID}/marks`, method: "POST", load: () => import("@/app/api/live/[id]/marks/route") },
  { path: `/api/live/${LIVE_ID}/reveal`, method: "POST", load: () => import("@/app/api/live/[id]/reveal/route") },
  { path: `/api/live/${LIVE_ID}/end`, method: "POST", load: () => import("@/app/api/live/[id]/end/route") },
  { path: `/api/live/${LIVE_ID}/remove`, method: "POST", load: () => import("@/app/api/live/[id]/remove/route") },
  { path: `/api/live/${LIVE_ID}/csv`, method: "GET", load: () => import("@/app/api/live/[id]/csv/route") },
];

async function callLive(route: (typeof LIVE)[number], cookies?: Record<string, string>, origin = ORIGIN.origin) {
  const handler = (await route.load())[route.method] as LiveHandler;
  const headers: Record<string, string> = route.method === "POST" ? { origin, "content-type": "application/json" } : {};
  return handler(makeRequest(route.path, { method: route.method, cookies, headers, body: route.method === "POST" ? "{}" : undefined }), { params: Promise.resolve({ id: LIVE_ID }) });
}

test("every teacher live route answers 401 without a session", async () => {
  stubAuth([]);
  for (const route of LIVE) {
    const res = await callLive(route);
    assert.equal(res.status, 401, `${route.method} ${route.path}`);
    assert.equal(((await res.json()) as { reason: string }).reason, "signed-out");
  }
});

test("a signed-in teacher's live actions are refused from another site", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  stubAuth([TEACHER_A]);
  for (const route of LIVE.filter((r) => r.method === "POST")) {
    const res = await callLive(route, cookies, "https://evil.example");
    assert.equal(res.status, 403, `${route.method} ${route.path}`);
    assert.equal(((await res.json()) as { reason: string }).reason, "forbidden");
  }
});

/* ---------- the Classroom cookie belongs to one teacher ---------- */

const TOKENS = { at: "access-token", rt: "refresh-token", exp: Date.now() + 3_600_000 };

test("the sealed Classroom token opens only for the teacher it was sealed for", () => {
  const sealed = sealTokens(TOKENS, TEACHER_A.id, SECRET);
  assert.deepEqual(tokensFor(sealed, TEACHER_A.id, SECRET), TOKENS);
  assert.equal(tokensFor(sealed, TEACHER_B.id, SECRET), null, "another teacher");
  assert.equal(tokensFor(seal(TOKENS, SECRET), TEACHER_A.id, SECRET), null, "a cookie from before sign-in, with no teacher in it");
  assert.equal(tokensFor(sealed, TEACHER_A.id, "another-secret-that-is-long-enough-000000"), null, "another server secret");
});

test("teacher B can't use teacher A's Classroom cookie, and it is deleted", async () => {
  const cookiesB = await sessionCookies(TEACHER_B);
  stubAuth([TEACHER_A, TEACHER_B]);
  const funza_gc = sealTokens(TOKENS, TEACHER_A.id, SECRET);

  const status = await call(ROUTES.find((r) => r.path.endsWith("/status"))!, { ...cookiesB, funza_gc });
  assert.deepEqual(await status.json(), { configured: true, connected: false });

  const classes = await call(ROUTES.find((r) => r.path.endsWith("/classes"))!, { ...cookiesB, funza_gc });
  assert.equal(classes.status, 401);
  assert.equal(((await classes.json()) as { reason: string }).reason, "not-connected");
  const cleared = setCookies(classes).funza_gc;
  assert.match(cleared, /Max-Age=0/);
  assert.match(cleared, /Path=\/api\/lms\/google/);
});

test("teacher A still sees their own connection", async () => {
  const cookiesA = await sessionCookies(TEACHER_A);
  stubAuth([TEACHER_A]);
  const status = await call(ROUTES.find((r) => r.path.endsWith("/status"))!, { ...cookiesA, funza_gc: sealTokens(TOKENS, TEACHER_A.id, SECRET) });
  assert.deepEqual(await status.json(), { configured: true, connected: true });
});

test("disconnecting with another teacher's cookie deletes it without revoking their grant", async () => {
  const cookiesB = await sessionCookies(TEACHER_B);
  const seen = stubAuth([TEACHER_B]);
  const res = await call(ROUTES.find((r) => r.path.endsWith("/disconnect"))!, { ...cookiesB, funza_gc: sealTokens(TOKENS, TEACHER_A.id, SECRET) });
  assert.equal(res.status, 200);
  assert.match(setCookies(res).funza_gc, /Max-Age=0/);
  assert.ok(!seen.some((u) => u.includes("oauth2.googleapis.com")), "no call to Google's revoke endpoint");
});

test("a Classroom consent started by teacher A can't be finished by teacher B", async () => {
  const cookiesB = await sessionCookies(TEACHER_B);
  stubAuth([TEACHER_B]);
  const state = seal({ n: "nonce-1", r: "/settings", t: Date.now(), tid: TEACHER_A.id }, SECRET);
  const { GET } = await import("@/app/api/lms/google/callback/route");
  const res = await GET(makeRequest("/api/lms/google/callback?state=nonce-1&code=abc", { cookies: { ...cookiesB, funza_gc_state: state } }));
  assert.equal(res.status, 307);
  assert.match(res.headers.get("location")!, /\/settings\?lms=error$/);
  assert.equal(setCookies(res).funza_gc, undefined, "no token cookie is set");
});

test("the teacher who started the consent gets their answer", async () => {
  const cookiesA = await sessionCookies(TEACHER_A);
  stubAuth([TEACHER_A]);
  const state = seal({ n: "nonce-1", r: "/settings", t: Date.now(), tid: TEACHER_A.id }, SECRET);
  const { GET } = await import("@/app/api/lms/google/callback/route");
  const res = await GET(makeRequest("/api/lms/google/callback?state=nonce-1&error=access_denied", { cookies: { ...cookiesA, funza_gc_state: state } }));
  assert.match(res.headers.get("location")!, /\/settings\?lms=cancelled$/);
  assert.match(setCookies(res).funza_gc_state, /Max-Age=0/, "the state cookie is used once");
});
