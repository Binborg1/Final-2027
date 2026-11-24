import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Misc";
import { requireTeacher } from "@/lib/auth/teacher";
import { courseList } from "@/lib/courses/data";
import { loadDataset } from "@/lib/curriculum/dataset";
import { gradeOfLevel } from "@/lib/teachers/labels";
import { cn } from "@/lib/ui/cn";
import { AddCourse } from "./AddCourse";

export const metadata = { title: "Courses" };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** P1 Courses: the teacher's courses, and "Add a course". Everything lives in a course. */
export default async function CoursesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ teacher }, sp] = await Promise.all([requireTeacher({ next: "/courses" }), searchParams]);
  const courses = await courseList();
  const curriculum = loadDataset().summaries.map((s) => ({ id: s.id, name: s.name, subject: s.subject, levels: s.levels, units: s.units }));
  const existing = courses.filter((c) => c.curriculumCourseId && c.level).map((c) => `${c.curriculumCourseId}:${c.level}`);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Courses"
        summary="Each course holds its chapters, materials and question bank."
        actions={<AddCourse curriculum={curriculum} grades={teacher.grades} openInitially={sp.add === "1"} existing={existing} />}
      />
      {courses.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={BookOpen} title="No courses yet">
            Add a course from the Saskatchewan curriculum, or one of your own.
          </EmptyState>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c, i) => {
            const grade = gradeOfLevel(c.level);
            return (
              <li key={c.id}>
                <Link href={`/courses/${c.id}`} className="group flex h-full flex-col gap-3 rounded-card border border-white/60 bg-surface-soft p-5 shadow-[0_8px_12px_rgb(58_36_20/0.06)] transition hover:bg-white/70">
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", i % 2 === 0 ? "bg-accent" : "bg-sage")} />
                    <span className="min-w-0 flex-1 truncate text-card font-bold">{c.title}</span>
                    {grade ? <Tag>Grade {grade}</Tag> : null}
                  </span>
                  <span className="text-body text-ink-2">
                    {plural(c.chapters, "chapter")} · {plural(c.materials, "material")}
                    {c.curriculumCourseId ? "" : " · Your own course"}
                  </span>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-body font-semibold text-accent-ink">
                    Open course <ArrowRight aria-hidden size={16} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
