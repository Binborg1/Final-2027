import type { DatasetCourse, DatasetOutcome } from "@/lib/curriculum/imported";

/**
 * A new course's chapters, from the Saskatchewan curriculum (FR-3). Pure, so the
 * rule is tested on its own; the server inserts the rows (lib/courses/server.ts).
 *
 * - Units with outcomes at the course's level: one chapter per unit.
 * - Practical and Applied Arts modules: one chapter per module.
 * - Outcomes with no unit or module (all the Mathematics courses): one chapter per
 *   outcome. The teacher renames, reorders or deletes them.
 * - No web outcomes at all: one chapter per unit of the curriculum document, or a
 *   single "Chapter 1".
 *
 * Seeded chapters name their source (source_kind + source_ref), so seeding again
 * adds nothing (unique per course in the database).
 */

export type SourceKind = "unit" | "module" | "outcome" | "custom";
export type ChapterSeed = { title: string; position: number; source_kind: SourceKind; source_ref: string | null; outcome_refs: string[] };

const TITLE_MAX = 200;
const OUTCOME_TITLE_MAX = 90;

/** Does the outcome belong to the course at this level (10, 20 or 30)? Outcomes the source gives no level belong to every level. */
export function atLevel(o: Pick<DatasetOutcome, "level" | "levels">, level: number): boolean {
  if (o.levels && o.levels.length > 0) return o.levels.includes(level);
  return o.level == null || o.level === level;
}

/** "Module 1: Introduction to Accounting (Core) · …" → "Module 1: Introduction to Accounting (Core)". */
function moduleTitle(o: DatasetOutcome): string {
  const printed = o.printedWith?.split(" · ")[0]?.trim();
  return clip(printed || `${o.code}: ${o.title ?? o.statement}`, TITLE_MAX);
}

/** "P20.1: Demonstrate understanding of absolute value…", cut at a word. */
export function outcomeTitle(o: Pick<DatasetOutcome, "code" | "statement" | "title">): string {
  return clip(`${o.code}: ${o.title ?? o.statement}`, OUTCOME_TITLE_MAX);
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:–-]+$/, "")}…`;
}

export function chapterSeeds(course: Pick<DatasetCourse, "units" | "outcomes" | "document">, level: number): ChapterSeed[] {
  const idOf = (o: DatasetOutcome) => o.id;
  const outcomes = course.outcomes.filter((o) => atLevel(o, level));
  const seeds: Omit<ChapterSeed, "position">[] = [];

  if (outcomes.length > 0) {
    const used = new Set<string>();
    for (const unit of course.units) {
      if (unit.kind === "empty" || unit.kind === "themes") continue;
      const inUnit = outcomes.filter((o) => o.unitId === unit.id);
      if (inUnit.length === 0) continue;
      inUnit.forEach((o) => used.add(o.id));
      seeds.push({ title: clip(unit.name, TITLE_MAX), source_kind: "unit", source_ref: unit.id, outcome_refs: inUnit.map(idOf) });
    }
    for (const o of outcomes) {
      if (used.has(o.id)) continue;
      seeds.push(
        o.module
          ? { title: moduleTitle(o), source_kind: "module", source_ref: idOf(o), outcome_refs: [idOf(o)] }
          : { title: outcomeTitle(o), source_kind: "outcome", source_ref: idOf(o), outcome_refs: [idOf(o)] },
      );
    }
  } else {
    const names = [...new Set((course.document?.units ?? []).map((u) => (u.name ?? "").replace(/\s+/g, " ").trim()).filter(Boolean))];
    for (const name of names) seeds.push({ title: clip(name, TITLE_MAX), source_kind: "custom", source_ref: null, outcome_refs: [] });
    if (seeds.length === 0) seeds.push({ title: "Chapter 1", source_kind: "custom", source_ref: null, outcome_refs: [] });
  }

  return seeds.map((s, i) => ({ ...s, position: i }));
}
