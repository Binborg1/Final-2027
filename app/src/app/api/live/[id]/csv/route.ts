import { NextResponse, type NextRequest } from "next/server";
import { handleCsv } from "@/lib/live/handlers/teacher";
import { teacherRoute } from "@/lib/live/route";

export const runtime = "nodejs";

/** The session's results as a CSV file (FR-15). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let file: { csv: string; filename: string } | null = null;
  const res = await teacherRoute(request, params, async (deps, id) => {
    const r = await handleCsv(deps, id);
    if (r.csv && r.filename) file = { csv: r.csv, filename: r.filename };
    return r;
  });
  if (!file || res.status !== 200) return res;
  const { csv, filename } = file as { csv: string; filename: string };
  const out = new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
  for (const c of res.cookies.getAll()) out.cookies.set(c);
  return out;
}
