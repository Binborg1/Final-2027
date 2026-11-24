"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { teacherForAction } from "@/lib/auth/teacher";
import { loadDataset } from "@/lib/curriculum/dataset";
import type { Json } from "@/lib/db/types";
import { bankRowsFor } from "@/lib/resources/bank-rows";
import { approvalBlockers, computeChecks } from "@/lib/resources/checks";
import { GUID, isObject } from "@/lib/resources/sanitize";
import { readStoredContent, toStoredContent, type StoredContent } from "@/lib/resources/stored";
import { sanitizeDraft, sanitizeResource } from "@/lib/resources/sanitize";

/**
 * Server Functions for the teacher's materials: the browser workspace's drafts,
 * kept as resource versions in the database (development step 4). Each one checks
 * the signed-in teacher itself and writes through the teacher's own Supabase
 * session, so row-level security applies. Approval is decided here, not in the
 * browser: the review checks run again before approve_version() is called.
 */

type Fail = { ok: false; message: string; code?: "signed-out" | "approved" | "blocked" | "missing" };
const SIGNED_OUT: Fail = { ok: false, code: "signed-out", message: "Your session has ended. Sign in again; your last changes weren’t saved." };
const FAILED: Fail = { ok: false, message: "Funza couldn’t save that. Check your connection and try again." };
const MISSING: Fail = { ok: false, code: "missing", message: "That material wasn’t found." };

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

/** Checks the browser's copy: the right id, a valid resource and draft. */
function clean(id: string, input: unknown): StoredContent | null {
  if (!isObject(input)) return null;
  const resource = sanitizeResource({ ...(isObject(input.resource) ? input.resource : {}), id });
  if (!resource) return null;
  const draft = sanitizeDraft(input.draft, resource);
  return draft ? toStoredContent(resource, { ...draft, resourceId: id }) : null;
}

function refresh() {
  revalidatePath("/", "layout");
}

export type WorkspaceItem = StoredContent;

/** Every material of the teacher, as the browser workspace holds them. */
export async function loadWorkspaceData(): Promise<{ ok: true; items: WorkspaceItem[] } | Fail> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  const { supabase } = current;
  const resources = await supabase.from("resources").select("id, kind, title, created_at, updated_at, current_version_id").order("updated_at", { ascending: false }).limit(300);
  if (resources.error) return FAILED;
  const ids = resources.data.map((r) => r.current_version_id).filter((v): v is string => !!v);
  const versions = ids.length > 0 ? await supabase.from("resource_versions").select("id, number, approved_at, content").in("id", ids) : { data: [], error: null };
  if (versions.error) return FAILED;
  const byId = new Map(versions.data.map((v) => [v.id, v]));
  const items: WorkspaceItem[] = [];
  for (const r of resources.data) {
    const v = r.current_version_id ? byId.get(r.current_version_id) : undefined;
    const item = v ? readStoredContent(r, v) : null;
    if (item) items.push(item);
  }
  return { ok: true, items };
}

/** A new material from Make: the resource, its chapters and version 1. */
export async function createMaterial(input: { id: unknown; content: unknown }): Promise<{ ok: true } | Fail> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  if (typeof input?.id !== "string" || !GUID.test(input.id)) return { ok: false, message: "That draft couldn’t be saved. Try again." };
  const id = input.id.toLowerCase();
  const content = clean(id, input.content);
  if (!content) return { ok: false, message: "That draft couldn’t be saved. Try again." };
  const courseId = content.resource.brief.courseId;
  if (!courseId) return { ok: false, message: "Choose a course first." };
  const { supabase, teacher } = current;

  const created = await supabase.from("resources").insert({ id, teacher_id: teacher.id, course_id: courseId, kind: content.resource.kind, title: content.draft.title || content.resource.title, status: "draft" });
  if (created.error) {
    console.error("Creating a material failed:", created.error.message);
    return created.error.code === "23503" ? { ok: false, message: "That course wasn’t found. Reload and try again." } : FAILED;
  }
  const chapterIds = content.resource.brief.chapterIds;
  if (chapterIds.length > 0) {
    const links = await supabase.from("resource_chapters").insert(chapterIds.map((chapter_id) => ({ resource_id: id, chapter_id, teacher_id: teacher.id })));
    if (links.error) console.error("Linking a material to its chapters failed:", links.error.message);
  }
  const version = await supabase.from("resource_versions").insert({ teacher_id: teacher.id, resource_id: id, number: 1, content }).select("id").single();
  if (version.error || !version.data) {
    console.error("Saving version 1 failed:", version.error?.message);
    await supabase.from("resources").delete().eq("id", id);
    return FAILED;
  }
  const linked = await supabase.from("resources").update({ current_version_id: version.data.id }).eq("id", id);
  if (linked.error) return FAILED;
  refresh();
  return { ok: true };
}

async function currentVersion(id: string) {
  const current = await teacherForAction();
  if (!current) return { error: SIGNED_OUT } as const;
  if (!GUID.test(id)) return { error: MISSING } as const;
  const { supabase } = current;
  const r = await supabase.from("resources").select("id, kind, title, course_id, created_at, updated_at, current_version_id").eq("id", id).maybeSingle();
  if (r.error) return { error: FAILED } as const;
  if (!r.data || !r.data.current_version_id) return { error: MISSING } as const;
  const v = await supabase.from("resource_versions").select("id, number, approved_at, content").eq("id", r.data.current_version_id).single();
  if (v.error || !v.data) return { error: FAILED } as const;
  return { current, resource: r.data, version: v.data } as const;
}

/** Saves the working draft into the current version. An approved version never changes. */
export async function saveMaterial(input: { id: unknown; content: unknown }): Promise<{ ok: true } | Fail> {
  if (typeof input?.id !== "string") return MISSING;
  const id = input.id.toLowerCase();
  const found = await currentVersion(id);
  if ("error" in found) return found.error!;
  if (found.version.approved_at) return { ok: false, code: "approved", message: "This version is approved and can’t change. Start a new version to edit it." };
  const content = clean(id, input.content);
  if (!content) return { ok: false, message: "That change couldn’t be saved. Reload and try again." };
  const draft = { ...content.draft, status: "draft" as const, version: found.version.number };
  const { supabase } = found.current;
  const saved = await supabase.from("resource_versions").update({ content: { ...content, draft } }).eq("id", found.version.id).is("approved_at", null);
  if (saved.error) {
    console.error("Saving a draft failed:", saved.error.message);
    return FAILED;
  }
  const title = (draft.title || content.resource.title).slice(0, 300);
  if (title && title !== found.resource.title) await supabase.from("resources").update({ title }).eq("id", id);
  else await supabase.from("resources").update({ status: "draft" }).eq("id", id); // touches updated_at
  return { ok: true };
}

/**
 * Approves the current version (FR-24, FR-27). The review checks run here again,
 * on the saved copy; anything failed, waiting on the teacher or changed since review
 * blocks it. Then the version is approved and its questions go into the bank, in
 * one transaction.
 */
export async function approveMaterial(input: { id: unknown }): Promise<{ ok: true; at: string; version: number; banked: number } | Fail> {
  if (typeof input?.id !== "string") return MISSING;
  const id = input.id.toLowerCase();
  const found = await currentVersion(id);
  if ("error" in found) return found.error!;
  const { current, resource, version } = found;
  if (version.approved_at) return { ok: true, at: version.approved_at, version: version.number, banked: 0 };

  const stored = readStoredContent(resource, version);
  if (!stored) return { ok: false, message: "This draft couldn’t be read. Reload and try again." };
  loadDataset(); // registers every curriculum course, so the outcome checks can find them
  const blockers = approvalBlockers(computeChecks(stored.draft));
  if (blockers.length > 0) {
    return { ok: false, code: "blocked", message: `${blockers.length} ${blockers.length === 1 ? "check still needs" : "checks still need"} you before this can be approved. Open the checks in Review.` };
  }

  const { supabase } = current;
  const links = await supabase.from("resource_chapters").select("chapter_id").eq("resource_id", id);
  if (links.error) return FAILED;
  let chapterIds = links.data.map((l) => l.chapter_id);
  if (chapterIds.length === 0) {
    const first = await supabase.from("chapters").select("id").eq("course_id", resource.course_id).order("position").limit(1);
    chapterIds = (first.data ?? []).map((c) => c.id);
  }
  const chapters = chapterIds.length > 0 ? await supabase.from("chapters").select("id, outcome_refs, position").in("id", chapterIds).order("position") : { data: [], error: null };
  if (chapters.error) return FAILED;
  const rows = bankRowsFor(stored.draft, chapters.data.map((c) => ({ id: c.id, outcomeRefs: c.outcome_refs })), sha256);
  const hasQuestions = stored.draft.sections.some((s) => s.kind === "questions" && s.items.length > 0);
  if (hasQuestions && rows.length === 0) return { ok: false, message: "Add a chapter to this course first, so the questions have a place in the bank." };

  const at = new Date().toISOString();
  const frozen = { ...stored, draft: { ...stored.draft, status: "approved" as const, approved: { at, version: version.number, title: stored.draft.title, sections: stored.draft.sections }, pendingAlt: null } };
  const kept = await supabase.from("resource_versions").update({ content: frozen }).eq("id", version.id).is("approved_at", null);
  if (kept.error) return FAILED;

  const { data: banked, error } = await supabase.rpc("approve_version", { p_version: version.id, p_questions: rows as unknown as Json });
  if (error) {
    console.error("Approving failed:", error.code, error.message);
    return FAILED;
  }
  refresh();
  return { ok: true, at, version: version.number, banked: banked ?? 0 };
}

/** After approval, editing starts the next version, a copy of the approved one. */
export async function startMaterialVersion(input: { id: unknown }): Promise<{ ok: true; version: number } | Fail> {
  if (typeof input?.id !== "string") return MISSING;
  const id = input.id.toLowerCase();
  const found = await currentVersion(id);
  if ("error" in found) return found.error!;
  const { current, resource, version } = found;
  if (!version.approved_at) return { ok: true, version: version.number };
  const stored = readStoredContent(resource, version);
  if (!stored) return FAILED;
  const number = version.number + 1;
  const content = { ...stored, draft: { ...stored.draft, status: "draft" as const, version: number } };
  const { supabase, teacher } = current;
  const next = await supabase.from("resource_versions").insert({ teacher_id: teacher.id, resource_id: id, number, content }).select("id").single();
  if (next.error || !next.data) {
    console.error("Starting a new version failed:", next.error?.message);
    return FAILED;
  }
  const moved = await supabase.from("resources").update({ current_version_id: next.data.id, status: "draft" }).eq("id", id);
  if (moved.error) return FAILED;
  refresh();
  return { ok: true, version: number };
}

export async function deleteMaterial(input: { id: unknown }): Promise<{ ok: true } | Fail> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  if (typeof input?.id !== "string" || !GUID.test(input.id)) return MISSING;
  const { error } = await current.supabase.from("resources").delete().eq("id", input.id.toLowerCase());
  if (error) {
    console.error("Deleting a material failed:", error.message);
    return FAILED;
  }
  refresh();
  return { ok: true };
}
