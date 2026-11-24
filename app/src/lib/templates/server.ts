import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import type { ResourceKind } from "@/lib/resources/types";
import type { TemplateChoice } from "@/lib/templates/apply";
import { categoryOf, isCategory, sanitizeFormat, type TemplateGuide } from "@/lib/templates/model";

/**
 * The template a draft follows, read on the server with the teacher's own session
 * (row-level security: only their own, or a built-in one). The browser's copy of a
 * layout is never used.
 */
export async function loadTemplateFor(
  supabase: SupabaseClient<Database>,
  id: string,
  kind: ResourceKind,
): Promise<{ ok: true; template: TemplateChoice } | { ok: false; reason: "template-missing" | "template-kind"; message: string }> {
  const { data, error } = await supabase.from("templates").select("id, kind, name, format").eq("id", id).maybeSingle();
  if (error) console.error("Reading a template failed:", error.message);
  const missing = { ok: false as const, reason: "template-missing" as const, message: "That template was deleted. Choose another, or switch to Adjust." };
  if (!data || !isCategory(data.kind)) return missing;
  if (data.kind !== categoryOf(kind)) return { ok: false, reason: "template-kind", message: "That template is for another kind of material. Choose another, or switch to Adjust." };
  const format = sanitizeFormat(data.kind, data.format);
  if (!format) return missing;
  return { ok: true, template: { id: data.id, category: data.kind, name: data.name, format } };
}

export function guideOf(t: TemplateChoice): TemplateGuide {
  return { name: t.name, style: t.format.style, perSlide: t.format.category === "slides" ? t.format.perSlide : null };
}
