import type { NextRequest } from "next/server";
import { handleRemove } from "@/lib/live/handlers/teacher";
import { joinOrigin, readJson, teacherRoute } from "@/lib/live/route";

export const runtime = "nodejs";

/** Removes a student from the session (their answers go with them). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await readJson(request);
  return teacherRoute(request, params, (deps, id) => handleRemove(deps, id, body, joinOrigin(request)));
}
