import type { NextRequest } from "next/server";
import { handleState } from "@/lib/live/handlers/phone";
import { phoneRequest, phoneRoute } from "@/lib/live/route";

export const runtime = "nodejs";

/** What a student's phone should show now. Needs the student's token. */
export async function GET(request: NextRequest) {
  const session = request.nextUrl.searchParams.get("session") ?? "";
  return phoneRoute((deps) => handleState(phoneRequest(request), session, deps));
}
