import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import type { ResourceKind } from "@/lib/resources/types";
import type { TemplateChoice } from "@/lib/templates/apply";
import { categoryOf, isCategory, PIN_COLUMNS, sanitizeFormat, type TemplateGuide } from "@/lib/templates/model";
import { pinsOf } from "@/lib/templates/pins";

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
  const { data: row, error } = await supabase.from("templates").select(`id, kind, name, format, ${PIN_COLUMNS}`).eq("id", id).maybeSingle();
  const data = row as unknown as { id: string; kind: string; name: string; format: unknown; template_pins: unknown } | null;
  if (error) console.error("Reading a template failed:", error.message);
  const missing = { ok: false as const, reason: "template-missing" as const, message: "That template was deleted. Choose another, or switch to Adjust." };
  if (!data || !isCategory(data.kind)) return missing;
  if (data.kind !== categoryOf(kind)) return { ok: false, reason: "template-kind", message: "That template is for another kind of material. Choose another, or switch to Adjust." };
  const format = sanitizeFormat(data.kind, data.format);
  if (!format) return missing;
  return { ok: true, template: { id: data.id, category: data.kind, name: data.name, format, pins: pinsOf(data.template_pins) } };
}

export function guideOf(t: TemplateChoice): TemplateGuide {
  return { name: t.name, style: t.format.style, perSlide: t.format.category === "slides" ? t.format.perSlide : null };
}
