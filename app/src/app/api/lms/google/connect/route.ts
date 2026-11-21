import { NextResponse, type NextRequest } from "next/server";
import { authUrl } from "@/lib/lms/google";
import { cookieOptions, googleConfig, newNonce, safeReturn, seal, STATE_COOKIE } from "@/lib/lms/session";

export const runtime = "nodejs";

/** Starts Google's consent screen. The state cookie ties the answer to this browser and records where to return. */
export async function GET(request: NextRequest) {
  const returnTo = safeReturn(request.nextUrl.searchParams.get("returnTo"));
  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(new URL("/?lms=not-configured", request.url));
  const nonce = newNonce();
  const redirectUri = new URL("/api/lms/google/callback", request.url).toString();
  const res = NextResponse.redirect(authUrl(cfg, redirectUri, nonce));
  res.cookies.set(STATE_COOKIE, seal({ n: nonce, r: returnTo, t: Date.now() }, cfg.secret), cookieOptions(request.url, 15 * 60));
  return res;
}
