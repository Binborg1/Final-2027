import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/lms/google";
import { TOKEN_MAX_AGE } from "@/lib/lms/route";
import { cookieOptions, googleConfig, safeReturn, seal, STATE_COOKIE, TOKEN_COOKIE, unseal } from "@/lib/lms/session";

export const runtime = "nodejs";

function back(request: NextRequest, path: string, result: string) {
  const url = new URL(path, request.url);
  url.searchParams.set("lms", result);
  return url;
}

/** Google redirects here after consent. Errors become a plain result on the page the teacher came from. */
export async function GET(request: NextRequest) {
  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(back(request, "/", "not-configured"));
  const params = request.nextUrl.searchParams;
  const state = unseal<{ n: string; r: string; t: number }>(request.cookies.get(STATE_COOKIE)?.value, cfg.secret);
  const returnTo = safeReturn(state?.r);
  const finish = (result: string) => {
    const res = NextResponse.redirect(back(request, returnTo, result));
    res.cookies.delete({ name: STATE_COOKIE, path: cookieOptions(request.url, 0).path });
    return res;
  };
  if (!state || state.n !== params.get("state") || Date.now() - state.t > 15 * 60 * 1000) return finish("error");
  const error = params.get("error");
  if (error) return finish(error === "access_denied" ? "cancelled" : error === "admin_policy_enforced" || error === "org_internal" ? "blocked" : "error");
  const code = params.get("code");
  if (!code) return finish("error");
  try {
    const tokens = await exchangeCode(cfg, code, new URL("/api/lms/google/callback", request.url).toString());
    const res = finish("connected");
    res.cookies.set(TOKEN_COOKIE, seal(tokens, cfg.secret), cookieOptions(request.url, TOKEN_MAX_AGE));
    return res;
  } catch {
    return finish("error");
  }
}
