import { NextResponse } from "next/server";
import { loadDataset } from "@/lib/curriculum/dataset";

export const runtime = "nodejs";

/** The list of imported Saskatchewan Grade 10–12 courses, without their outcomes. */
export async function GET() {
  const { dataset, summaries } = loadDataset();
  return NextResponse.json(
    { importedOn: dataset.importedOn, sources: dataset.sources, statusMeaning: dataset.statusMeaning, csvMeaning: dataset.csvMeaning, courses: summaries },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
