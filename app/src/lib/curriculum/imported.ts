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
  /** Every level the source assigns this outcome to (a module may sit in several course configurations); empty when it assigns none. */
  levels?: number[];
  /** Where `level`/`levels` come from when not from the code, unit or course name. */
  levelSource?: "course configurations";
  /** A Practical and Applied Arts style module: `code` is its module code and `printedWith` starts with its name. */
  module?: boolean;
  /** The short official title printed before " – " (Physical Education). */
  title?: string;
  /** The K-12 mathematics goals printed above the outcome in the curriculum document. */
  goals?: string[];
  goalsSource?: { url: string; page: number; printedCode?: string };
};

/** "outcomes": a unit with outcomes. "themes": ELA's suggested thematic units (see the course's themes). "empty": a heading with nothing under it. */
export type UnitKind = "outcomes" | "themes" | "empty";

export type DatasetUnit = { id: string; ocId: number; name: string; level: number | null; url: string; kind?: UnitKind; outcomeIds?: string[] };

/** Quoted evidence, or an observation of the page structure where the source prints no sentence about it. */
export type Evidence = { url: string; quote?: string; observation?: string; page?: number | null };

export type ConfigurationModule = {
  /** As printed on the configuration page. */
  code: string;
  name: string;
  ocId: number | null;
  curriculumId: number | null;
  designation?: string;
  outcomeId?: string;
  /** The module belongs to another curriculum. */
  borrowedFrom?: number;
  /** The dataset code this entry resolves to when it is printed differently, and why. */
  datasetCode?: string;
  correction?: string;
  matchedBy?: string;
  inDataset: boolean;
  note?: string;
};

export type CourseConfiguration = { occ: number; name: string; level: number | null; url: string; note?: string; sections: { name: string | null; moduleCodes: string[]; modules: ConfigurationModule[] }[] };

export type DocumentItem = { code: string | null; type: string; text: string; page?: number; [key: string]: unknown };

/** A verbatim extraction of the official curriculum document (src/data/curriculum/documents/). */
export type CourseDocument = {
  status: "document-extracted" | "document-ocr-unverified";
  textSource: "text-layer" | "ocr";
  url: string;
  filename: string | null;
  sha256: string;
  retrievedOn: string;
  pages: number[] | number | null;
  kind: string | null;
  partial?: boolean;
  partialReason?: string;
  file: string;
  check: string;
  units: { name: string | null; items: DocumentItem[]; [key: string]: unknown }[];
  flags: { unit: number; item: number; code: string | null; flags: string[] }[];
  notes: string[];
};

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
  /** The site's Browse by Subject or Browse by Grade menus link to the course. */
  listedInMenu?: boolean;
  /** The heading the course sits under in the Browse by Subject menu. */
  menuSubject?: string | null;
  legacy?: boolean;
  legacyEvidence?: { reason: string; replacedBy?: number[]; evidence: string[] };
  notACurriculum?: boolean;
  notACurriculumEvidence?: { reason: string; evidence: string[] };
  /** Taught within other subjects (Treaty Education). */
  crossCurricular?: boolean;
  availability?: { outcomesPage: string; document?: string; curriculumFile?: string };
  grouping?: { kind: "unit" | "module" | "none"; evidence: Evidence; allEvidence?: Evidence[] } | null;
  /** ELA's suggested thematic units: tied to a course part by the curriculum document, never to outcomes. */
  themes?: { ocId: number | null; name: string; groupOcId: number | null; url: string | null; coursePart: string | null; documentName?: string; citation?: { url: string; where: string } }[];
  suggestedUnits?: { heading: string; names: string[]; url: string; page: number; evidence: Evidence };
  configurations?: CourseConfiguration[];
  document?: CourseDocument;
};

export type Dataset = {
  jurisdiction: "SK";
  language?: "en" | "fr";
  name: string;
  importedOn: string;
  importer: string;
  sources: { site: string; csv: string; documents?: string; evidence?: string };
  statusMeaning: Record<string, string>;
  csvMeaning: Record<CsvCheck, string>;
  flagsMeaning?: Record<string, string>;
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
