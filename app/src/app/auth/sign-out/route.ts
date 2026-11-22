import { NextResponse, type NextRequest } from "next/server";
import { routeClient } from "@/lib/db/route";
import { COOKIE_PATH, STATE_COOKIE, TOKEN_COOKIE } from "@/lib/lms/session";
import { sameOrigin } from "@/lib/origin";

export const runtime = "nodejs";

/**
 * Signs the teacher out of this browser: ends the Supabase session and deletes
 * the Google Classroom cookies, so the next person on a shared school computer
 * inherits neither. A form POST from Funza's own pages; other sites are refused.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, reason: "forbidden", message: "Cross-site request refused." }, { status: 403 });
  const { supabase, respond } = routeClient(request);
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) console.error("Sign-out: Supabase did not confirm:", error.message);

  const res = respond(NextResponse.redirect(new URL("/sign-in?signed-out=1", request.url), 303));
  // Whatever Supabase managed, the session cookies go (including split chunks).
  for (const { name } of request.cookies.getAll()) {
    if (/^sb-.+-auth-token(\.\d+)?$/.test(name)) res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  for (const name of [TOKEN_COOKIE, STATE_COOKIE]) res.cookies.set(name, "", { path: COOKIE_PATH, maxAge: 0, httpOnly: true, sameSite: "lax" });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
