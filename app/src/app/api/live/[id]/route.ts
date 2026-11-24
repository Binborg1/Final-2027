import type { NextRequest } from "next/server";
import { snapshot } from "@/lib/live/handlers/teacher";
import { joinOrigin, teacherRoute } from "@/lib/live/route";

export const runtime = "nodejs";

/** The console's view of a session (names, progress, marks once time is up); ?view=screen for the projector (no names). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const view = request.nextUrl.searchParams.get("view") === "screen" ? "screen" : "console";
  return teacherRoute(request, params, (deps, id) => snapshot(deps, id, joinOrigin(request), view));
}
