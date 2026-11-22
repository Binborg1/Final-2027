import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { ApiTeacher } from "@/lib/auth/api";
import { GoogleError, refreshTokens } from "@/lib/lms/google";
import { cookieOptions, googleConfig, sealTokens, TOKEN_COOKIE, tokensFor } from "@/lib/lms/session";

export const TOKEN_MAX_AGE = 60 * 60 * 24 * 180;

/** Deletes the token cookie on a response. */
export function clearTokenCookie(request: NextRequest, res: NextResponse) {
  res.cookies.set(TOKEN_COOKIE, "", cookieOptions(request.url, 0));
  return res;
}

/**
 * Runs a Classroom call with the signed-in teacher's token: refreshes it when it
 * is about to expire, maps Google errors to plain reasons, and rewrites the cookie
 * when the token changed. A cookie that belongs to another teacher (or to no one,
 * from before sign-in) is refused and deleted. Responses are always
 * `{ ok, data }` or `{ ok: false, reason, message }`.
 */
export async function withGoogle(request: NextRequest, teacher: ApiTeacher, fn: (accessToken: string) => Promise<unknown>) {
  const cfg = googleConfig();
  if (!cfg) return teacher.respond(NextResponse.json({ ok: false, reason: "not-configured", message: "Google Classroom is not set up on this Funza server." }, { status: 503 }));
  const sealed = request.cookies.get(TOKEN_COOKIE)?.value;
  let tokens = tokensFor(sealed, teacher.id, cfg.secret);
  if (!tokens) {
    const res = NextResponse.json({ ok: false, reason: "not-connected", message: "Connect Google Classroom first." }, { status: 401 });
    return teacher.respond(sealed ? clearTokenCookie(request, res) : res);
  }
  let changed = false;
  try {
    if (tokens.exp < Date.now() + 60_000) {
      tokens = await refreshTokens(cfg, tokens);
      changed = true;
    }
    const data = await fn(tokens.at);
    const res = NextResponse.json({ ok: true, data });
    if (changed) res.cookies.set(TOKEN_COOKIE, sealTokens(tokens, teacher.id, cfg.secret), cookieOptions(request.url, TOKEN_MAX_AGE));
    return teacher.respond(res);
  } catch (error) {
    const e = error instanceof GoogleError ? error : new GoogleError("platform", "The request to Google failed.");
    const res = NextResponse.json({ ok: false, reason: e.reason, message: e.message });
    if (e.reason === "expired") clearTokenCookie(request, res);
    else if (changed) res.cookies.set(TOKEN_COOKIE, sealTokens(tokens, teacher.id, cfg.secret), cookieOptions(request.url, TOKEN_MAX_AGE));
    return teacher.respond(res);
  }
}
