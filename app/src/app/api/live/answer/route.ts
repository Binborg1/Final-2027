import type { NextRequest } from "next/server";
import { handleAnswer } from "@/lib/live/handlers/phone";
import { phoneRequest, phoneRoute, readJson } from "@/lib/live/route";

export const runtime = "nodejs";

/** Saves a student's answer to one question; saving again replaces it, until time is up. Needs the student's token. */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  return phoneRoute((deps) => handleAnswer(phoneRequest(request), body, deps));
}
