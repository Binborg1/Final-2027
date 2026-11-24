import "server-only";
import { cache } from "react";
import { currentTeacher } from "@/lib/auth/teacher";
import { GUID } from "@/lib/resources/sanitize";
import { isCategory, sanitizeFormat, sanitizeLearnedFrom, type Template } from "@/lib/templates/model";

/**
 * The teacher's templates, read through their own session (row-level security
 * returns only their rows). Each stored format is rebuilt on the way out; a row
 * that can't be read comes back with `format: null`, and can only be deleted.
 */

const COLUMNS = "id, kind, name, summary, format, learned_from, updated_at, built_in, resources(count)";
const countOf = (v: unknown) => (Array.isArray(v) && v[0] && typeof v[0] === "object" && "count" in v[0] ? Number(v[0].count) || 0 : 0);

type Row = { id: string; kind: string; name: string; summary: string; format: unknown; learned_from: unknown; updated_at: string; built_in: boolean; resources: unknown };

function toTemplate(r: Row): Template | null {
  if (!isCategory(r.kind) || r.built_in) return null;
  return { id: r.id, category: r.kind, name: r.name, summary: r.summary, format: sanitizeFormat(r.kind, r.format), learnedFrom: sanitizeLearnedFrom(r.learned_from), used: countOf(r.resources), updatedAt: r.updated_at };
}

export const templateList = cache(async (): Promise<Template[]> => {
  const current = await currentTeacher();
  if (!current) return [];
  const { data, error } = await current.supabase.from("templates").select(COLUMNS).eq("built_in", false).order("updated_at", { ascending: false });
  if (error) throw new Error(`Could not read templates: ${error.message}`);
  return (data as Row[]).map(toTemplate).filter((t): t is Template => t !== null);
});

export const templateById = cache(async (id: string): Promise<Template | null> => {
  if (!GUID.test(id)) return null;
  const current = await currentTeacher();
  if (!current) return null;
  const { data, error } = await current.supabase.from("templates").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not read the template: ${error.message}`);
  return data ? toTemplate(data as Row) : null;
});
