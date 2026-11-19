import { NextResponse, type NextRequest } from "next/server";
import { googleConfig, TOKEN_COOKIE, unseal, type GoogleTokens } from "@/lib/lms/session";

export const runtime = "nodejs";

/** Whether Classroom is set up on this server and whether this browser is connected. Never returns a token. */
export async function GET(request: NextRequest) {
  const cfg = googleConfig();
  const tokens = cfg ? unseal<GoogleTokens>(request.cookies.get(TOKEN_COOKIE)?.value, cfg.secret) : null;
  return NextResponse.json({ configured: !!cfg, connected: !!tokens });
}
