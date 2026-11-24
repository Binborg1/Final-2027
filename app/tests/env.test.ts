import assert from "node:assert/strict";
import { test } from "node:test";
import { checkEnv, EnvError, publicEnvSchema } from "@/lib/env";
import { serverEnvSchema } from "@/lib/env-server";

// Made-up values in the right shapes; none of them is a real key.
const GOOD = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example-ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_madeUpForTests",
  SUPABASE_SECRET_KEY: "sb_secret_madeUpForTests0000",
};

function problemsOf(fn: () => unknown): string[] {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof EnvError, "an EnvError");
    return error.problems;
  }
  assert.fail("expected the check to fail");
}

test("a complete environment passes, and optional settings may be left out", () => {
  const env = checkEnv(serverEnvSchema, GOOD);
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, GOOD.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(env.GEMINI_API_KEY, undefined);
});

test("missing variables are listed by name, and empty values count as missing", () => {
  const problems = problemsOf(() => checkEnv(serverEnvSchema, { ...GOOD, SUPABASE_SECRET_KEY: "  ", NEXT_PUBLIC_SUPABASE_URL: undefined }));
  assert.deepEqual(problems.sort(), ["NEXT_PUBLIC_SUPABASE_URL is missing", "SUPABASE_SECRET_KEY is missing"]);
});

test("the legacy anon and service_role keys are refused", () => {
  const legacy = "eyJhbGciOiJIUzI1NiJ9.legacy-jwt-key";
  const problems = problemsOf(() =>
    checkEnv(serverEnvSchema, { ...GOOD, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: legacy, SUPABASE_SECRET_KEY: legacy }),
  );
  assert.equal(problems.length, 2);
  assert.match(problems.join("\n"), /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be the sb_publishable_/);
  assert.match(problems.join("\n"), /SUPABASE_SECRET_KEY must be the sb_secret_/);
});

test("a problem never repeats the value it found", () => {
  const secret = "sb_secrex_this-value-must-not-be-printed";
  const error = (() => {
    try {
      checkEnv(serverEnvSchema, { ...GOOD, SUPABASE_SECRET_KEY: secret, NEXT_PUBLIC_SUPABASE_URL: "not a url" });
    } catch (e) {
      return e as Error;
    }
  })();
  assert.ok(error);
  assert.doesNotMatch(error.message, /this-value-must-not-be-printed/);
  assert.doesNotMatch(error.message, /not a url/);
});

test("Classroom needs its three settings together", () => {
  const problems = problemsOf(() => checkEnv(serverEnvSchema, { ...GOOD, GOOGLE_CLIENT_ID: "123-abc.apps.googleusercontent.com" }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^GOOGLE_CLIENT_ID needs GOOGLE_CLIENT_SECRET and FUNZA_SESSION_SECRET/);
  const ok = checkEnv(serverEnvSchema, {
    ...GOOD,
    GOOGLE_CLIENT_ID: "123-abc.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "made-up",
    FUNZA_SESSION_SECRET: "x".repeat(32),
  });
  assert.equal(ok.GOOGLE_CLIENT_SECRET, "made-up");
});

test("the daily AI limit is optional, and a whole number above 0 when set", () => {
  assert.equal(checkEnv(serverEnvSchema, GOOD).FUNZA_AI_DAILY_LIMIT, undefined);
  assert.equal(checkEnv(serverEnvSchema, { ...GOOD, FUNZA_AI_DAILY_LIMIT: "25" }).FUNZA_AI_DAILY_LIMIT, 25);
  for (const bad of ["many", "0", "-5", "2.5"]) {
    assert.deepEqual(problemsOf(() => checkEnv(serverEnvSchema, { ...GOOD, FUNZA_AI_DAILY_LIMIT: bad })), ["FUNZA_AI_DAILY_LIMIT must be a whole number above 0"], bad);
  }
});

test("the public schema holds no server secret", () => {
  assert.deepEqual(Object.keys(publicEnvSchema.shape).sort(), ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_URL"]);
  for (const name of Object.keys(publicEnvSchema.shape)) assert.match(name, /^NEXT_PUBLIC_/);
});
