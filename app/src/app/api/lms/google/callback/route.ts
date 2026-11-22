import { NextResponse, type NextRequest } from "next/server";
import { teacherForRequest, unauthorized } from "@/lib/auth/api";
import { exchangeCode } from "@/lib/lms/google";
import { TOKEN_MAX_AGE } from "@/lib/lms/route";
import { cookieOptions, googleConfig, safeReturn, sealTokens, STATE_COOKIE, TOKEN_COOKIE, unseal, type ConnectState } from "@/lib/lms/session";

export const runtime = "nodejs";

function back(request: NextRequest, path: string, result: string) {
  const url = new URL(path, request.url);
  url.searchParams.set("lms", result);
  return url;
}

/**
 * Google redirects here after consent. The answer is accepted only by the browser
 * and the teacher that started it; errors become a plain result on the page the
 * teacher came from.
 */
export async function GET(request: NextRequest) {
  const teacher = await teacherForRequest(request);
  if (!teacher) return unauthorized();
  const cfg = googleConfig();
  if (!cfg) return teacher.respond(NextResponse.redirect(back(request, "/", "not-configured")));
  const params = request.nextUrl.searchParams;
  const state = unseal<ConnectState>(request.cookies.get(STATE_COOKIE)?.value, cfg.secret);
  const returnTo = safeReturn(state?.r);
  const finish = (result: string) => {
    const res = NextResponse.redirect(back(request, returnTo, result));
    res.cookies.set(STATE_COOKIE, "", cookieOptions(request.url, 0));
    return teacher.respond(res);
  };
  if (!state || state.tid !== teacher.id || state.n !== params.get("state") || Date.now() - state.t > 15 * 60 * 1000) return finish("error");
  const error = params.get("error");
  if (error) return finish(error === "access_denied" ? "cancelled" : error === "admin_policy_enforced" || error === "org_internal" ? "blocked" : "error");
  const code = params.get("code");
  if (!code) return finish("error");
  try {
    const tokens = await exchangeCode(cfg, code, new URL("/api/lms/google/callback", request.url).toString());
    const res = finish("connected");
    res.cookies.set(TOKEN_COOKIE, sealTokens(tokens, teacher.id, cfg.secret), cookieOptions(request.url, TOKEN_MAX_AGE));
    return res;
  } catch {
    return finish("error");
  }
}
