import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/redirect";
import { ensureTeacherRow } from "@/lib/auth/teacher-row";
import type { Database } from "@/lib/db/types";

/**
 * The end of both sign-in routes (Google callback, and the confirm and reset
 * links from email): make sure the teacher row exists, then go to setup if it
 * isn't finished, or to `next`. A password reset skips setup and goes straight to
 * /new-password; setup follows once the new password is saved.
 * Failures go back to sign-in with a short code the page turns into a sentence;
 * provider text never reaches the page.
 */

export type SignInError = "cancelled" | "expired" | "other-browser" | "failed";

export function signInFailed(request: NextRequest, code: SignInError) {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}

/** Maps a Supabase Auth error (from the URL or from the exchange) to one of our codes. */
export function errorCode(e: { code?: string | null; error?: string | null; message?: string | null } | null | undefined): SignInError {
  const code = `${e?.code ?? ""} ${e?.error ?? ""}`.toLowerCase();
  const message = (e?.message ?? "").toLowerCase();
  if (code.includes("access_denied")) return "cancelled";
  if (code.includes("otp_expired") || message.includes("expired")) return "expired";
  if (code.includes("bad_code_verifier") || code.includes("flow_state") || message.includes("code verifier")) return "other-browser";
  return "failed";
}

/**
 * Swaps a one-time sign-in code for a session. It needs the PKCE verifier cookie
 * the browser kept when sign-in started, so a code works only in that browser.
 * When Supabase names the flow in the link (`sb_flow_id`), that flow's verifier is
 * used; otherwise the most recent one.
 */
export function exchangeCode(supabase: SupabaseClient<Database>, code: string, params: URLSearchParams) {
  const flowId = params.get("sb_flow_id");
  return supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
}

export async function finishSignIn(request: NextRequest, supabase: SupabaseClient<Database>, user: User, next: string | null, options: { skipSetup?: boolean } = {}) {
  try {
    const row = await ensureTeacherRow(supabase, user);
    const to = row.setup_done_at || options.skipSetup ? safeNext(next) : "/setup";
    return NextResponse.redirect(new URL(to, request.url));
  } catch (error) {
    console.error("Sign-in: could not prepare the teacher row:", error instanceof Error ? error.message : "unknown error");
    return signInFailed(request, "failed");
  }
}
