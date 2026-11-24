import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { errorCode, exchangeCode, finishSignIn, signInFailed } from "@/lib/auth/finish";
import { routeClient } from "@/lib/db/route";

export const runtime = "nodejs";

const NEW_PASSWORD = "/new-password";
const TYPES: EmailOtpType[] = ["email", "signup", "recovery"];

/**
 * Links in Funza's two emails, "Confirm signup" after Create account and "Reset
 * password" after Forgot password, land here in one of two ways:
 * - Funza's own email templates send a one-time token hash (type=email or
 *   type=recovery). A token hash works in any browser, so a teacher can ask on a
 *   Chromebook and open the email on their phone. Supabase lets a project edit
 *   its templates only once it has its own email sender (custom SMTP).
 * - Supabase's default templates check the link at Supabase and come back with a
 *   one-time code instead. A code works only in the browser that asked, because
 *   it needs that browser's PKCE verifier cookie; any other browser is told so.
 * A reset always goes on to /new-password, even before setup is finished.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("error") || params.get("error_code")) {
    return signInFailed(request, errorCode({ code: params.get("error_code"), error: params.get("error"), message: params.get("error_description") }));
  }
  const tokenHash = params.get("token_hash");
  const type = TYPES.find((t) => t === params.get("type"));
  const code = params.get("code");
  const otp = tokenHash && type ? { type, token_hash: tokenHash } : null;
  if (!otp && !code) return signInFailed(request, "failed");

  const { supabase, respond } = routeClient(request);
  const { data, error } = otp ? await supabase.auth.verifyOtp(otp) : await exchangeCode(supabase, code ?? "", params);
  if (error || !data.user) return respond(signInFailed(request, errorCode(error)));
  // A token says what it is for. A code doesn't, so the page the reset asked to
  // come back to says it: Forgot password always asks for /new-password.
  const recovery = otp ? otp.type === "recovery" : params.get("next") === NEW_PASSWORD;
  return respond(await finishSignIn(request, supabase, data.user, recovery ? NEW_PASSWORD : params.get("next"), { skipSetup: recovery }));
}
