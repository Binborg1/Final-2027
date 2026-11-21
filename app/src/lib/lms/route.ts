import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { GoogleError, refreshTokens } from "@/lib/lms/google";
import { cookieOptions, googleConfig, seal, TOKEN_COOKIE, unseal, type GoogleTokens } from "@/lib/lms/session";

export const TOKEN_MAX_AGE = 60 * 60 * 24 * 180;

/**
 * Runs a Classroom call with the teacher's token: refreshes it when it is about
 * to expire, maps Google errors to plain reasons, and rewrites the cookie when
 * the token changed. Responses are always `{ ok, data }` or `{ ok: false, reason, message }`.
 */
export async function withGoogle(request: NextRequest, fn: (accessToken: string) => Promise<unknown>) {
  const cfg = googleConfig();
  if (!cfg) return NextResponse.json({ ok: false, reason: "not-configured", message: "Google Classroom is not set up on this Funza server." }, { status: 503 });
  let tokens = unseal<GoogleTokens>(request.cookies.get(TOKEN_COOKIE)?.value, cfg.secret);
  if (!tokens) return NextResponse.json({ ok: false, reason: "not-connected", message: "Connect Google Classroom first." }, { status: 401 });
  let changed = false;
  try {
    if (tokens.exp < Date.now() + 60_000) {
      tokens = await refreshTokens(cfg, tokens);
      changed = true;
    }
    const data = await fn(tokens.at);
    const res = NextResponse.json({ ok: true, data });
    if (changed) res.cookies.set(TOKEN_COOKIE, seal(tokens, cfg.secret), cookieOptions(request.url, TOKEN_MAX_AGE));
    return res;
  } catch (error) {
    const e = error instanceof GoogleError ? error : new GoogleError("platform", "The request to Google failed.");
    const res = NextResponse.json({ ok: false, reason: e.reason, message: e.message });
    if (e.reason === "expired") res.cookies.delete({ name: TOKEN_COOKIE, path: cookieOptions(request.url, 0).path });
    else if (changed) res.cookies.set(TOKEN_COOKIE, seal(tokens, cfg.secret), cookieOptions(request.url, TOKEN_MAX_AGE));
    return res;
  }
}
