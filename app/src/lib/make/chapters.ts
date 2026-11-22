import type { CatalogCourse, CatalogOutcome, CatalogUnit } from "@/lib/curriculum/catalog";

/**
 * Chapters for Make, until step 4 stores real chapters: a course's curriculum
 * units at the course's level. Courses whose official page lists outcomes without
 * units get one pseudo-unit per level (ids ending "-l20"); for those, Make shows
 * the outcomes themselves as chips instead.
 */

export type Chapter = { id: string; name: string; outcomes: CatalogOutcome[] };
export type Chapters = { mode: "units"; chapters: Chapter[] } | { mode: "outcomes"; outcomes: CatalogOutcome[] };

const isPseudoUnit = (u: CatalogUnit) => /-l(\d+|x)$/.test(u.id);

/** An outcome belongs to a level if it (or its unit) says so; outcomes with no level belong to every level. */
const atLevel = (o: CatalogOutcome, u: CatalogUnit, level: number | null) => {
  const l = o.level ?? u.level ?? null;
  return level === null || l === null || l === level;
};

export function chaptersFor(course: CatalogCourse, level: number | null): Chapters {
  const units = course.units.map((u) => ({ unit: u, outcomes: u.outcomes.filter((o) => atLevel(o, u, level)) })).filter((x) => x.outcomes.length > 0);
  const real = units.filter((x) => !isPseudoUnit(x.unit));
  if (real.length === 0) return { mode: "outcomes", outcomes: units.flatMap((x) => x.outcomes) };
  // Loose outcomes next to real units still need a home: keep them as their own chapter.
  return { mode: "units", chapters: units.map((x) => ({ id: x.unit.id, name: isPseudoUnit(x.unit) ? "Other outcomes" : x.unit.name, outcomes: x.outcomes })) };
}

/** The phrases the "Add" quick-prompt chips put in the brief. */
export const ADD_PROMPTS = [
  { id: "notes", label: "Use my notes", text: "Base it on the attached notes." },
  { id: "eal", label: "EAL-friendly", text: "Use plain language that suits English language learners." },
  { id: "sk", label: "Saskatchewan examples", text: "Use Saskatchewan places and contexts in examples." },
  { id: "table", label: "Include a data table", text: "Include at least one question that uses a data table." },
  { id: "notricks", label: "No trick questions", text: "Avoid trick questions and double negatives." },
] as const;
export type AddPromptId = (typeof ADD_PROMPTS)[number]["id"];

/** The teacher's request plus the chosen quick prompts, within the server's 600-character limit. */
export function composeInstructions(request: string, chips: readonly string[]): string {
  const extra = ADD_PROMPTS.filter((p) => chips.includes(p.id) && p.id !== "notes").map((p) => p.text);
  return [request.trim(), ...extra].filter(Boolean).join(" ").slice(0, 600);
}
