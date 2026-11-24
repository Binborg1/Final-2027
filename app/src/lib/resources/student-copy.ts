import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { codeOf } from "@/lib/curriculum/sources";
import { loadDataset } from "@/lib/curriculum/dataset";
import type { Database } from "@/lib/db/types";
import { KINDS } from "@/lib/resources/kinds";
import { studentHtml } from "@/lib/resources/render";
import { GUID } from "@/lib/resources/sanitize";
import { readStoredContent } from "@/lib/resources/stored";

/**
 * The student copy of a material, built on the server from its saved, approved
 * version, found by the resource's id. The browser never supplies the content.
 * Used for the Google Doc posted to Classroom and for printing. Answers, keys,
 * worked solutions and rubrics are never part of it (lib/resources/render.ts).
 */

export type StudentCopy = { ok: true; title: string; version: number; html: string; kind: string; versionId: string } | { ok: false; status: number; message: string };

export async function studentCopy(supabase: SupabaseClient<Database>, teacherId: string, resourceId: unknown): Promise<StudentCopy> {
  if (typeof resourceId !== "string" || !GUID.test(resourceId)) return { ok: false, status: 400, message: "That material wasn’t found." };
  const r = await supabase.from("resources").select("id, kind, title, course_id, created_at, updated_at, current_version_id").eq("id", resourceId.toLowerCase()).maybeSingle();
  if (r.error) return { ok: false, status: 500, message: "Funza couldn’t read that material. Try again." };
  const row = r.data;
  if (!row?.current_version_id) return { ok: false, status: 404, message: "That material wasn’t found." };
  const kind = KINDS.find((k) => k.kind === row.kind);
  if (!kind?.forStudents) return { ok: false, status: 400, message: "This material is for teachers only and isn’t given to students." };

  const [v, course, teacher] = await Promise.all([
    supabase.from("resource_versions").select("id, number, approved_at, content").eq("id", row.current_version_id).single(),
    supabase.from("courses").select("title").eq("id", row.course_id).maybeSingle(),
    supabase.from("teachers").select("school").eq("id", teacherId).maybeSingle(),
  ]);
  if (v.error || !v.data) return { ok: false, status: 500, message: "Funza couldn’t read that material. Try again." };
  if (!v.data.approved_at) return { ok: false, status: 409, message: "Approve this version first. Nothing reaches students before you approve it." };
  const stored = readStoredContent(row, v.data);
  if (!stored || stored.draft.sections.length === 0) return { ok: false, status: 409, message: "This version has nothing to give students." };

  loadDataset(); // outcome codes for the header
  const html = studentHtml({
    kind: kind.kind,
    title: stored.draft.title,
    courseName: course.data?.title ?? stored.resource.courseName,
    outcomeCodes: stored.draft.outcomeIds.map(codeOf).slice(0, 6),
    duration: stored.draft.duration,
    school: teacher.data?.school ?? "",
    sections: stored.draft.sections,
    style: stored.resource.brief.style,
  });
  return { ok: true, title: stored.draft.title, version: v.data.number, html, kind: kind.kind, versionId: v.data.id };
}
