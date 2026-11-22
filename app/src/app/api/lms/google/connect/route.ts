import { NextResponse, type NextRequest } from "next/server";
import { teacherForRequest, unauthorized } from "@/lib/auth/api";
import { authUrl } from "@/lib/lms/google";
import { cookieOptions, googleConfig, newNonce, safeReturn, seal, STATE_COOKIE, type ConnectState } from "@/lib/lms/session";

export const runtime = "nodejs";

/**
 * Starts Google's consent screen. The state cookie ties the answer to this browser
 * and to the teacher who started it, and records where to return.
 */
export async function GET(request: NextRequest) {
  const teacher = await teacherForRequest(request);
  if (!teacher) return unauthorized();
  const returnTo = safeReturn(request.nextUrl.searchParams.get("returnTo"));
  const cfg = googleConfig();
  if (!cfg) return teacher.respond(NextResponse.redirect(new URL(`${returnTo}${returnTo.includes("?") ? "&" : "?"}lms=not-configured`, request.url)));
  const nonce = newNonce();
  const redirectUri = new URL("/api/lms/google/callback", request.url).toString();
  const res = NextResponse.redirect(authUrl(cfg, redirectUri, nonce));
  const state: ConnectState = { n: nonce, r: returnTo, t: Date.now(), tid: teacher.id };
  res.cookies.set(STATE_COOKIE, seal(state, cfg.secret), cookieOptions(request.url, 15 * 60));
  return teacher.respond(res);
}
