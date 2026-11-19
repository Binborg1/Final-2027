import { NextResponse } from "next/server";
import { OUTCOME_ID } from "@/lib/curriculum/catalog";
import { coursesWithOutcomes } from "@/lib/curriculum/dataset";

export const runtime = "nodejs";

/** The courses holding the given outcome ids, so the browser can show resources made from them. */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => OUTCOME_ID.test(s))
    .slice(0, 40);
  return NextResponse.json({ ok: true, courses: ids.length > 0 ? coursesWithOutcomes(ids) : [] });
}
