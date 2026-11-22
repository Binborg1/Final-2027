import type { NextRequest } from "next/server";
import { errorCode, finishSignIn, signInFailed } from "@/lib/auth/finish";
import { routeClient } from "@/lib/db/route";

export const runtime = "nodejs";

/**
 * Google (and an email link opened in the same browser) come back here with a
 * one-time code. Supabase swaps it for a session using the PKCE verifier cookie
 * set when sign-in started, so a code is useless in any other browser.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("error") || params.get("error_code")) {
    return signInFailed(request, errorCode({ code: params.get("error_code"), error: params.get("error"), message: params.get("error_description") }));
  }
  const code = params.get("code");
  if (!code) return signInFailed(request, "failed");

  const { supabase, respond } = routeClient(request);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return respond(signInFailed(request, errorCode(error)));
  return respond(await finishSignIn(request, supabase, data.user, params.get("next")));
}
