// TEMPORARY preview for screenshots. Delete before committing.
import { loadDataset } from "@/lib/curriculum/dataset";
import { AddCourse } from "./AddCoursePreview";

export default async function Preview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const curriculum = loadDataset().summaries.map((s) => ({ id: s.id, name: s.name, subject: s.subject, levels: s.levels, units: s.units }));
  return (
    <main className="mx-auto max-w-5xl p-10">
      <AddCourse curriculum={curriculum} grades={[10, 11, 12]} openInitially existing={[]} then={sp.then === "make" ? "make" : undefined} />
    </main>
  );
}
