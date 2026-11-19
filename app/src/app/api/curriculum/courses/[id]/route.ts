import { NextResponse } from "next/server";
import { importedCourse } from "@/lib/curriculum/dataset";

export const runtime = "nodejs";

/** One course with its units, outcomes and indicators, exactly as imported. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = /^sk-\d{1,6}$/.test(id) ? importedCourse(id) : null;
  if (!course) return NextResponse.json({ ok: false, message: "No imported course has that id." }, { status: 404 });
  return NextResponse.json({ ok: true, course }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
