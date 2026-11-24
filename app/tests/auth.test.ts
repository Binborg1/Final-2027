import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { User } from "@supabase/supabase-js";
import { authMessage, passwordProblem } from "@/lib/auth/email-sign-in";
import { safeNext, safeReturn } from "@/lib/auth/redirect";
import { routeKind } from "@/lib/auth/routes";
import { firstName, initials, teacherName } from "@/lib/auth/teacher-model";
import { makeRequest, restoreFetch, sessionCookies, setCookies, stubAuth, TEACHER_A, setTestEnv } from "./helpers/auth";

setTestEnv();
afterEach(() => restoreFetch());

/* ---------- which pages need a teacher ---------- */

test("student pages, the sign-in flow and the public APIs stay public", () => {
  for (const path of ["/sign-in", "/auth/callback", "/auth/confirm", "/auth/sign-out", "/join", "/join/K7QM4P", "/play/abc", "/play/abc/result", "/c/abcdefghijklmnop", "/api/health", "/api/curriculum", "/api/curriculum/courses/sk-63", "/api/curriculum/search"]) {
    assert.equal(routeKind(path), "public", path);
  }
});

test("teacher pages need a session, and other APIs answer for themselves", () => {
  for (const path of ["/", "/make", "/make/r-1", "/setup", "/settings", "/new-password", "/courses", "/joiner", "/cards", "/players", "/live", "/live/new", "/live/x", "/live/x/screen", "/live/x/results"]) assert.equal(routeKind(path), "teacher-page", path);
  for (const path of ["/api/teach", "/api/lms/google/status", "/api/lms/google/callback"]) assert.equal(routeKind(path), "api", path);
});

/* ---------- where to go after signing in ---------- */

test("only same-site paths are allowed as a return address", () => {
  assert.equal(safeReturn("/make?kind=quiz#top"), "/make?kind=quiz#top");
  for (const bad of ["//evil.example/x", "/\\evil.example", "https://evil.example", "/%2F%2Fevil.example", "/%5Cevil.example", "/\t/evil.example", "/\n/evil.example", "javascript:alert(1)", "", undefined, 42, "/" + "a".repeat(400)]) {
    assert.equal(safeReturn(bad), "/", String(bad));
  }
});

test("after sign-in, the sign-in flow and APIs are never the destination", () => {
  assert.equal(safeNext("/make/r-1"), "/make/r-1");
  for (const loop of ["/sign-in", "/sign-in?next=/make", "/auth/callback?code=1", "/auth", "/api/teach"]) assert.equal(safeNext(loop), "/", loop);
});

/* ---------- names ---------- */

test("the teacher's name comes from Google, and initials and first name follow from it", () => {
  assert.equal(teacherName({ full_name: "  Jordan   Bergen " }), "Jordan Bergen");
  assert.equal(teacherName({ name: "Sam" }), "Sam");
  assert.equal(teacherName({}), "", "email sign-ins give their name in setup");
  assert.equal(initials({ name: "Jordan Bergen", email: null }), "JB");
  assert.equal(initials({ name: "", email: "sam@school.ca" }), "S");
  assert.equal(firstName({ name: "", email: "sam@school.ca" }), "sam");
});

/* ---------- the proxy ---------- */

test("the proxy sends a signed-out visitor on a teacher page to sign-in, keeping where they were going", async () => {
  stubAuth([]);
  const { proxy } = await import("@/proxy");
  const make = await proxy(makeRequest("/make?kind=quiz"));
  assert.equal(make.status, 307);
  assert.equal(make.headers.get("location"), "http://localhost:3000/sign-in?next=%2Fmake%3Fkind%3Dquiz");
  const home = await proxy(makeRequest("/"));
  assert.equal(home.headers.get("location"), "http://localhost:3000/sign-in", "no next for Home");
});

test("the proxy lets public pages and API routes through without a session", async () => {
  stubAuth([]);
  const { proxy } = await import("@/proxy");
  for (const path of ["/sign-in", "/auth/callback?code=x", "/join", "/play/abc", "/c/abcdefghijklmnop", "/api/health", "/api/curriculum/courses/sk-63", "/api/teach"]) {
    const res = await proxy(makeRequest(path));
    assert.equal(res.headers.get("location"), null, path);
    assert.equal(res.headers.get("x-middleware-next"), "1", path);
  }
});

test("the proxy lets a signed-in teacher through", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  stubAuth([TEACHER_A]);
  const { proxy } = await import("@/proxy");
  const res = await proxy(makeRequest("/make", { cookies }));
  assert.equal(res.headers.get("location"), null);
  assert.equal(res.headers.get("x-middleware-next"), "1");
});

/* ---------- the sign-in routes ---------- */

test("provider errors and missing codes go back to sign-in with a short code, never the provider's text", async () => {
  const callback = await import("@/app/auth/callback/route");
  const confirm = await import("@/app/auth/confirm/route");
  const cases: [Promise<Response>, string][] = [
    [callback.GET(makeRequest("/auth/callback?error=access_denied&error_description=The+user+denied")), "cancelled"],
    [callback.GET(makeRequest("/auth/callback?error=server_error&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired")), "expired"],
    [callback.GET(makeRequest("/auth/callback")), "failed"],
    [confirm.GET(makeRequest("/auth/confirm?token_hash=abc&type=recovery")), "failed"],
    [confirm.GET(makeRequest("/auth/confirm?type=email")), "failed"],
    [confirm.GET(makeRequest("/auth/confirm?token_hash=abc&type=magiclink")), "failed"],
  ];
  for (const [pending, code] of cases) {
    const res = await pending;
    assert.equal(res.status, 307);
    assert.equal(res.headers.get("location"), `http://localhost:3000/sign-in?error=${code}`);
  }
});

function fakeDb(row: { setup_done_at: string | null }) {
  const full = { id: TEACHER_A.id, name: "Test Teacher", school: "", grades: [], subjects: [], created_at: "", updated_at: "", ...row };
  return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: full, error: null }) }) }) }) } as never;
}
const user = { id: TEACHER_A.id, email: TEACHER_A.email, app_metadata: {}, user_metadata: {} } as unknown as User;

test("after sign-in a teacher lands on next, on Home instead of another site, or on setup if it isn't finished", async () => {
  const { finishSignIn } = await import("@/lib/auth/finish");
  const req = makeRequest("/auth/callback?code=x");
  const done = fakeDb({ setup_done_at: "2026-11-21T00:00:00Z" });
  assert.equal((await finishSignIn(req, done, user, "/make")).headers.get("location"), "http://localhost:3000/make");
  assert.equal((await finishSignIn(req, done, user, "//evil.example/steal")).headers.get("location"), "http://localhost:3000/");
  assert.equal((await finishSignIn(req, done, user, "https://evil.example")).headers.get("location"), "http://localhost:3000/");
  assert.equal((await finishSignIn(req, fakeDb({ setup_done_at: null }), user, "/make")).headers.get("location"), "http://localhost:3000/setup");
});

test("a password reset goes to the new-password page, even before setup is finished", async () => {
  const { finishSignIn } = await import("@/lib/auth/finish");
  const req = makeRequest("/auth/confirm?token_hash=x&type=recovery");
  const res = await finishSignIn(req, fakeDb({ setup_done_at: null }), user, "/new-password", { skipSetup: true });
  assert.equal(res.headers.get("location"), "http://localhost:3000/new-password");
});

/* ---------- email and password ---------- */

test("a password needs 8 to 72 characters and can't be only spaces", () => {
  assert.equal(passwordProblem("seven77"), "Use at least 8 characters.");
  assert.equal(passwordProblem("        "), "A password can’t be only spaces.");
  assert.equal(passwordProblem("a".repeat(73)), "Use at most 72 characters.");
  assert.equal(passwordProblem("é".repeat(37)), "Use at most 72 characters.", "the limit counts bytes, as bcrypt does");
  assert.equal(passwordProblem("eight888"), null);
  assert.equal(passwordProblem("a".repeat(72)), null);
});

test("sign-in errors become plain sentences, never the provider's text", () => {
  assert.match(authMessage({ code: "invalid_credentials", status: 400 }, "sign-in"), /don’t match/);
  assert.match(authMessage({ code: "email_not_confirmed" }, "sign-in"), /Confirm your email/);
  assert.match(authMessage({ code: "user_already_exists" }, "create"), /already a Funza account/);
  assert.match(authMessage({ code: "weak_password" }, "create"), /at least 8 characters/);
  assert.match(authMessage({ status: 429 }, "forgot"), /Too many tries/);
  assert.match(authMessage({ code: "over_email_send_rate_limit", status: 429 }, "forgot"), /Too many emails/);
  assert.match(authMessage({ code: "something_new" }, "create"), /couldn’t create the account/);
  assert.match(authMessage({ code: "something_new" }, "forgot"), /couldn’t send the email/);
  assert.match(authMessage({}, "sign-in"), /Sign-in didn’t work/);
});

/* ---------- sign-out ---------- */

test("sign-out refuses other sites", async () => {
  const { POST } = await import("@/app/auth/sign-out/route");
  const res = await POST(makeRequest("/auth/sign-out", { method: "POST", headers: { origin: "https://evil.example" } }));
  assert.equal(res.status, 403);
});

test("sign-out ends the session and deletes both Classroom cookies", async () => {
  const cookies = await sessionCookies(TEACHER_A);
  stubAuth([TEACHER_A]);
  const { POST } = await import("@/app/auth/sign-out/route");
  const res = await POST(makeRequest("/auth/sign-out", { method: "POST", headers: { origin: "http://localhost:3000" }, cookies: { ...cookies, funza_gc: "sealed", funza_gc_state: "sealed" } }));
  assert.equal(res.status, 303);
  assert.equal(res.headers.get("location"), "http://localhost:3000/sign-in?signed-out=1");
  const set = setCookies(res);
  for (const name of Object.keys(cookies)) assert.match(set[name] ?? "", /Max-Age=0/, `${name} is cleared`);
  for (const name of ["funza_gc", "funza_gc_state"]) {
    assert.match(set[name] ?? "", /Max-Age=0/, `${name} is cleared`);
    assert.match(set[name] ?? "", /Path=\/api\/lms\/google/, `${name} is cleared at its own path`);
  }
});
