import type { NextRequest } from "next/server";
import { handleOpen } from "@/lib/live/handlers/teacher";
import { joinOrigin, teacherRoute } from "@/lib/live/route";

export const runtime = "nodejs";

/** Starts the clock: students see every question and answer until time is up. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return teacherRoute(request, params, (deps, id) => handleOpen(deps, id, joinOrigin(request)));
}
