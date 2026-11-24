"use server";

import { revalidatePath } from "next/cache";
import { teacherForAction } from "@/lib/auth/teacher";
import { GUID } from "@/lib/resources/sanitize";
import { readStoredContent } from "@/lib/resources/stored";
import { formatFromDraft, materialText } from "@/lib/templates/from";
import { categoryOf, isCategory, LIMITS, line, sanitizeFormat, sanitizeLearnedFrom, type TemplateCategory, type TemplateFormat } from "@/lib/templates/model";

/**
 * Server Functions for templates (FR-20, FR-21). Each checks the signed-in teacher
 * and writes through the teacher's own session, so row-level security applies.
 * The format is rebuilt here from whatever the browser sent; a template's category
 * is fixed once it is made.
 */

export type SaveResult = { ok: true; id: string } | { ok: false; message: string };
export type Result = { ok: true } | { ok: false; message: string };

const SIGNED_OUT = { ok: false as const, message: "Your session has ended. Sign in again to save." };
const FAILED = { ok: false as const, message: "Funza couldn’t save that. Check your connection and try again." };
const NOT_FOUND = { ok: false as const, message: "That template wasn’t found. It may have been deleted." };

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => !!v && typeof v === "object" && !Array.isArray(v);
const guid = (v: unknown) => (typeof v === "string" && GUID.test(v) ? v.toLowerCase() : null);

function refresh(id?: string) {
  revalidatePath("/templates");
  if (id) revalidatePath(`/templates/${id}`);
  revalidatePath("/make");
}

/** Saves a new template, or changes one (same category only). */
export async function saveTemplate(input: unknown): Promise<SaveResult> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  if (!isObject(input) || !isCategory(input.category)) return { ok: false, message: "Choose what the template is for." };
  const category = input.category;
  const name = line(input.name, LIMITS.name);
  if (!name) return { ok: false, message: "Give the template a name." };
  const format = sanitizeFormat(category, input.format);
  if (!format) return { ok: false, message: category === "notes" ? "A notes template needs at least one part." : "A template needs at least one section with a question in it." };
  const row = { name, summary: line(input.summary, LIMITS.summary), format, learned_from: sanitizeLearnedFrom(input.learnedFrom) };
  const { supabase, teacher } = current;

  const id = guid(input.id);
  if (id) {
    const { data, error } = await supabase.from("templates").update(row).eq("id", id).eq("kind", category).select("id").maybeSingle();
    if (error) {
      console.error("Saving a template failed:", error.message);
      return FAILED;
    }
    if (!data) return NOT_FOUND;
    refresh(id);
    return { ok: true, id };
  }

  const count = await supabase.from("templates").select("id", { count: "exact", head: true }).eq("built_in", false);
  if (count.error) return FAILED;
  if ((count.count ?? 0) >= LIMITS.perTeacher) return { ok: false, message: `You can keep up to ${LIMITS.perTeacher} templates. Delete one you no longer use.` };
  const { data, error } = await supabase.from("templates").insert({ ...row, teacher_id: teacher.id, kind: category }).select("id").single();
  if (error || !data) {
    console.error("Adding a template failed:", error?.message);
    return FAILED;
  }
  refresh();
  return { ok: true, id: data.id };
}

export async function renameTemplate(templateId: unknown, newName: unknown): Promise<Result> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const id = guid(templateId);
  const name = line(newName, LIMITS.name);
  if (!id) return NOT_FOUND;
  if (!name) return { ok: false, message: "Give the template a name." };
  const { data, error } = await current.supabase.from("templates").update({ name }).eq("id", id).select("id").maybeSingle();
  if (error) return FAILED;
  if (!data) return NOT_FOUND;
  refresh(id);
  return { ok: true };
}

/** Deletes a template. Materials made from it stay as they are (their link is cleared). */
export async function deleteTemplate(templateId: unknown): Promise<Result> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const id = guid(templateId);
  if (!id) return NOT_FOUND;
  const { error } = await current.supabase.from("templates").delete().eq("id", id);
  if (error) {
    console.error("Deleting a template failed:", error.message);
    return FAILED;
  }
  refresh();
  return { ok: true };
}

/** A copy of a template, named "… (copy)", to change without touching the original. */
export async function duplicateTemplate(templateId: unknown): Promise<SaveResult> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const id = guid(templateId);
  if (!id) return NOT_FOUND;
  const { supabase, teacher } = current;
  const { data, error } = await supabase.from("templates").select("kind, name, summary, format, learned_from").eq("id", id).eq("built_in", false).maybeSingle();
  if (error) return FAILED;
  if (!data) return NOT_FOUND;
  const count = await supabase.from("templates").select("id", { count: "exact", head: true }).eq("built_in", false);
  if (count.error) return FAILED;
  if ((count.count ?? 0) >= LIMITS.perTeacher) return { ok: false, message: `You can keep up to ${LIMITS.perTeacher} templates. Delete one you no longer use.` };
  const name = `${data.name.slice(0, LIMITS.name - 7)} (copy)`;
  const copy = await supabase.from("templates").insert({ teacher_id: teacher.id, kind: data.kind, name, summary: data.summary, format: data.format, learned_from: data.learned_from }).select("id").single();
  if (copy.error || !copy.data) {
    console.error("Duplicating a template failed:", copy.error?.message);
    return FAILED;
  }
  refresh();
  return { ok: true, id: copy.data.id };
}

export type MaterialExample = { ok: true; name: string; format: TemplateFormat | null; text: string } | { ok: false; message: string };

/**
 * One of the teacher's Funza materials as an example. A quiz, test or exam gives its
 * exact structure at once (no AI); notes and slides come back as text for Funza to
 * read, since their section titles are topics rather than a format.
 */
export async function materialExample(resourceId: unknown, category: unknown): Promise<MaterialExample> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const id = guid(resourceId);
  if (!id || !isCategory(category)) return { ok: false, message: "That material wasn’t found." };
  const { supabase } = current;
  const r = await supabase.from("resources").select("id, kind, title, created_at, updated_at, current_version_id").eq("id", id).maybeSingle();
  if (r.error || !r.data?.current_version_id) return { ok: false, message: "That material wasn’t found." };
  const want: TemplateCategory = category;
  const kind = r.data.kind as Parameters<typeof categoryOf>[0];
  if (categoryOf(kind) !== want) return { ok: false, message: "That material is a different kind. Choose one of the same kind as the template." };
  const v = await supabase.from("resource_versions").select("number, approved_at, content").eq("id", r.data.current_version_id).maybeSingle();
  if (v.error || !v.data) return { ok: false, message: "Funza couldn’t read that material. Try again." };
  const stored = readStoredContent(r.data, v.data);
  if (!stored || stored.draft.sections.length === 0) return { ok: false, message: "That material has nothing in it yet." };
  return { ok: true, name: line(stored.draft.title, 120), format: formatFromDraft(stored.draft, stored.resource.brief), text: materialText(stored.draft) };
}
