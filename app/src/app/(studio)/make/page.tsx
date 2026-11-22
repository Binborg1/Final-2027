import { requireTeacher, teacherCourses } from "@/lib/auth/teacher";
import { MakeBrief } from "./MakeBrief";

export const metadata = { title: "Make" };

/** F3 Make: the brief. Drafting goes through /api/teach; drafts stay in this browser until step 4. */
export default async function MakePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireTeacher({ next: "/make" });
  const [courses, sp] = await Promise.all([teacherCourses(), searchParams]);
  const prompt = typeof sp.prompt === "string" ? sp.prompt.slice(0, 500) : "";
  const courseId = typeof sp.course === "string" ? sp.course : null;
  return <MakeBrief courses={courses.filter((c) => c.curriculumCourseId)} initialPrompt={prompt} initialCourseId={courseId} />;
}
