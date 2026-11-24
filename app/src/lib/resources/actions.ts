"use server";

import { revalidatePath } from "next/cache";
import { teacherForAction } from "@/lib/auth/teacher";
import { loadDataset } from "@/lib/curriculum/dataset";
import { questionsToRetire } from "@/lib/library/model";
import { approveStored, insertMaterial } from "@/lib/resources/approve-core";
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
  const saved = await insertMaterial(current.supabase, current.teacher.id, id, content);
  if (!saved.ok) return { ok: false, message: saved.message };
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

  const approved = await approveStored(current.supabase, { resourceId: id, courseId: resource.course_id, versionId: version.id, number: version.number, stored });
  if (!approved.ok) return { ok: false, message: approved.message };
  refresh();
  return { ok: true, at: approved.at, version: version.number, banked: approved.banked };
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

/**
 * Deletes a material from the teacher's account, for good: the resource and, with
 * it, every version, its chapter links and its record of prints and posts. Copies
 * already printed or posted to Classroom stay where they are. The bank questions
 * only this material used are retired (they stay in the database, unoffered); a
 * question another material still uses stays active.
 */
export async function deleteMaterial(input: { id: unknown }): Promise<{ ok: true; retired: number } | Fail> {
  const current = await teacherForAction();
  if (!current) return SIGNED_OUT;
  if (typeof input?.id !== "string" || !GUID.test(input.id)) return MISSING;
  const id = input.id.toLowerCase();
  const { supabase } = current;

  // Its questions, read before the delete removes the links.
  const versions = await supabase.from("resource_versions").select("id").eq("resource_id", id);
  if (versions.error) return FAILED;
  const versionIds = versions.data.map((v) => v.id);
  const links = versionIds.length > 0 ? await supabase.from("version_questions").select("question_id").in("version_id", versionIds) : { data: [], error: null };
  if (links.error) return FAILED;
  const used = [...new Set(links.data.map((l) => l.question_id))];

  const { error } = await supabase.from("resources").delete().eq("id", id);
  if (error) {
    console.error("Deleting a material failed:", error.message);
    return FAILED;
  }

  let retired = 0;
  if (used.length > 0) {
    const still = await supabase.from("version_questions").select("question_id").in("question_id", used);
    const ids = still.error ? [] : questionsToRetire(used, still.data.map((l) => l.question_id));
    const done = ids.length > 0 ? await supabase.from("questions").update({ retired: true }).in("id", ids) : { error: null };
    // The material is gone either way; questions left active are still approved ones.
    if (still.error || done.error) console.error("Retiring a deleted material's questions failed:", (still.error ?? done.error)?.message);
    else retired = ids.length;
  }
  refresh();
  return { ok: true, retired };
}

/**
 * Records where the approved version went (FR-29): a Classroom post or a print.
 * The database refuses a publication of a version that isn't approved. A post
 * students can see now marks the material as published.
 */
export async function recordPublication(input: { id: unknown; channel: unknown; externalId: unknown; live: unknown }): Promise<{ ok: true } | Fail> {
  if (typeof input?.id !== "string") return MISSING;
  const channel = input.channel === "classroom" || input.channel === "print" ? input.channel : null;
  if (!channel) return { ok: false, message: "Unknown destination." };
  const found = await currentVersion(input.id.toLowerCase());
  if ("error" in found) return found.error!;
  if (!found.version.approved_at) return { ok: false, message: "Approve this version first." };
  const externalId = typeof input.externalId === "string" && input.externalId.trim() ? input.externalId.trim().slice(0, 500) : null;
  const { supabase, teacher } = found.current;
  const saved = await supabase.from("publications").insert({ teacher_id: teacher.id, version_id: found.version.id, channel, external_id: externalId });
  if (saved.error) {
    console.error("Recording a publication failed:", saved.error.message);
    return FAILED;
  }
  if (input.live === true) await supabase.from("resources").update({ status: "published" }).eq("id", found.resource.id);
  refresh();
  return { ok: true };
}
