import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTeacher, teacherCourses } from "@/lib/auth/teacher";
import { loadDataset } from "@/lib/curriculum/dataset";
import { googleConfig } from "@/lib/lms/session";
import { SetupWizard } from "./SetupWizard";

export const metadata: Metadata = { title: "Set up Funza" };

/**
 * A2 First-time setup. A teacher who left halfway comes back here (every other
 * teacher page redirects while setup_done_at is empty) and finds their answers kept.
 */
export default async function SetupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { teacher } = await requireTeacher({ next: "/setup", allowSetup: true });
  if (teacher.setupDone) redirect("/");
  const [courses, sp] = await Promise.all([teacherCourses(), searchParams]);
  const curriculum = loadDataset().summaries.map((s) => ({ id: s.id, name: s.name, subject: s.subject, levels: s.levels, units: s.units }));
  const chosen = courses.filter((c) => c.curriculumCourseId && c.level).map((c) => ({ curriculumCourseId: c.curriculumCourseId!, level: c.level! }));

  const profileDone = !!teacher.name && teacher.grades.length > 0 && teacher.subjects.length > 0;
  const requested = Number(sp.step);
  const step = [1, 2, 3].includes(requested) ? requested : !profileDone ? 1 : chosen.length === 0 ? 2 : 3;

  return (
    <main className="flex min-h-dvh items-center justify-center px-3 py-6 sm:px-6 lg:py-[70px]">
      <SetupWizard
        initialStep={profileDone || step === 1 ? step : 1}
        profile={{ name: teacher.name, school: teacher.school, grades: teacher.grades, subjects: teacher.subjects }}
        email={teacher.email}
        chosen={chosen}
        curriculum={curriculum}
        classroom={{ configured: !!googleConfig(), result: typeof sp.lms === "string" ? sp.lms : null }}
      />
    </main>
  );
}
