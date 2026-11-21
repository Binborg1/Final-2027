import { NextResponse, type NextRequest } from "next/server";
import { revokeToken } from "@/lib/lms/google";
import { sameOrigin } from "@/lib/origin";
import { cookieOptions, googleConfig, TOKEN_COOKIE, unseal, type GoogleTokens } from "@/lib/lms/session";

export const runtime = "nodejs";

/** Revokes the grant at Google and deletes the cookie. */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, reason: "forbidden", message: "Cross-site request refused." }, { status: 403 });
  const cfg = googleConfig();
  const tokens = cfg ? unseal<GoogleTokens>(request.cookies.get(TOKEN_COOKIE)?.value, cfg.secret) : null;
  if (tokens) await revokeToken(tokens.rt ?? tokens.at);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete({ name: TOKEN_COOKIE, path: cookieOptions(request.url, 0).path });
  return res;
}
