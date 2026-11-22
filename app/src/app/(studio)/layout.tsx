import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SIDEBAR_COOKIE } from "@/components/shell/nav";
import { ShellFrame } from "@/components/shell/ShellFrame";
import { WorkspaceBoot } from "@/components/shell/WorkspaceBoot";
import { firstName, initials } from "@/lib/auth/teacher-model";
import { currentTeacher, teacherCourses } from "@/lib/auth/teacher";
import { gradesLabel } from "@/lib/teachers/labels";

/**
 * The shell around every teacher page. It reads the teacher for display; each
 * page still calls requireTeacher() itself, because a layout doesn't re-run on
 * every navigation.
 */
export default async function StudioLayout({ children }: { children: ReactNode }) {
  const current = await currentTeacher();
  if (!current) redirect("/sign-in");
  if (!current.teacher.setupDone) redirect("/setup");
  const { teacher } = current;
  const [courses, jar] = await Promise.all([teacherCourses(), cookies()]);
  return (
    <ShellFrame
      teacher={{ firstName: firstName(teacher), fullName: teacher.name || teacher.email || "You", initials: initials(teacher), gradesLabel: gradesLabel(teacher.grades) }}
      courses={courses.map((c) => ({ id: c.id, title: c.title }))}
      initialExpanded={jar.get(SIDEBAR_COOKIE)?.value !== "collapsed"}
    >
      <WorkspaceBoot teacherId={teacher.id} />
      {children}
    </ShellFrame>
  );
}
