"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { teacherForAction } from "@/lib/auth/teacher";
import { seedChapters } from "@/lib/courses/server";
import { loadDataset } from "@/lib/curriculum/dataset";
import { checkCourses, choicesSchema, firstIssue, planCourseChanges, profileSchema, type CurriculumCourse } from "@/lib/teachers/setup";

/**
 * Server Functions for first-time setup and Settings. Each one checks the
 * signed-in teacher itself (a page's check doesn't cover it) and writes through
 * the teacher's own Supabase session, so row-level security applies.
 */

export type ActionResult = { ok: true } | { ok: false; message: string };

const SIGNED_OUT: ActionResult = { ok: false, message: "Your session has ended. Sign in again to save." };
const FAILED: ActionResult = { ok: false, message: "Funza couldn’t save that. Check your connection and try again." };

function curriculum(): CurriculumCourse[] {
  return loadDataset().summaries.map((s) => ({ id: s.id, name: s.name, subject: s.subject, levels: s.levels, units: s.units }));
}

/** Name, school, grades and subjects (setup step 1, and Settings). */
export async function saveProfile(input: unknown): Promise<ActionResult> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const { name, school, grades, subjects } = parsed.data;
  const { error } = await current.supabase.from("teachers").update({ name, school, grades, subjects }).eq("id", current.teacher.id);
  if (error) {
    console.error("Saving the teacher profile failed:", error.message);
    return FAILED;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * The teacher's curriculum courses (setup step 2). Re-running it never makes
 * duplicates. Courses unticked during setup are removed; after setup, courses are
 * never removed here, because they may hold chapters and materials.
 */
export async function saveCourses(input: unknown): Promise<ActionResult> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const parsed = choicesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const checked = checkCourses(parsed.data, curriculum());
  if (!checked.ok) return checked;

  const { supabase, teacher } = current;
  const existing = await supabase.from("courses").select("id, curriculum_course_id, level, position");
  if (existing.error) return FAILED;
  const rows = existing.data.map((c) => ({ id: c.id, curriculumCourseId: c.curriculum_course_id, level: c.level }));
  const plan = planCourseChanges(rows, checked.courses);

  if (!teacher.setupDone && plan.remove.length > 0) {
    const { error } = await supabase.from("courses").delete().in("id", plan.remove);
    if (error) return FAILED;
  }
  if (plan.insert.length > 0) {
    const start = existing.data.reduce((m, c) => Math.max(m, c.position + 1), 0);
    const { data: added, error } = await supabase
      .from("courses")
      .insert(plan.insert.map((c, i) => ({ teacher_id: teacher.id, curriculum_course_id: c.curriculumCourseId, level: c.level, title: c.title, position: start + i })))
      .select("id, curriculum_course_id, level");
    if (error) {
      console.error("Saving courses failed:", error.message);
      return FAILED;
    }
    // Each new course starts with its chapters from the curriculum units.
    for (const course of added ?? []) {
      await seedChapters(supabase, teacher.id, course).catch((e: unknown) => console.error("Seeding chapters failed:", e instanceof Error ? e.message : "unknown error"));
    }
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** The last step: marks setup finished and goes to Home. */
export async function finishSetup(): Promise<ActionResult> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const { supabase, teacher } = current;
  if (teacher.grades.length === 0 || teacher.subjects.length === 0) return { ok: false, message: "Choose your grades and subjects first (step 1)." };
  const courses = await supabase.from("courses").select("id", { count: "exact", head: true });
  if (courses.error) return FAILED;
  if (!courses.count) return { ok: false, message: "Choose at least one course first (step 2)." };
  const { error } = await supabase.from("teachers").update({ setup_done_at: new Date().toISOString() }).eq("id", teacher.id);
  if (error) return FAILED;
  revalidatePath("/", "layout");
  redirect("/");
}
