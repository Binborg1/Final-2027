import { NextResponse } from "next/server";
import { searchOutcomes } from "@/lib/curriculum/dataset";

export const runtime = "nodejs";

/** Searches every imported outcome by code, wording, unit or course name. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 120);
  const grade = Number(url.searchParams.get("grade"));
  const subject = url.searchParams.get("subject")?.slice(0, 80) || null;
  const courseId = url.searchParams.get("course")?.slice(0, 20) || null;
  const result = searchOutcomes(q, { grade: [10, 11, 12].includes(grade) ? grade : null, subject, courseId });
  return NextResponse.json({ ok: true, ...result });
}
