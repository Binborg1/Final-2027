import type { NextRequest } from "next/server";
import { handleReveal } from "@/lib/live/handlers/teacher";
import { joinOrigin, readJson, teacherRoute } from "@/lib/live/route";

export const runtime = "nodejs";

/** Reveals the answers; with {questionId}, moves the projector to that question. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await readJson(request);
  return teacherRoute(request, params, (deps, id) => handleReveal(deps, id, body, joinOrigin(request)));
}
