import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { errorCode, finishSignIn, signInFailed } from "@/lib/auth/finish";
import { routeClient } from "@/lib/db/route";

export const runtime = "nodejs";

const TYPES: EmailOtpType[] = ["email", "magiclink", "signup"];

/**
 * The email sign-in link lands here with a one-time token hash (set up in the
 * Supabase email templates). Unlike a code, it works in any browser, so a teacher
 * can ask for the link on a Chromebook and open it on their phone.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("error") || params.get("error_code")) {
    return signInFailed(request, errorCode({ code: params.get("error_code"), error: params.get("error"), message: params.get("error_description") }));
  }
  const tokenHash = params.get("token_hash");
  const type = TYPES.find((t) => t === params.get("type"));
  if (!tokenHash || !type) return signInFailed(request, "failed");

  const { supabase, respond } = routeClient(request);
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) return respond(signInFailed(request, errorCode(error)));
  return respond(await finishSignIn(request, supabase, data.user, params.get("next")));
}
