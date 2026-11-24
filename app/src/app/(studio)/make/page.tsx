import { requireTeacher, teacherCourses } from "@/lib/auth/teacher";
import { ensureChapters, makeChapters, makeSources } from "@/lib/courses/data";
import type { ChapterChoice } from "@/lib/courses/model";
import { MakeBrief } from "./MakeBrief";

export const metadata = { title: "Make" };

/** F3 Make: the brief, from a course's chapters. Drafting goes through /api/teach; the draft is saved to the database. */
export default async function MakePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireTeacher({ next: "/make" });
  await ensureChapters();
  const [courses, byCourse, sources, sp] = await Promise.all([teacherCourses(), makeChapters(), makeSources(), searchParams]);
  const prompt = typeof sp.prompt === "string" ? sp.prompt.slice(0, 500) : "";
  const courseId = typeof sp.course === "string" ? sp.course : null;
  const chapterId = typeof sp.chapter === "string" ? sp.chapter : null;
  const chapters: Record<string, ChapterChoice[]> = Object.fromEntries(Object.entries(byCourse).map(([id, list]) => [id, list.map((c) => ({ id: c.id, title: c.title, outcomeRefs: c.outcomeRefs }))]));
  return <MakeBrief courses={courses.filter((c) => c.curriculumCourseId)} chapters={chapters} sources={sources} initialPrompt={prompt} initialCourseId={courseId} initialChapterId={chapterId} />;
}
