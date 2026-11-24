import "server-only";
import { cache } from "react";
import { currentTeacher } from "@/lib/auth/teacher";
import { outcomesOf, seedChapters } from "@/lib/courses/server";
import type { ResourceKind } from "@/lib/resources/types";

/**
 * What the course pages and Make read. Everything goes through the teacher's own
 * session, so row-level security returns only their rows.
 */

export type CourseSummaryRow = { id: string; title: string; level: number | null; curriculumCourseId: string | null; chapters: number; materials: number };
export type ChapterRow = { id: string; title: string; position: number; sourceKind: string; outcomeRefs: string[] };
export type MaterialStatus = "draft" | "in_review" | "approved" | "published";
export type MaterialRow = { id: string; title: string; kind: ResourceKind; status: MaterialStatus; updatedAt: string; version: number | null; chapterIds: string[] };
export type BankQuestionRow = { id: string; type: string; stem: string; marks: number; outcomeRef: string | null; difficulty: number | null };
export type CourseRow = { id: string; title: string; level: number | null; curriculumCourseId: string | null };

const countOf = (v: unknown) => (Array.isArray(v) && v[0] && typeof v[0] === "object" && "count" in v[0] ? Number(v[0].count) || 0 : 0);

export const courseList = cache(async (): Promise<CourseSummaryRow[]> => {
  const current = await currentTeacher();
  if (!current) return [];
  const { data, error } = await current.supabase.from("courses").select("id, title, level, curriculum_course_id, position, created_at, chapters(count), resources(count)").order("position").order("created_at");
  if (error) throw new Error(`Could not read courses: ${error.message}`);
  return data.map((c) => ({ id: c.id, title: c.title, level: c.level, curriculumCourseId: c.curriculum_course_id, chapters: countOf(c.chapters), materials: countOf(c.resources) }));
});

async function readChapters(courseId: string): Promise<ChapterRow[]> {
  const current = await currentTeacher();
  if (!current) return [];
  const { data, error } = await current.supabase.from("chapters").select("id, title, position, source_kind, outcome_refs, created_at").eq("course_id", courseId).order("position").order("created_at");
  if (error) throw new Error(`Could not read chapters: ${error.message}`);
  return data.map((c) => ({ id: c.id, title: c.title, position: c.position, sourceKind: c.source_kind, outcomeRefs: c.outcome_refs }));
}

async function readMaterials(courseId: string): Promise<MaterialRow[]> {
  const current = await currentTeacher();
  if (!current) return [];
  const { data, error } = await current.supabase.from("resources").select("id, title, kind, status, updated_at, current_version_id, resource_chapters(chapter_id)").eq("course_id", courseId).order("updated_at", { ascending: false });
  if (error) throw new Error(`Could not read materials: ${error.message}`);
  const versionIds = data.map((r) => r.current_version_id).filter((v): v is string => !!v);
  const numbers = new Map<string, number>();
  if (versionIds.length > 0) {
    const v = await current.supabase.from("resource_versions").select("id, number").in("id", versionIds);
    if (v.error) throw new Error(`Could not read versions: ${v.error.message}`);
    for (const row of v.data) numbers.set(row.id, row.number);
  }
  return data.map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind as ResourceKind,
    status: r.status as MaterialStatus,
    updatedAt: r.updated_at,
    version: r.current_version_id ? numbers.get(r.current_version_id) ?? null : null,
    chapterIds: (r.resource_chapters ?? []).map((x) => x.chapter_id),
  }));
}

/** A course, its chapters (seeding them from the curriculum the first time) and its materials. */
export async function courseDetail(courseId: string): Promise<{ course: CourseRow; chapters: ChapterRow[]; materials: MaterialRow[] } | null> {
  const current = await currentTeacher();
  if (!current) return null;
  const { data: course, error } = await current.supabase.from("courses").select("id, title, level, curriculum_course_id").eq("id", courseId).maybeSingle();
  if (error) throw new Error(`Could not read the course: ${error.message}`);
  if (!course) return null;
  let chapters = await readChapters(course.id);
  if (chapters.length === 0 && course.curriculum_course_id) {
    await seedChapters(current.supabase, current.teacher.id, course);
    chapters = await readChapters(course.id);
  }
  const materials = await readMaterials(course.id);
  return { course: { id: course.id, title: course.title, level: course.level, curriculumCourseId: course.curriculum_course_id }, chapters, materials };
}

/** One chapter: its materials, its outcomes with their official wording, and its bank questions. */
export async function chapterDetail(courseId: string, chapterId: string) {
  const detail = await courseDetail(courseId);
  if (!detail) return null;
  const index = detail.chapters.findIndex((c) => c.id === chapterId);
  if (index < 0) return null;
  const chapter = detail.chapters[index];
  const current = await currentTeacher();
  const { data, error } = await current!.supabase.from("questions").select("id, type, stem, marks, outcome_ref, difficulty, created_at").eq("chapter_id", chapter.id).eq("retired", false).order("created_at");
  if (error) throw new Error(`Could not read the question bank: ${error.message}`);
  const questions: BankQuestionRow[] = data.map((q) => ({ id: q.id, type: q.type, stem: q.stem, marks: q.marks, outcomeRef: q.outcome_ref, difficulty: q.difficulty }));
  return {
    course: detail.course,
    chapter,
    index,
    total: detail.chapters.length,
    materials: detail.materials.filter((m) => m.chapterIds.includes(chapter.id)),
    outcomes: outcomesOf(detail.course.curriculumCourseId, chapter.outcomeRefs),
    questions,
  };
}

/** Every chapter of the teacher's courses, for Make's chapter chips. */
export const makeChapters = cache(async (): Promise<Record<string, ChapterRow[]>> => {
  const current = await currentTeacher();
  if (!current) return {};
  const { data, error } = await current.supabase.from("chapters").select("id, course_id, title, position, source_kind, outcome_refs, created_at").order("position").order("created_at");
  if (error) throw new Error(`Could not read chapters: ${error.message}`);
  const out: Record<string, ChapterRow[]> = {};
  for (const c of data) (out[c.course_id] ??= []).push({ id: c.id, title: c.title, position: c.position, sourceKind: c.source_kind, outcomeRefs: c.outcome_refs });
  return out;
});

/** Seeds chapters for any curriculum course that has none yet (courses made in setup before step 4). */
export async function ensureChapters(): Promise<void> {
  const current = await currentTeacher();
  if (!current) return;
  const [courses, chapters] = await Promise.all([current.supabase.from("courses").select("id, curriculum_course_id, level"), current.supabase.from("chapters").select("course_id")]);
  if (courses.error || chapters.error) return;
  const has = new Set(chapters.data.map((c) => c.course_id));
  for (const c of courses.data) if (!has.has(c.id) && c.curriculum_course_id) await seedChapters(current.supabase, current.teacher.id, c).catch(() => undefined);
}
