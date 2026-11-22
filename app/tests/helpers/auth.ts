// Test helpers for sign-in: a fake Supabase project, real @supabase/ssr session
// cookies, and a stubbed Supabase Auth API, so the real guard code runs offline.
import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";

export const SUPABASE_URL = "https://testproject.supabase.co";

/** Call before the code under test reads its environment. */
export function setTestEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
}

export type TestUser = { id: string; email: string };
export const TEACHER_A: TestUser = { id: "00000000-0000-4000-8000-00000000000a", email: "a@school.test" };
export const TEACHER_B: TestUser = { id: "00000000-0000-4000-8000-00000000000b", email: "b@school.test" };

const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");

/** An unsigned-looking HS256 token: Supabase sends it to /auth/v1/user, which the stub below answers. */
export function fakeJwt(user: TestUser, expiresIn = 3600) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", iat: now, exp: now + expiresIn })}.c2lnbmF0dXJl`;
}

function userJson(user: TestUser) {
  return { id: user.id, aud: "authenticated", role: "authenticated", email: user.email, app_metadata: { provider: "google" }, user_metadata: { full_name: "Test Teacher" }, created_at: "2026-11-21T00:00:00Z" };
}

const realFetch = globalThis.fetch;

/**
 * Answers Supabase Auth: /user returns the user named by the bearer token, if it
 * is one of `users`; /logout succeeds. Any other request fails the test loudly.
 * Returns the list of URLs seen.
 */
export function stubAuth(users: TestUser[]) {
  const seen: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    seen.push(url);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (url.startsWith(`${SUPABASE_URL}/auth/v1/user`)) {
      const token = headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
      const sub = (() => {
        try {
          return JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()).sub as string;
        } catch {
          return "";
        }
      })();
      const user = users.find((u) => u.id === sub);
      return user
        ? new Response(JSON.stringify(userJson(user)), { status: 200, headers: { "content-type": "application/json" } })
        : new Response(JSON.stringify({ code: 403, error_code: "bad_jwt", msg: "invalid JWT" }), { status: 403, headers: { "content-type": "application/json" } });
    }
    if (url.startsWith(`${SUPABASE_URL}/auth/v1/logout`)) return new Response(null, { status: 204 });
    throw new Error(`Unexpected network request in a test: ${url}`);
  }) as typeof fetch;
  return seen;
}

export function restoreFetch() {
  globalThis.fetch = realFetch;
}

/** The cookies @supabase/ssr writes for a signed-in user, made by the library itself. */
export async function sessionCookies(user: TestUser): Promise<Record<string, string>> {
  const jar: Record<string, string> = {};
  const previous = globalThis.fetch;
  stubAuth([user]);
  try {
    const client = createServerClient(SUPABASE_URL, "sb_publishable_test", {
      cookies: {
        getAll: () => Object.entries(jar).map(([name, value]) => ({ name, value })),
        setAll: (cookies) => {
          for (const { name, value } of cookies) {
            if (value) jar[name] = value;
            else delete jar[name];
          }
        },
      },
    });
    const { error } = await client.auth.setSession({ access_token: fakeJwt(user), refresh_token: "refresh-token" });
    if (error) throw error;
  } finally {
    globalThis.fetch = previous;
  }
  return jar;
}

export function makeRequest(url: string, init: { method?: string; cookies?: Record<string, string>; headers?: Record<string, string>; body?: string } = {}) {
  const headers = new Headers(init.headers);
  const cookie = Object.entries(init.cookies ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(new URL(url, "http://localhost:3000"), { method: init.method ?? "GET", headers, body: init.body });
}

/** Set-Cookie headers of a response, by cookie name. */
export function setCookies(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of res.headers.getSetCookie()) out[line.split("=")[0]] = line;
  return out;
}
