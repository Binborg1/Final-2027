import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { errorCode, finishSignIn, signInFailed } from "@/lib/auth/finish";
import { routeClient } from "@/lib/db/route";

export const runtime = "nodejs";

const NEW_PASSWORD = "/new-password";
const TYPES: EmailOtpType[] = ["email", "signup", "recovery"];

/**
 * Links in Funza's two emails land here with a one-time token hash (set up in the
 * Supabase email templates): "Confirm signup" (type=email) after Create account,
 * and "Reset password" (type=recovery) after Forgot password. Unlike a code, a
 * token hash works in any browser, so a teacher can ask on a Chromebook and open
 * the email on their phone. A reset link always goes on to /new-password.
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
  const recovery = type === "recovery";
  return respond(await finishSignIn(request, supabase, data.user, recovery ? NEW_PASSWORD : params.get("next"), { skipSetup: recovery }));
}
