import "server-only";
import { cache } from "react";
import { currentTeacher } from "@/lib/auth/teacher";
import { KINDS } from "@/lib/resources/kinds";
import { GUID } from "@/lib/resources/sanitize";
import type { ResourceKind } from "@/lib/resources/types";
import { isCategory, PIN_COLUMNS, sanitizeFormat, sanitizeLearnedFrom, type MaterialChoice, type Template } from "@/lib/templates/model";
import { pinsOf } from "@/lib/templates/pins";

/**
 * The teacher's templates, read through their own session (row-level security
 * returns only their rows). Each stored format is rebuilt on the way out; a row
 * that can't be read comes back with `format: null`, and can only be deleted.
 */

const KIND_IDS = KINDS.map((k) => k.kind);
const COLUMNS = `id, kind, name, summary, format, learned_from, updated_at, built_in, resources(count), ${PIN_COLUMNS}`;
const countOf = (v: unknown) => (Array.isArray(v) && v[0] && typeof v[0] === "object" && "count" in v[0] ? Number(v[0].count) || 0 : 0);

type Row = { id: string; kind: string; name: string; summary: string; format: unknown; learned_from: unknown; updated_at: string; built_in: boolean; resources: unknown; template_pins: unknown };

function toTemplate(r: Row): Template | null {
  if (!isCategory(r.kind) || r.built_in) return null;
  return { id: r.id, category: r.kind, name: r.name, summary: r.summary, format: sanitizeFormat(r.kind, r.format), learnedFrom: sanitizeLearnedFrom(r.learned_from), used: countOf(r.resources), updatedAt: r.updated_at, pins: pinsOf(r.template_pins) };
}

export const templateList = cache(async (): Promise<Template[]> => {
  const current = await currentTeacher();
  if (!current) return [];
  const { data, error } = await current.supabase.from("templates").select(COLUMNS).eq("built_in", false).order("updated_at", { ascending: false });
  if (error) throw new Error(`Could not read templates: ${error.message}`);
  return (data as unknown as Row[]).map(toTemplate).filter((t): t is Template => t !== null);
});

/** The teacher's materials, newest first, for "start from one of your Funza materials". */
export const templateMaterials = cache(async (): Promise<MaterialChoice[]> => {
  const current = await currentTeacher();
  if (!current) return [];
  const { data, error } = await current.supabase.from("resources").select("id, title, kind, status, updated_at").not("current_version_id", "is", null).order("updated_at", { ascending: false }).limit(200);
  if (error) throw new Error(`Could not read materials: ${error.message}`);
  return data.flatMap((r) => (KIND_IDS.includes(r.kind as ResourceKind) ? [{ id: r.id, title: r.title, kind: r.kind as ResourceKind, status: r.status }] : []));
});

export type ChapterChoice = { id: string; label: string };

/** The teacher's chapters as "Course · Chapter", for pinning a bank question. */
export const pinChapters = cache(async (): Promise<ChapterChoice[]> => {
  const current = await currentTeacher();
  if (!current) return [];
  const [courses, chapters] = await Promise.all([
    current.supabase.from("courses").select("id, title, position").order("position"),
    current.supabase.from("chapters").select("id, title, course_id, position").order("position"),
  ]);
  if (courses.error || chapters.error) throw new Error("Could not read chapters.");
  return courses.data.flatMap((c) => chapters.data.filter((ch) => ch.course_id === c.id).map((ch) => ({ id: ch.id, label: `${c.title} · ${ch.title}` })));
});

export const templateById = cache(async (id: string): Promise<Template | null> => {
  if (!GUID.test(id)) return null;
  const current = await currentTeacher();
  if (!current) return null;
  const { data, error } = await current.supabase.from("templates").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not read the template: ${error.message}`);
  return data ? toTemplate(data as unknown as Row) : null;
});
