import { isQuestionKind, QTYPE_LABEL } from "@/lib/resources/kinds";
import type { Brief, Draft, QType, Section } from "@/lib/resources/types";
import { categoryOf, sanitizeFormat, sectionLetter, starterFormat, type TemplateCategory, type TemplateFormat, type TemplateSection } from "@/lib/templates/model";

/**
 * Templates made without reading an example: from a Funza material the teacher
 * already has (its exact structure), or from Make's own settings ("save these
 * settings as a template"). Both are worked out by code, with no AI.
 */

/** The most common value, the first one on a tie. */
function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0] ?? 1;
  for (const [v, c] of counts) if (c > (counts.get(best) ?? 0)) best = v;
  return best;
}

/** A material's question sections as a layout: per section, its types in order of first use, with their count and usual marks. */
export function layoutOfSections(sections: Section[]): TemplateSection[] {
  return sections
    .filter((s) => s.kind === "questions" && s.items.length > 0)
    .map((s) => {
      const types: QType[] = [];
      for (const it of s.items) if (!types.includes(it.type)) types.push(it.type);
      return {
        title: s.title,
        instructions: s.body,
        rows: types.map((type) => {
          const items = s.items.filter((i) => i.type === type);
          return { type, count: items.length, marks: mode(items.map((i) => i.marks)) };
        }),
      };
    });
}

/**
 * The exact structure of a quiz, test or exam the teacher made in Funza, with the
 * settings of its brief. Notes and slides have topic titles, not a format, so they
 * are read by Funza instead (see `materialText`); this returns null for them.
 */
export function formatFromDraft(draft: Draft, brief: Brief): TemplateFormat | null {
  if (!isQuestionKind(draft.kind)) return null;
  const category = categoryOf(draft.kind) as "quiz" | "exam";
  return sanitizeFormat(category, {
    sections: layoutOfSections(draft.sections),
    duration: draft.duration ?? brief.duration,
    difficulty: brief.difficulty,
    extras: { answerKey: brief.answerKey, workedSolutions: brief.workedSolutions, rubric: brief.rubric },
    style: brief.style ?? {},
  });
}

/** A material as plain text for "Read the format": section titles and the start of each section and question, no answers. */
export function materialText(draft: Draft): string {
  const out: string[] = [draft.title];
  for (const s of draft.sections) {
    out.push(`## ${s.title}`);
    if (s.body) out.push(s.body.slice(0, 600));
    s.items.forEach((it, i) => out.push(`${i + 1}. ${it.prompt.slice(0, 160)} (${it.marks} mark${it.marks === 1 ? "" : "s"})`));
  }
  return out.join("\n").slice(0, 12000);
}

/** Make's current settings as a template: each question type becomes its own part; notes and slides keep Funza's usual parts. */
export function formatFromBrief(b: Brief): TemplateFormat | null {
  const category: TemplateCategory = categoryOf(b.kind);
  const style = b.style ?? {};
  if (category === "quiz" || category === "exam") {
    const rows = b.layout ? null : b.mix.filter((r) => r.count > 0);
    const sections = b.layout ?? (rows ?? []).map((r, i) => ({ title: `Part ${sectionLetter(i)}: ${QTYPE_LABEL[r.type]}`, instructions: "", rows: [{ type: r.type, count: r.count, marks: r.marks }] }));
    return sanitizeFormat(category, { sections, duration: b.duration, difficulty: b.difficulty, extras: { answerKey: b.answerKey, workedSolutions: b.workedSolutions, rubric: b.rubric }, style });
  }
  const starter = starterFormat(category);
  if (category === "notes") return sanitizeFormat("notes", { ...starter, parts: b.parts ?? (starter.category === "notes" ? starter.parts : []), notesStyle: b.notesStyle, keyTerms: b.keyTerms, checkQuestions: b.checkQuestions, style });
  return sanitizeFormat("slides", { ...starter, parts: b.parts ?? (starter.category === "slides" ? starter.parts : []), slides: b.slides, speakerNotes: b.speakerNotes, style });
}

const shape = (layout: TemplateSection[]) => JSON.stringify(layout.map((s) => [s.title.trim(), s.instructions.trim(), s.rows.map((r) => [r.type, r.count, r.marks])]));

/**
 * True when a material's sections no longer match the template layout it was made
 * from (a section added or renamed, a question more or less, different marks, other
 * instructions) or its time changed (T7: "Save this to the template?").
 */
export function structureChanged(layout: TemplateSection[], sections: Section[], madeWith: number, now: number | null): boolean {
  return shape(layout) !== shape(layoutOfSections(sections)) || (now !== null && now !== madeWith);
}
