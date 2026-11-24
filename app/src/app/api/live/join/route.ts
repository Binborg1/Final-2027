import type { NextRequest } from "next/server";
import { handleJoin } from "@/lib/live/handlers/phone";
import { phoneRequest, phoneRoute, readJson } from "@/lib/live/route";

export const runtime = "nodejs";

/** A student joins with the code, their name and (if asked) their student number. Public: no account. */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  return phoneRoute((deps) => handleJoin(phoneRequest(request), body, deps));
}
