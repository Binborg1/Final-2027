import type { Brief, MixRow } from "@/lib/resources/types";
import { categoryOf, isQuestionFormat, type TemplateCategory, type TemplateFormat, type TemplatePin, type TemplateSection } from "@/lib/templates/model";

/**
 * Using a template on Make: the brief takes the template's layout or parts and its
 * settings. The teacher's own Adjust settings are kept aside (`controlsOf`) and come
 * back when they switch to Adjust. The server applies the stored template again
 * before drafting, so what the browser sends is never trusted.
 */

export type TemplateChoice = { id: string; category: TemplateCategory; name: string; format: TemplateFormat; pins?: TemplatePin[] };

/**
 * The pins that still fit the layout: in a section that exists, of a type that
 * section asks for, and no more of a type than the section's count. A pin left
 * over after the template was changed is skipped, not forced in.
 */
export function fittingPins<P extends { section: number; item: { type: string } }>(layout: TemplateSection[], pins: P[] = []): P[] {
  const used = new Map<string, number>();
  return pins.filter((p) => {
    const row = layout[p.section]?.rows.find((r) => r.type === p.item.type);
    if (!row) return false;
    const key = `${p.section}:${row.type}`;
    const n = (used.get(key) ?? 0) + 1;
    if (n > row.count) return false;
    used.set(key, n);
    return true;
  });
}

/** What Funza still writes in each section once the pinned questions are placed. */
export function aiLayout(layout: TemplateSection[], pinned: Brief["pinned"]): TemplateSection[] {
  const pins = fittingPins(layout, pinned ?? []);
  return layout.map((s, k) => ({ ...s, rows: s.rows.map((r) => ({ ...r, count: r.count - pins.filter((p) => p.section === k && p.item.type === r.type).length })) }));
}

export type Controls = Pick<Brief, "mix" | "duration" | "difficulty" | "answerKey" | "workedSolutions" | "rubric" | "notesStyle" | "keyTerms" | "checkQuestions" | "slides" | "speakerNotes">;

export function controlsOf(b: Brief): Controls {
  return {
    mix: b.mix.map((r) => ({ ...r })),
    duration: b.duration,
    difficulty: b.difficulty,
    answerKey: b.answerKey,
    workedSolutions: b.workedSolutions,
    rubric: b.rubric,
    notesStyle: b.notesStyle,
    keyTerms: b.keyTerms,
    checkQuestions: b.checkQuestions,
    slides: b.slides,
    speakerNotes: b.speakerNotes,
  };
}

/** The per-type mix a layout adds up to (counts summed; marks from the type's first row), for code that reads `mix`. */
export function aggregateMix(base: MixRow[], layout: TemplateSection[]): MixRow[] {
  return base.map((r) => {
    const rows = layout.flatMap((s) => s.rows.filter((x) => x.type === r.type));
    return rows.length ? { type: r.type, count: rows.reduce((n, x) => n + x.count, 0), marks: rows[0].marks } : { ...r, count: 0 };
  });
}

/** The brief made from a template. Throws when the template is for another kind of material. */
export function applyTemplate(b: Brief, t: TemplateChoice): Brief {
  if (categoryOf(b.kind) !== t.category || t.format.category !== t.category) throw new Error("That template is for another kind of material.");
  const f = t.format;
  if (isQuestionFormat(f)) {
    const pinned = fittingPins(f.sections, t.pins ?? []).map((p) => ({ section: p.section, item: p.item }));
    return { ...b, templateId: t.id, style: f.style, drafted: null, pinned: pinned.length > 0 ? pinned : null, layout: f.sections.map((s) => ({ ...s, rows: s.rows.map((r) => ({ ...r })) })), parts: null, mix: aggregateMix(b.mix, f.sections), duration: f.duration, difficulty: f.difficulty, answerKey: f.extras.answerKey, workedSolutions: f.extras.workedSolutions, rubric: f.extras.rubric };
  }
  if (f.category === "notes") {
    return { ...b, templateId: t.id, style: f.style, drafted: null, pinned: null, layout: null, parts: f.parts.map((p) => ({ ...p })), notesStyle: f.notesStyle ?? b.notesStyle, keyTerms: f.keyTerms, checkQuestions: f.checkQuestions };
  }
  return { ...b, templateId: t.id, style: f.style, drafted: null, pinned: null, layout: null, parts: f.parts.map((p) => ({ ...p })), slides: f.slides, speakerNotes: f.speakerNotes };
}

/** Back to Funza's own controls: the teacher's earlier settings, or the kind's defaults. */
export function clearTemplate(b: Brief, controls: Controls): Brief {
  return { ...b, ...controls, mix: controls.mix.map((r) => ({ ...r })), templateId: null, layout: null, parts: null, style: null, drafted: null, pinned: null };
}
