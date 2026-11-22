import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ensureTeacherRow, toTeacher } from "@/lib/auth/teacher-row";
import type { Teacher } from "@/lib/auth/teacher-model";
import { serverClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";

export type { Teacher } from "@/lib/auth/teacher-model";

/**
 * The data access layer for teacher pages and Server Functions. Every teacher page
 * calls `requireTeacher()`, and every Server Function calls `teacherForAction()`:
 * the proxy's redirect is only a fast first check. Supabase Auth confirms the
 * session (`getUser()`), so a revoked session is caught here.
 */

export type CurrentTeacher = { teacher: Teacher; supabase: SupabaseClient<Database> };

/** The signed-in teacher for this request, or null. One Auth call per render. */
export const currentTeacher = cache(async (): Promise<CurrentTeacher | null> => {
  const supabase = await serverClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const row = await ensureTeacherRow(supabase, data.user);
  return { teacher: toTeacher(data.user, row), supabase };
});

/**
 * For teacher pages. Signed out: to sign-in, coming back to `next` afterwards.
 * Setup not finished: to first-time setup, unless this page is setup itself.
 */
export async function requireTeacher(options: { next: string; allowSetup?: boolean }): Promise<CurrentTeacher> {
  const current = await currentTeacher();
  if (!current) redirect(options.next === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(options.next)}`);
  if (!current.teacher.setupDone && !options.allowSetup) redirect("/setup");
  return current;
}

/** For Server Functions: the teacher or null. Never redirects, so callers can answer with a message. */
export async function teacherForAction(): Promise<CurrentTeacher | null> {
  return currentTeacher();
}

export type TeacherCourse = { id: string; title: string; level: number | null; curriculumCourseId: string | null };

/** The signed-in teacher's courses, in their order. Row-level security returns only their own. */
export const teacherCourses = cache(async (): Promise<TeacherCourse[]> => {
  const current = await currentTeacher();
  if (!current) return [];
  const { data, error } = await current.supabase.from("courses").select("id, title, level, curriculum_course_id, position, created_at").order("position").order("created_at");
  if (error) throw new Error(`Could not read courses: ${error.message}`);
  return (data ?? []).map((c) => ({ id: c.id, title: c.title, level: c.level, curriculumCourseId: c.curriculum_course_id }));
});
