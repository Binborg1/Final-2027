import type { NextRequest } from "next/server";
import { handleClose } from "@/lib/live/handlers/teacher";
import { joinOrigin, teacherRoute } from "@/lib/live/route";

export const runtime = "nodejs";

/** Ends answering early (or records the end once time is up). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return teacherRoute(request, params, (deps, id) => handleClose(deps, id, joinOrigin(request)));
}
