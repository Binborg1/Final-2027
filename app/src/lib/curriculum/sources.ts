import { CATALOG, findOutcome, type CatalogOutcome } from "@/lib/curriculum/catalog";

/**
 * Curriculum facts that sit beside the catalog. None of it is AI output.
 * - COURSES: names exactly as printed on the curriculum.gov.sk.ca home page
 *   ("Levels 10, 20, 30"), read on 18 Nov 2026. Only courses with a catalog id have
 *   verified content in Funza; the rest are listed so teachers see what is missing.
 * - STAGED_INDICATORS: read from the official per-outcome page on 18 Nov 2026 and
 *   not yet checked by a team member. Shown as "awaiting team review"; never used
 *   for alignment or sent to the AI (the catalog's indicators stay empty until verified).
 */

export const SOURCES = {
  home: "https://curriculum.gov.sk.ca/",
  sci10: "https://curriculum.gov.sk.ca/CurriculumOutcomeContent?id=63",
  fm2: "https://curriculum.gov.sk.ca/CurriculumOutcomeContent?id=63&oc=110477",
} as const;

export const SK = CATALOG.find((j) => j.id === "sk")!;
export const ALL_OUTCOMES: CatalogOutcome[] = SK.courses.flatMap((c) => c.units.flatMap((u) => u.outcomes));
export const codeOf = (id: string) => findOutcome(id)?.outcome.code ?? id;

export type CourseEntry = {
  name: string;
  level: 10 | 20 | 30;
  grade: 10 | 11 | 12;
  subject: "Science" | "Mathematics";
  /** The catalog course when Funza has verified content for it. */
  catalogId: string | null;
};

const course = (name: string, level: 10 | 20 | 30, subject: CourseEntry["subject"], catalogId: string | null = null): CourseEntry => ({
  name,
  level,
  grade: level === 10 ? 10 : level === 20 ? 11 : 12,
  subject,
  catalogId,
});

export const COURSES: CourseEntry[] = [
  course("Science 10", 10, "Science", "sk-science-10"),
  course("Computer Science 20", 20, "Science"),
  course("Environmental Science 20", 20, "Science"),
  course("Health Science 20", 20, "Science"),
  course("Physical Science 20", 20, "Science"),
  course("Biology 30", 30, "Science"),
  course("Chemistry 30", 30, "Science"),
  course("Computer Science 30", 30, "Science"),
  course("Earth Science 30", 30, "Science"),
  course("Physics 30", 30, "Science"),
  course("Foundations of Mathematics and Pre-calculus 10", 10, "Mathematics"),
  course("Workplace and Apprenticeship Mathematics 10", 10, "Mathematics"),
  course("Foundations of Mathematics 20", 20, "Mathematics"),
  course("Pre-Calculus 20", 20, "Mathematics"),
  course("Workplace and Apprenticeship Mathematics 20", 20, "Mathematics"),
  course("Foundations of Mathematics 30", 30, "Mathematics"),
  course("Pre-Calculus 30", 30, "Mathematics"),
  course("Workplace and Apprenticeship Mathematics 30", 30, "Mathematics"),
  course("Calculus 30", 30, "Mathematics"),
];

export type StagedIndicator = { label: string; text: string | null; note?: string };

export const STAGED_INDICATORS: Record<string, { url: string; retrievedOn: string; items: StagedIndicator[] }> = {
  "sk-sci10-fm2": {
    url: SOURCES.fm2,
    retrievedOn: "2026-11-18",
    items: [
      { label: "a", text: "Provide examples of objects that exhibit, or appear to exhibit, uniform motion. (K)" },
      { label: "b", text: null },
      { label: "c", text: null },
      { label: "d", text: null },
      { label: "e", text: null },
      { label: "f", text: null },
      { label: "g", text: "Describe quantitatively the relationship among distance, time and speed for everyday objects that undergo uniform motion. (K)" },
      { label: "h", text: null },
      {
        label: "b",
        text: "Solve problems related to the motion of objects that travel at a constant speed in a straight line. (S)",
        note: "Printed as a second “(b)” on the source page. The intended label needs a person to confirm it.",
      },
    ],
  },
};
