import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chapterSeeds, missingSeeds, seedKey, type ChapterSeed } from "@/lib/courses/seed";
import { importedCourse, loadDataset } from "@/lib/curriculum/dataset";
import type { DatasetCourse } from "@/lib/curriculum/imported";
import type { Database } from "@/lib/db/types";

type Db = SupabaseClient<Database>;

let byId: Map<string, DatasetCourse> | null = null;

/** The raw curriculum course (units, outcomes and the curriculum document). */
export function datasetCourse(id: string): DatasetCourse | null {
  if (!byId) byId = new Map(loadDataset().dataset.courses.map((c) => [c.id, c]));
  return byId.get(id) ?? null;
}

/**
 * Adds a curriculum course's chapters when the course is made (in setup or "Add a
 * course"), if it has none yet. It never runs again for that course, so chapters the
 * teacher deletes stay deleted; they come back only through "Bring back curriculum
 * chapters" (restoreChapters). Runs as the teacher
 * (row-level security). Two requests at once can't add them twice: seeded chapters
 * are unique per course, and the second insert is ignored.
 */
export async function seedChapters(supabase: Db, teacherId: string, course: { id: string; curriculum_course_id: string | null; level: number | null }): Promise<void> {
  if (!course.curriculum_course_id || !course.level) return;
  const source = datasetCourse(course.curriculum_course_id);
  if (!source) return;
  const existing = await supabase.from("chapters").select("id", { count: "exact", head: true }).eq("course_id", course.id);
  if (existing.error) throw new Error(`Could not read chapters: ${existing.error.message}`);
  if (existing.count) return;
  const rows = chapterSeeds(source, course.level).map((s) => ({ ...s, teacher_id: teacherId, course_id: course.id }));
  const { error } = await supabase.from("chapters").insert(rows);
  if (error && error.code !== "23505") throw new Error(`Could not add chapters: ${error.message}`);
}

/** The chapters a curriculum course starts with at its level (none for a course of the teacher's own). */
export function curriculumSeeds(course: { curriculum_course_id: string | null; level: number | null }): ChapterSeed[] {
  if (!course.curriculum_course_id || !course.level) return [];
  const source = datasetCourse(course.curriculum_course_id);
  return source ? chapterSeeds(source, course.level) : [];
}

/** The curriculum chapters the teacher deleted from this course, which "Bring back curriculum chapters" offers. */
export function removedCurriculumChapters(course: { curriculum_course_id: string | null; level: number | null }, chapters: { title: string; sourceRef: string | null }[]) {
  return missingSeeds(curriculumSeeds(course), chapters).map((s) => ({ key: seedKey(s), title: s.title, outcomes: s.outcome_refs.length }));
}

/** Official code and wording for outcome ids, from the course's curriculum. */
export function outcomesOf(curriculumCourseId: string | null, ids: string[]): { id: string; code: string; statement: string }[] {
  const course = curriculumCourseId ? importedCourse(curriculumCourseId) : null;
  if (!course) return [];
  const all = new Map(course.units.flatMap((u) => u.outcomes).map((o) => [o.id, o]));
  return ids.map((id) => all.get(id)).filter((o) => o !== undefined).map((o) => ({ id: o.id, code: o.code, statement: o.statement }));
}
