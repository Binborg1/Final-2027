"use server";

import { revalidatePath } from "next/cache";
import { teacherForAction } from "@/lib/auth/teacher";
import { addCourseSchema, idSchema, moved, nameSchema } from "@/lib/courses/model";
import { curriculumSeeds, seedChapters } from "@/lib/courses/server";
import { missingSeeds, seedKey } from "@/lib/courses/seed";
import { loadDataset } from "@/lib/curriculum/dataset";
import { levelTitle } from "@/lib/teachers/setup";

/**
 * Server Functions for courses and chapters (FR-3). Each one checks the signed-in
 * teacher itself and writes through the teacher's own Supabase session, so
 * row-level security applies.
 */

export type CourseResult = { ok: true; id: string } | { ok: false; message: string };
export type Result = { ok: true } | { ok: false; message: string };

const SIGNED_OUT = { ok: false as const, message: "Your session has ended. Sign in again to save." };
const FAILED = { ok: false as const, message: "Funza couldn’t save that. Check your connection and try again." };
const MAX_COURSES = 40;
const MAX_CHAPTERS = 80;

function refresh(courseId?: string) {
  revalidatePath("/", "layout");
  if (courseId) revalidatePath(`/courses/${courseId}`, "layout");
}

/** A curriculum course at one level (its chapters come from the curriculum), or a course of the teacher's own. */
export async function addCourse(input: unknown): Promise<CourseResult> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const parsed = addCourseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a course and level, or give your course a name." };
  const { supabase, teacher } = current;

  const existing = await supabase.from("courses").select("id, curriculum_course_id, level, position");
  if (existing.error) return FAILED;
  if (existing.data.length >= MAX_COURSES) return { ok: false, message: `You can have up to ${MAX_COURSES} courses.` };
  const position = existing.data.reduce((m, c) => Math.max(m, c.position + 1), 0);

  let row: { teacher_id: string; title: string; position: number; curriculum_course_id?: string; level?: number };
  if ("curriculumCourseId" in parsed.data) {
    const { curriculumCourseId, level } = parsed.data;
    const summary = loadDataset().summaries.find((s) => s.id === curriculumCourseId);
    if (!summary || !summary.levels.includes(level)) return { ok: false, message: "That course isn’t offered at that level." };
    const same = existing.data.find((c) => c.curriculum_course_id === curriculumCourseId && c.level === level);
    if (same) return { ok: true, id: same.id };
    row = { teacher_id: teacher.id, title: levelTitle(summary.name, summary.levels, level), position, curriculum_course_id: curriculumCourseId, level };
  } else {
    row = { teacher_id: teacher.id, title: parsed.data.title, position };
  }

  const { data, error } = await supabase.from("courses").insert(row).select("id, curriculum_course_id, level").single();
  if (error || !data) {
    console.error("Adding a course failed:", error?.message);
    return FAILED;
  }
  try {
    await seedChapters(supabase, teacher.id, data);
  } catch (e) {
    console.error("Seeding chapters failed:", e instanceof Error ? e.message : "unknown error");
  }
  refresh();
  return { ok: true, id: data.id };
}

export async function renameCourse(courseId: unknown, title: unknown): Promise<Result> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const id = idSchema.safeParse(courseId);
  const name = nameSchema.safeParse(title);
  if (!id.success) return { ok: false, message: "That course wasn’t found." };
  if (!name.success) return { ok: false, message: name.error.issues[0]?.message ?? "Check the name." };
  const { error } = await current.supabase.from("courses").update({ title: name.data }).eq("id", id.data);
  if (error) return FAILED;
  refresh(id.data);
  return { ok: true };
}

/** Deletes the course with its chapters and materials. Bank questions stay, retired. */
export async function deleteCourse(courseId: unknown): Promise<Result> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const id = idSchema.safeParse(courseId);
  if (!id.success) return { ok: false, message: "That course wasn’t found." };
  const { error } = await current.supabase.from("courses").delete().eq("id", id.data);
  if (error) {
    console.error("Deleting a course failed:", error.message);
    return FAILED;
  }
  refresh();
  return { ok: true };
}

export async function addChapter(courseId: unknown, title: unknown): Promise<Result> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const id = idSchema.safeParse(courseId);
  const name = nameSchema.safeParse(title);
  if (!id.success) return { ok: false, message: "That course wasn’t found." };
  if (!name.success) return { ok: false, message: name.error.issues[0]?.message ?? "Check the name." };
  const { supabase, teacher } = current;
  const existing = await supabase.from("chapters").select("position").eq("course_id", id.data);
  if (existing.error) return FAILED;
  if (existing.data.length >= MAX_CHAPTERS) return { ok: false, message: `A course can have up to ${MAX_CHAPTERS} chapters.` };
  const position = existing.data.reduce((m, c) => Math.max(m, c.position + 1), 0);
  const { error } = await supabase.from("chapters").insert({ teacher_id: teacher.id, course_id: id.data, title: name.data, position, source_kind: "custom" });
  if (error) {
    console.error("Adding a chapter failed:", error.message);
    return error.code === "23503" ? { ok: false, message: "That course wasn’t found." } : FAILED;
  }
  refresh(id.data);
  return { ok: true };
}

export async function renameChapter(chapterId: unknown, title: unknown): Promise<Result> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const id = idSchema.safeParse(chapterId);
  const name = nameSchema.safeParse(title);
  if (!id.success) return { ok: false, message: "That chapter wasn’t found." };
  if (!name.success) return { ok: false, message: name.error.issues[0]?.message ?? "Check the name." };
  const { data, error } = await current.supabase.from("chapters").update({ title: name.data }).eq("id", id.data).select("course_id").maybeSingle();
  if (error) return FAILED;
  refresh(data?.course_id);
  return { ok: true };
}

export async function moveChapter(chapterId: unknown, direction: unknown): Promise<Result> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const id = idSchema.safeParse(chapterId);
  if (!id.success || (direction !== -1 && direction !== 1)) return { ok: false, message: "That chapter wasn’t found." };
  const { supabase } = current;
  const one = await supabase.from("chapters").select("course_id").eq("id", id.data).maybeSingle();
  if (one.error || !one.data) return { ok: false, message: "That chapter wasn’t found." };
  const all = await supabase.from("chapters").select("id, position").eq("course_id", one.data.course_id).order("position").order("created_at");
  if (all.error) return FAILED;
  const order = moved(all.data.map((c) => c.id), id.data, direction);
  if (!order) return { ok: true };
  const was = new Map(all.data.map((c) => [c.id, c.position]));
  const changes = order.map((cid, position) => ({ id: cid, position })).filter((c) => was.get(c.id) !== c.position);
  for (const c of changes) {
    const { error } = await supabase.from("chapters").update({ position: c.position }).eq("id", c.id);
    if (error) return FAILED;
  }
  refresh(one.data.course_id);
  return { ok: true };
}

/**
 * Deletes a chapter from the teacher's course, for good. Only their own row goes: the
 * curriculum doesn't change, and a curriculum chapter can be brought back with
 * restoreChapters. Its bank questions stay, retired; materials made from it are kept.
 */
export async function deleteChapter(chapterId: unknown): Promise<Result> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const id = idSchema.safeParse(chapterId);
  if (!id.success) return { ok: false, message: "That chapter wasn’t found." };
  const { data, error } = await current.supabase.from("chapters").delete().eq("id", id.data).select("course_id").maybeSingle();
  if (error) {
    console.error("Deleting a chapter failed:", error.message);
    return FAILED;
  }
  refresh(data?.course_id);
  return { ok: true };
}

/**
 * "Bring back curriculum chapters": adds back the chosen curriculum chapters the
 * teacher deleted from this course, at the end, in curriculum order. The chapters
 * come from the curriculum again (the curriculum itself never changes); their old
 * questions stay retired in the bank.
 */
export async function restoreChapters(courseId: unknown, keys: unknown): Promise<Result> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const id = idSchema.safeParse(courseId);
  if (!id.success) return { ok: false, message: "That course wasn’t found." };
  const chosen = new Set(Array.isArray(keys) ? keys.filter((k): k is string => typeof k === "string" && k.length <= 260).slice(0, MAX_CHAPTERS) : []);
  if (chosen.size === 0) return { ok: false, message: "Choose at least one chapter to bring back." };
  const { supabase, teacher } = current;

  const [course, chapters] = await Promise.all([
    supabase.from("courses").select("id, curriculum_course_id, level").eq("id", id.data).maybeSingle(),
    supabase.from("chapters").select("title, source_ref, position").eq("course_id", id.data),
  ]);
  if (course.error || chapters.error) return FAILED;
  if (!course.data) return { ok: false, message: "That course wasn’t found." };
  const back = missingSeeds(curriculumSeeds(course.data), chapters.data.map((c) => ({ title: c.title, sourceRef: c.source_ref }))).filter((s) => chosen.has(seedKey(s)));
  if (back.length === 0) return { ok: true }; // already back (another tab, or a double click)
  if (chapters.data.length + back.length > MAX_CHAPTERS) return { ok: false, message: `A course can have up to ${MAX_CHAPTERS} chapters.` };

  const start = chapters.data.reduce((m, c) => Math.max(m, c.position + 1), 0);
  const rows = back.map((s, i) => ({ teacher_id: teacher.id, course_id: id.data, title: s.title, position: start + i, source_kind: s.source_kind, source_ref: s.source_ref, outcome_refs: s.outcome_refs }));
  const { error } = await supabase.from("chapters").insert(rows);
  if (error && error.code !== "23505") {
    console.error("Bringing back chapters failed:", error.message);
    return FAILED;
  }
  refresh(id.data);
  return { ok: true };
}
