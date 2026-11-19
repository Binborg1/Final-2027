import { currentCatalog, findOutcome, type FoundOutcome } from "@/lib/curriculum/catalog";

/**
 * Small helpers over the catalog for the interface. None of it is AI output.
 * The course list itself comes from the imported dataset (/api/curriculum).
 */

export const SOURCES = {
  home: "https://curriculum.gov.sk.ca/",
} as const;

export const codeOf = (id: string) => findOutcome(id)?.outcome.code ?? id;

/** Every outcome this runtime knows: hand-copied ones plus the imported courses it has loaded. */
export function knownOutcomes(): FoundOutcome[] {
  return currentCatalog().flatMap((jurisdiction) => jurisdiction.courses.flatMap((course) => course.units.flatMap((unit) => unit.outcomes.map((outcome) => ({ jurisdiction, course, unit, outcome })))));
}

/** The other outcomes in the courses these outcomes come from (for "add an outcome" menus). */
export function outcomesInSameCourses(ids: string[]): FoundOutcome[] {
  const courseIds = new Set(ids.map((id) => findOutcome(id)?.course.id).filter(Boolean));
  return knownOutcomes().filter((f) => courseIds.has(f.course.id) && !ids.includes(f.outcome.id));
}

/** Course and unit names for a resource: those of its first outcome. */
export function placeOf(ids: string[]): { courseName: string; unitName: string } {
  const f = ids.map((id) => findOutcome(id)).find(Boolean);
  return { courseName: f?.course.name ?? "", unitName: f?.unit.name ?? "" };
}
