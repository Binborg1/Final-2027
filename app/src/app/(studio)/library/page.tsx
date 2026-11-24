import { ArrowRight, BookOpen, Library, Sparkles } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Misc";
import { requireTeacher, teacherCourses } from "@/lib/auth/teacher";
import { libraryRows } from "@/lib/library/data";
import { courseTotals, filterFromParams } from "@/lib/library/model";
import { cn } from "@/lib/ui/cn";
import { LibraryBrowser } from "./LibraryBrowser";

export const metadata = { title: "Library" };

const documents = (n: number) => (n === 1 ? "document" : "documents");

/**
 * The Library: every material the teacher has approved, each with its versions
 * kept. Two steps: first a card per course with how many documents it holds, then
 * that course's documents (`?course=`). Drafts stay in Review until approved.
 */
export default async function LibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [, sp] = await Promise.all([requireTeacher({ next: "/library" }), searchParams]);
  const [{ rows, courses, waiting }, own] = await Promise.all([libraryRows(), teacherCourses()]);
  const filter = filterFromParams(sp, courses);
  const course = filter.course === "all" ? null : courses.find((c) => c.id === filter.course);

  /* ---------- step 2: one course's documents ---------- */
  if (course) {
    const list = rows.filter((r) => r.courseId === course.id);
    const fromCurriculum = !!own.find((c) => c.id === course.id)?.curriculumCourseId;
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          crumbs={[{ label: "Library", href: "/library" }, { label: course.title }]}
          title={course.title}
          summary={`${list.length} ${documents(list.length)} · approved, with each version kept`}
          actions={
            <>
              <ButtonLink variant="secondary" href={`/courses/${course.id}`} icon={BookOpen}>
                Open course
              </ButtonLink>
              {fromCurriculum ? (
                <ButtonLink href={`/make?course=${course.id}`} icon={Sparkles}>
                  Make something
                </ButtonLink>
              ) : null}
            </>
          }
        />
        {list.length === 0 ? (
          <Card className="p-6">
            <EmptyState
              icon={Library}
              title="Nothing approved in this course yet"
              action={
                <Link href="/library" className="font-semibold text-accent-ink hover:underline">
                  Back to the Library
                </Link>
              }
            >
              When you approve a material for {course.title} in Review, it’s kept here with every version.
            </EmptyState>
          </Card>
        ) : (
          <LibraryBrowser key={course.id} rows={list} initial={filter} />
        )}
      </div>
    );
  }

  /* ---------- step 1: a card per course ---------- */
  const totals = courseTotals(rows, courses);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Library"
        summary="Every material you approved, by course, with each version kept. Choose a course."
        actions={
          <ButtonLink href="/make" icon={Sparkles}>
            Make something
          </ButtonLink>
        }
      />
      {courses.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            action={
              <Link href="/courses?add=1" className="font-semibold text-accent-ink hover:underline">
                Add a course
              </Link>
            }
          >
            Materials live in a course. Add one, then what you approve shows up here.
          </EmptyState>
        </Card>
      ) : (
        <>
          {rows.length === 0 ? (
            <p className="text-body text-ink-2">
              Nothing approved yet. When you approve a material in Review, it’s kept here with every version.{" "}
              {waiting > 0 ? (
                <Link href="/" className="font-semibold text-accent-ink hover:underline">
                  {waiting} {waiting === 1 ? "draft is" : "drafts are"} waiting for review
                </Link>
              ) : null}
            </p>
          ) : null}
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {totals.map(({ course: c, count }) => {
              // The same dot colour as the course has in the sidebar and on Courses.
              const index = courses.findIndex((x) => x.id === c.id);
              return (
                <li key={c.id}>
                  <Link
                    href={`/library?course=${c.id}`}
                    className="group flex h-full flex-col gap-4 rounded-card border border-white/60 bg-surface-soft p-5 shadow-[0_8px_12px_rgb(58_36_20/0.06)] transition hover:bg-white/70"
                  >
                    <span className="flex items-center gap-2.5">
                      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", index % 2 === 0 ? "bg-accent" : "bg-sage")} />
                      <span className="min-w-0 flex-1 truncate text-card font-bold">{c.title}</span>
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className={cn("text-[40px] leading-none font-bold tabular-nums", count === 0 && "text-ink-2")}>{count}</span>
                      <span className="text-row font-medium text-ink-2">{documents(count)}</span>
                    </span>
                    <span className="mt-auto inline-flex items-center gap-1.5 text-body font-semibold text-accent-ink">
                      Open <ArrowRight aria-hidden size={16} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
