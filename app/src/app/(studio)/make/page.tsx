import { requireTeacher, teacherCourses } from "@/lib/auth/teacher";
import { ensureChapters, makeChapters, makeSources } from "@/lib/courses/data";
import type { ChapterChoice } from "@/lib/courses/model";
import { GUID } from "@/lib/resources/sanitize";
import { templateList } from "@/lib/templates/data";
import type { MakeTemplate } from "./FormatPanel";
import { MakeBrief } from "./MakeBrief";

export const metadata = { title: "Make" };

/** F3 Make: the brief, from a course's chapters. Drafting goes through /api/teach; the draft is saved to the database. */
export default async function MakePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireTeacher({ next: "/make" });
  await ensureChapters();
  const [courses, byCourse, sources, saved, sp] = await Promise.all([teacherCourses(), makeChapters(), makeSources(), templateList(), searchParams]);
  const prompt = typeof sp.prompt === "string" ? sp.prompt.slice(0, 500) : "";
  const courseId = typeof sp.course === "string" ? sp.course : null;
  // One chapter (from a chapter page) or several (back from "New template").
  const chapterIds = [typeof sp.chapter === "string" ? sp.chapter : "", ...(typeof sp.chapters === "string" ? sp.chapters.split(",") : [])].filter((id) => GUID.test(id)).slice(0, 20);
  const templates: MakeTemplate[] = saved.flatMap((t) => (t.format ? [{ id: t.id, category: t.category, name: t.name, format: t.format, used: t.used, pins: t.pins }] : []));
  const templateId = typeof sp.template === "string" && GUID.test(sp.template) ? sp.template : null;
  const chapters: Record<string, ChapterChoice[]> = Object.fromEntries(Object.entries(byCourse).map(([id, list]) => [id, list.map((c) => ({ id: c.id, title: c.title, outcomeRefs: c.outcomeRefs }))]));
  return <MakeBrief courses={courses.filter((c) => c.curriculumCourseId)} chapters={chapters} sources={sources} templates={templates} initialPrompt={prompt} initialCourseId={courseId} initialChapterIds={chapterIds} initialTemplateId={templateId} />;
}
