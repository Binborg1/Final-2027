import { NextResponse, type NextRequest } from "next/server";
import { teacherForRequest, unauthorized } from "@/lib/auth/api";
import { googleConfig, TOKEN_COOKIE, tokensFor } from "@/lib/lms/session";

export const runtime = "nodejs";

/** Whether Classroom is set up on this server and whether this teacher is connected in this browser. Never returns a token. */
export async function GET(request: NextRequest) {
  const teacher = await teacherForRequest(request);
  if (!teacher) return unauthorized();
  const cfg = googleConfig();
  const tokens = cfg ? tokensFor(request.cookies.get(TOKEN_COOKIE)?.value, teacher.id, cfg.secret) : null;
  return teacher.respond(NextResponse.json({ configured: !!cfg, connected: !!tokens }, { headers: { "Cache-Control": "no-store" } }));
}
