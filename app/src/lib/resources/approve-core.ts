import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/types";
import { bankRowsFor } from "@/lib/resources/bank-rows";
import type { StoredContent } from "@/lib/resources/stored";

/**
 * Saving and approving a material, shared by Make (lib/resources/actions.ts) and
 * Live setup (lib/live/save-set.ts). Both run as the signed-in teacher, so
 * row-level security applies. The caller runs the review checks first.
 */

type Db = SupabaseClient<Database>;
export type CoreResult<T> = ({ ok: true } & T) | { ok: false; message: string; code?: "course" };

const FAILED = "Funza couldn’t save that. Check your connection and try again.";
export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** A new material: the resource, its chapters and version 1. */
export async function insertMaterial(supabase: Db, teacherId: string, id: string, content: StoredContent): Promise<CoreResult<{ versionId: string }>> {
  const courseId = content.resource.brief.courseId;
  if (!courseId) return { ok: false, message: "Choose a course first." };
  // The template it was made from, when there is one. If that template was deleted in the
  // meantime (or isn't this teacher's), the material is still saved, without the link.
  const templateId = content.resource.brief.templateId ?? null;
  const row = { id, teacher_id: teacherId, course_id: courseId, kind: content.resource.kind, title: content.draft.title || content.resource.title, status: "draft", template_id: templateId };
  let created = await supabase.from("resources").insert(row);
  if (created.error?.code === "23503" && templateId) created = await supabase.from("resources").insert({ ...row, template_id: null });
  if (created.error) {
    console.error("Creating a material failed:", created.error.message);
    return created.error.code === "23503" ? { ok: false, code: "course", message: "That course wasn’t found. Reload and try again." } : { ok: false, message: FAILED };
  }
  const chapterIds = content.resource.brief.chapterIds;
  if (chapterIds.length > 0) {
    const links = await supabase.from("resource_chapters").insert(chapterIds.map((chapter_id) => ({ resource_id: id, chapter_id, teacher_id: teacherId })));
    if (links.error) console.error("Linking a material to its chapters failed:", links.error.message);
  }
  const version = await supabase.from("resource_versions").insert({ teacher_id: teacherId, resource_id: id, number: 1, content: content as unknown as Json }).select("id").single();
  if (version.error || !version.data) {
    console.error("Saving version 1 failed:", version.error?.message);
    await supabase.from("resources").delete().eq("id", id);
    return { ok: false, message: FAILED };
  }
  const linked = await supabase.from("resources").update({ current_version_id: version.data.id }).eq("id", id);
  if (linked.error) return { ok: false, message: FAILED };
  return { ok: true, versionId: version.data.id };
}

/**
 * Approves a saved version: freezes its content, then approve_version() marks it
 * approved and links its questions to the chapter's bank (copying new ones), in
 * one transaction.
 */
export async function approveStored(
  supabase: Db,
  input: { resourceId: string; courseId: string; versionId: string; number: number; stored: StoredContent },
): Promise<CoreResult<{ at: string; banked: number }>> {
  const { resourceId, courseId, versionId, number, stored } = input;
  const links = await supabase.from("resource_chapters").select("chapter_id").eq("resource_id", resourceId);
  if (links.error) return { ok: false, message: FAILED };
  let chapterIds = links.data.map((l) => l.chapter_id);
  if (chapterIds.length === 0) {
    const first = await supabase.from("chapters").select("id").eq("course_id", courseId).order("position").limit(1);
    chapterIds = (first.data ?? []).map((c) => c.id);
  }
  const chapters = chapterIds.length > 0 ? await supabase.from("chapters").select("id, outcome_refs, position").in("id", chapterIds).order("position") : { data: [], error: null };
  if (chapters.error) return { ok: false, message: FAILED };
  const rows = bankRowsFor(stored.draft, chapters.data.map((c) => ({ id: c.id, outcomeRefs: c.outcome_refs })), sha256);
  const hasQuestions = stored.draft.sections.some((s) => s.kind === "questions" && s.items.length > 0);
  if (hasQuestions && rows.length === 0) return { ok: false, message: "Add a chapter to this course first, so the questions have a place in the bank." };

  const at = new Date().toISOString();
  const frozen = { ...stored, draft: { ...stored.draft, status: "approved" as const, approved: { at, version: number, title: stored.draft.title, sections: stored.draft.sections }, pendingAlt: null } };
  const kept = await supabase.from("resource_versions").update({ content: frozen as unknown as Json }).eq("id", versionId).is("approved_at", null);
  if (kept.error) return { ok: false, message: FAILED };

  const { data: banked, error } = await supabase.rpc("approve_version", { p_version: versionId, p_questions: rows as unknown as Json });
  if (error) {
    console.error("Approving failed:", error.code, error.message);
    return { ok: false, message: FAILED };
  }
  return { ok: true, at, banked: banked ?? 0 };
}
