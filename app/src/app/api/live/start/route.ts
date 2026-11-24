import type { NextRequest } from "next/server";
import { err } from "@/lib/live/handlers/result";
import { handleStart, startSchema } from "@/lib/live/handlers/teacher";
import { readJson, teacherRoute } from "@/lib/live/route";

export const runtime = "nodejs";

/** Creates a live session in the lobby from questions in the teacher's bank. */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  return teacherRoute(request, null, async (deps) => {
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) return err(400, "bad-request", "Choose a course, a timer and at least one question.");
    return handleStart(parsed.data, deps);
  });
}
