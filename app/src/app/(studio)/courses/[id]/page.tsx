import { Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { requireTeacher } from "@/lib/auth/teacher";
import { courseDetail } from "@/lib/courses/data";
import { idSchema } from "@/lib/courses/model";
import { Materials } from "../Materials";
import { CourseChapters } from "./CourseChapters";
import { CourseSettings } from "./CourseSettings";

export const metadata = { title: "Course" };

/** P1 A course: its chapters (from the curriculum units the first time it opens) and its materials. */
export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTeacher({ next: `/courses/${encodeURIComponent(id)}` });
  if (!idSchema.safeParse(id).success) notFound();
  const detail = await courseDetail(id);
  if (!detail) notFound();
  const { course, chapters, materials } = detail;
  const makeHref = course.curriculumCourseId ? `/make?course=${course.id}` : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={[{ label: "Courses", href: "/courses" }, { label: course.title }]}
        title={course.title}
        summary={`${chapters.length} chapter${chapters.length === 1 ? "" : "s"} · ${course.curriculumCourseId ? "From the Saskatchewan curriculum" : "Your own course"}`}
        actions={makeHref ? <ButtonLink href={makeHref} icon={Sparkles}>Make something</ButtonLink> : null}
      />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <CourseChapters courseId={course.id} chapters={chapters.map((c) => ({ id: c.id, title: c.title, outcomes: c.outcomeRefs.length, fromCurriculum: c.sourceKind !== "custom" }))} />
        <Materials materials={materials} makeHref={makeHref} empty="Notes, slides, quizzes and exams you make for this course appear here." />
      </div>
      <CourseSettings courseId={course.id} title={course.title} />
    </div>
  );
}
