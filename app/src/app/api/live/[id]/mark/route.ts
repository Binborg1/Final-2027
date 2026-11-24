import type { NextRequest } from "next/server";
import { isObj } from "@/lib/live/handlers/result";
import { handleMark } from "@/lib/live/handlers/mark";
import { markDeps, readJson, teacherRoute } from "@/lib/live/route";

export const runtime = "nodejs";
/** Up to four questions are marked at once; each AI call is limited to two minutes. */
export const maxDuration = 150;

/** Funza marks the short answers, without names. {retry: true} also retries questions it couldn't mark. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await readJson(request);
  return teacherRoute(request, params, (deps, id) => handleMark(markDeps(deps), id, isObj(body) && body.retry === true));
}
