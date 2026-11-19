import { CATALOG, type CatalogCourse, type CatalogIndicator, type CatalogOutcome, type CatalogUnit, type VerificationStatus } from "@/lib/curriculum/catalog";

/**
 * The shape of src/data/curriculum/sk.json, written by scripts/curriculum/import-sk.mjs,
 * and its conversion into catalog courses. Nothing here changes any official wording.
 * Safe to import in the browser (it does not read the file).
 */

export type CsvCheck = "match" | "prefix" | "mismatch" | "missing" | "no-file";

export type DatasetOutcome = {
  id: string;
  ocId: number;
  code: string;
  statement: string;
  printedWith: string | null;
  unitId: string | null;
  level: number | null;
  grade: number | null;
  url: string;
  fingerprint: string;
  status: "cross-checked" | "imported";
  csv: CsvCheck;
  indicators: { label: string; text: string }[];
  guidance: string[];
  notes: string[];
};

export type DatasetUnit = { id: string; ocId: number; name: string; level: number | null; url: string };

export type DatasetCourse = {
  id: string;
  curriculumId: number;
  name: string;
  subject: string | null;
  levels: number[];
  grades: number[];
  version: string | null;
  preliminary: boolean;
  renewal: boolean;
  url: string;
  outcomesUrl: string;
  pageSha256: string | null;
  csvFiles: string[];
  units: DatasetUnit[];
  outcomes: DatasetOutcome[];
  problem: string | null;
};

export type Dataset = {
  jurisdiction: "SK";
  name: string;
  importedOn: string;
  importer: string;
  sources: { site: string; csv: string };
  statusMeaning: Record<string, string>;
  csvMeaning: Record<CsvCheck, string>;
  excluded: { curriculumId: number; name: string }[];
  courses: DatasetCourse[];
};

/** One row of the course list the browser loads first (no outcomes). */
export type CourseSummary = {
  id: string;
  curriculumId: number;
  name: string;
  subject: string | null;
  levels: number[];
  grades: number[];
  version: string | null;
  preliminary: boolean;
  renewal: boolean;
  url: string;
  units: number;
  outcomes: number;
  indicators: number;
  crossChecked: number;
  problem: string | null;
};

/** A search result: enough to list it and to open its course. */
export type OutcomeHit = { courseId: string; courseName: string; unitName: string; id: string; code: string; statement: string; status: VerificationStatus; level: number | null };

export const PUBLISHER = "Saskatchewan Ministry of Education";
export const gradeOfLevel = (level: number | null | undefined) => (level === 10 ? 10 : level === 20 ? 11 : level === 30 ? 12 : null);

export function summarize(c: DatasetCourse): CourseSummary {
  return {
    id: c.id,
    curriculumId: c.curriculumId,
    name: c.name,
    subject: c.subject,
    levels: c.levels,
    grades: c.grades,
    version: c.version,
    preliminary: c.preliminary,
    renewal: c.renewal,
    url: c.url,
    units: c.units.length,
    outcomes: c.outcomes.length,
    indicators: c.outcomes.reduce((n, o) => n + o.indicators.length, 0),
    crossChecked: c.outcomes.filter((o) => o.status === "cross-checked").length,
    problem: c.problem,
  };
}

/** Indicator ids are unique even where the official page prints a letter twice. */
function indicatorsOf(outcomeId: string, list: DatasetOutcome["indicators"]): CatalogIndicator[] {
  const seen = new Map<string, number>();
  return list.map((i) => {
    const n = (seen.get(i.label) ?? 0) + 1;
    seen.set(i.label, n);
    return { id: `${outcomeId}-${i.label}${n > 1 ? `-${n}` : ""}`, label: i.label, text: i.text, status: "imported" };
  });
}

const METHOD = "Copied automatically from the outcome's official page by scripts/curriculum/import-sk.mjs.";

/**
 * Converts one imported course. Outcomes a team member copied by hand (CATALOG) keep
 * their id, wording and status and gain the imported indicators; a difference between
 * the two copies is added to the outcome's notes.
 */
export function toCatalogCourse(c: DatasetCourse, importedOn: string, hand = CATALOG): CatalogCourse {
  const handCourse = hand.flatMap((j) => j.courses).find((h) => h.curriculumId === c.curriculumId);
  const handOutcomes = new Map((handCourse?.units ?? []).flatMap((u) => u.outcomes).map((o) => [o.code, o]));

  const outcome = (o: DatasetOutcome): CatalogOutcome => {
    const h = handOutcomes.get(o.code);
    const id = h?.id ?? o.id;
    const indicators = indicatorsOf(id, o.indicators);
    const notes = [...o.notes];
    if (h && h.statement !== o.statement) notes.push(`The hand-copied wording differs from the imported wording: “${o.statement}”.`);
    const extra = { url: o.url, level: o.level, printedWith: o.printedWith, guidance: o.guidance, notes };
    if (h) return { ...h, ...extra, indicators, indicatorsStatus: indicators.length > 0 ? "imported" : "pending" };
    return {
      id,
      code: o.code,
      statement: o.statement,
      fingerprint: o.fingerprint,
      status: o.status,
      checkedOn: importedOn,
      method: o.status === "cross-checked" ? `${METHOD} The Ministry's CSV file has the same words.` : METHOD,
      secondCheck: "pending",
      indicators,
      indicatorsStatus: indicators.length > 0 ? "imported" : "pending",
      lessonTemplate: null,
      ...extra,
    };
  };

  const units: CatalogUnit[] = c.units.map((u) => ({ id: u.id, name: u.name, level: u.level, url: u.url, outcomes: c.outcomes.filter((o) => o.unitId === u.id).map(outcome) }));
  // Outcomes the official page lists without a unit heading, grouped by level.
  const loose = c.outcomes.filter((o) => !o.unitId || !c.units.some((u) => u.id === o.unitId));
  for (const level of [...new Set(loose.map((o) => o.level))]) {
    const list = loose.filter((o) => o.level === level);
    const modules = list.every((o) => /^Module /.test(o.printedWith ?? ""));
    const name = c.levels.length > 1 && level ? `${level}-level outcomes` : modules ? "Modules" : "Outcomes";
    units.push({ id: `${c.id}-l${level ?? "x"}`, name, level, outcomes: list.map(outcome) });
  }

  return {
    id: c.id,
    name: c.name,
    grade: Math.min(...(c.grades.length > 0 ? c.grades : [10])),
    curriculumId: c.curriculumId,
    subject: c.subject,
    levels: c.levels,
    origin: "import",
    source: { url: c.outcomesUrl, publisher: PUBLISHER, retrievedOn: importedOn, versionLabel: c.version, reuseTerms: null },
    units: units.filter((u) => u.outcomes.length > 0),
  };
}

/** Light shape check for courses read back from browser storage or the network. */
export function isCatalogCourse(v: unknown): v is CatalogCourse {
  if (!v || typeof v !== "object") return false;
  const c = v as Partial<CatalogCourse>;
  if (typeof c.id !== "string" || typeof c.name !== "string" || typeof c.grade !== "number" || !c.source || typeof c.source.url !== "string" || !Array.isArray(c.units)) return false;
  return c.units.every(
    (u) =>
      u &&
      typeof u.id === "string" &&
      typeof u.name === "string" &&
      Array.isArray(u.outcomes) &&
      u.outcomes.every((o) => o && typeof o.id === "string" && typeof o.code === "string" && typeof o.statement === "string" && typeof o.fingerprint === "string" && typeof o.status === "string" && Array.isArray(o.indicators)),
  );
}
