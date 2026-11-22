import { NextResponse, type NextRequest } from "next/server";
import { teacherForRequest, unauthorized } from "@/lib/auth/api";
import { revokeToken } from "@/lib/lms/google";
import { clearTokenCookie } from "@/lib/lms/route";
import { googleConfig, TOKEN_COOKIE, tokensFor } from "@/lib/lms/session";
import { sameOrigin } from "@/lib/origin";

export const runtime = "nodejs";

/** Revokes this teacher's grant at Google and deletes the cookie. Another teacher's cookie is only deleted. */
export async function POST(request: NextRequest) {
  const teacher = await teacherForRequest(request);
  if (!teacher) return unauthorized();
  if (!sameOrigin(request)) return teacher.respond(NextResponse.json({ ok: false, reason: "forbidden", message: "Cross-site request refused." }, { status: 403 }));
  const cfg = googleConfig();
  const tokens = cfg ? tokensFor(request.cookies.get(TOKEN_COOKIE)?.value, teacher.id, cfg.secret) : null;
  if (tokens) await revokeToken(tokens.rt ?? tokens.at);
  return teacher.respond(clearTokenCookie(request, NextResponse.json({ ok: true })));
}
