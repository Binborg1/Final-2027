import type { NextRequest } from "next/server";
import { handleEnd } from "@/lib/live/handlers/teacher";
import { teacherRoute } from "@/lib/live/route";

export const runtime = "nodejs";

/** Ends the session: counts are kept, the bank learns, and the results open. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return teacherRoute(request, params, (deps, id) => handleEnd(deps, id));
}
