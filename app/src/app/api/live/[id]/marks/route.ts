import type { NextRequest } from "next/server";
import { handleMarks } from "@/lib/live/handlers/teacher";
import { readJson, teacherRoute } from "@/lib/live/route";

export const runtime = "nodejs";

/** Changes one answer's mark, or undoes the change. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await readJson(request);
  return teacherRoute(request, params, (deps, id) => handleMarks(deps, id, body));
}
