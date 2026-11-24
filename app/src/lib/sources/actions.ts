"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { teacherForAction } from "@/lib/auth/teacher";
import { MAX_SOURCE_TEXT, ownsPath, SOURCE_BUCKET } from "@/lib/sources/model";

/**
 * Server Functions for chapter sources. The browser uploads the file to the
 * teacher's own Storage folder (row-level security on storage.objects) and sends
 * the text it extracted; these record it, read it back for Make, and delete it.
 */

type Fail = { ok: false; message: string };
const SIGNED_OUT: Fail = { ok: false, message: "Your session has ended. Sign in again." };
const FAILED: Fail = { ok: false, message: "Funza couldn’t save that. Check your connection and try again." };

const addSchema = z.object({
  chapterId: z.guid(),
  kind: z.enum(["notes", "pdf", "past_exam"]),
  title: z.string().trim().min(1).max(300),
  filePath: z.string().max(400),
  text: z.string().max(MAX_SOURCE_TEXT * 2),
});

export async function addSource(input: unknown): Promise<{ ok: true } | Fail> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That file couldn’t be added. Try again." };
  const { chapterId, kind, title, filePath, text } = parsed.data;
  if (!ownsPath(filePath, current.teacher.id, chapterId)) return { ok: false, message: "That file couldn’t be added. Try again." };
  const clean = text.replace(/\u0000/g, "").trim().slice(0, MAX_SOURCE_TEXT);
  const { data, error } = await current.supabase.from("sources").insert({ teacher_id: current.teacher.id, chapter_id: chapterId, kind, title, file_path: filePath, text: clean || null }).select("chapter_id, chapters(course_id)").single();
  if (error) {
    console.error("Adding a source failed:", error.message);
    await current.supabase.storage.from(SOURCE_BUCKET).remove([filePath]);
    return error.code === "23503" ? { ok: false, message: "That chapter wasn’t found." } : FAILED;
  }
  const courseId = (data?.chapters as { course_id?: string } | null)?.course_id;
  if (courseId) revalidatePath(`/courses/${courseId}`, "layout");
  return { ok: true };
}

export async function deleteSource(sourceId: unknown): Promise<{ ok: true } | Fail> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const id = z.guid().safeParse(sourceId);
  if (!id.success) return { ok: false, message: "That source wasn’t found." };
  const { data, error } = await current.supabase.from("sources").delete().eq("id", id.data).select("file_path, chapters(course_id)").maybeSingle();
  if (error) return FAILED;
  if (data?.file_path) {
    const removed = await current.supabase.storage.from(SOURCE_BUCKET).remove([data.file_path]);
    if (removed.error) console.error("Removing a source file failed:", removed.error.message);
  }
  const courseId = (data?.chapters as { course_id?: string } | null)?.course_id;
  if (courseId) revalidatePath(`/courses/${courseId}`, "layout");
  return { ok: true };
}

/** A source's text, for Make to use as the teacher's notes. */
export async function sourceText(sourceId: unknown): Promise<{ ok: true; title: string; text: string } | Fail> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const id = z.guid().safeParse(sourceId);
  if (!id.success) return { ok: false, message: "That source wasn’t found." };
  const { data, error } = await current.supabase.from("sources").select("title, text").eq("id", id.data).maybeSingle();
  if (error || !data) return { ok: false, message: "That source wasn’t found." };
  if (!data.text) return { ok: false, message: "Funza found no text in that file. Scanned pages aren’t read yet." };
  return { ok: true, title: data.title, text: data.text };
}

/** A short-lived link to open the file itself. */
export async function sourceLink(sourceId: unknown): Promise<{ ok: true; url: string } | Fail> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const id = z.guid().safeParse(sourceId);
  if (!id.success) return { ok: false, message: "That source wasn’t found." };
  const { data } = await current.supabase.from("sources").select("file_path").eq("id", id.data).maybeSingle();
  if (!data?.file_path) return { ok: false, message: "That source has no file." };
  const signed = await current.supabase.storage.from(SOURCE_BUCKET).createSignedUrl(data.file_path, 300);
  if (signed.error || !signed.data) return { ok: false, message: "The file couldn’t be opened. Try again." };
  return { ok: true, url: signed.data.signedUrl };
}
