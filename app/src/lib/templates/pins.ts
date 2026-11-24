import { itemFromBank } from "@/lib/live/questions";
import { MAX_PINS, type TemplatePin } from "@/lib/templates/model";

type PinRow = { section: number; position: number; questions: { id: string; type: string; stem: string; options: unknown; answer: unknown; marks: number; outcome_ref: string | null } | null };

/** Stored pins (with their bank questions) as the app uses them, in section and pin order. */
export function pinsOf(rows: unknown): TemplatePin[] {
  return (Array.isArray(rows) ? (rows as PinRow[]) : [])
    .filter((p) => p && p.questions && typeof p.section === "number")
    .sort((a, b) => a.section - b.section || a.position - b.position)
    .slice(0, MAX_PINS)
    .map((p) => {
      const q = p.questions!;
      return { questionId: q.id, section: p.section, item: { ...itemFromBank(q), id: `pin-${q.id}`, origin: "bank" as const } };
    });
}
