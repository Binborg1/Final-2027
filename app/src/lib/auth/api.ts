import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { routeClient } from "@/lib/db/route";

/**
 * The auth check for API routes. Each route calls `teacherForRequest()` first and
 * answers `unauthorized()` when it returns null; the proxy never stands in for it.
 * Supabase Auth confirms the session (`getUser()`), so a signed-out, expired or
 * revoked session is refused, and refreshed cookies go back on the response.
 */

export type ApiTeacher = {
  id: string;
  email: string | null;
  /** Puts any refreshed auth cookies on the route's response. */
  respond<T extends NextResponse>(res: T): T;
};

export async function teacherForRequest(request: NextRequest): Promise<ApiTeacher | null> {
  const { supabase, respond } = routeClient(request);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null, respond };
}

export const unauthorized = () =>
  NextResponse.json({ ok: false, reason: "signed-out", message: "Sign in to Funza first." }, { status: 401, headers: { "Cache-Control": "no-store" } });
