/**
 * The curriculum catalog: official outcomes Funza may align materials to.
 *
 * Everything here was copied from the official source named on the course and
 * must never be written by an AI or edited from memory. An outcome enters the
 * catalog only with its source, retrieval date and a SHA-256 fingerprint of the
 * exact wording, so any change to the text is detectable.
 *
 * Every Saskatchewan Grade 10–12 curriculum is copied by
 * scripts/curriculum/import-sk.mjs into src/data/curriculum/sk.json. The server
 * registers all of them (src/lib/curriculum/dataset.ts); the browser registers the
 * courses it opens (src/lib/curriculum/client.ts). The hand-copied Science 10 entry
 * that came first was removed on 23 November 2026: the import has the same words
 * (checked against the Ministry's CSV) and its indicators.
 */

export type VerificationStatus =
  /** Retrieved from the official source and compared by two people. */
  | "verified"
  /** Copied from the official source on the retrieval date; the second-person check is still pending. */
  | "source-checked"
  /** Copied automatically from the official page, and the Ministry's CSV file has the same words. Not checked by a person. */
  | "cross-checked"
  /** Copied automatically from the official page; no second source agreed (no CSV, or it words it differently). Not checked by a person. */
  | "imported"
  /** Not checked against the source. Never offered to teachers. */
  | "unverified";

export type CatalogIndicator = {
  id: string;
  /** As printed, e.g. "a". */
  label: string;
  text: string;
  status: VerificationStatus;
};

export type CatalogOutcome = {
  /** Funza's stable id. */
  id: string;
  /** The official code, exactly as printed. */
  code: string;
  /** The official wording, verbatim. */
  statement: string;
  /** "sha256:" + hex digest of `statement` (UTF-8). */
  fingerprint: string;
  status: VerificationStatus;
  checkedOn: string;
  method: string;
  secondCheck: "pending" | "done";
  /** Verified indicators, or imported ones (each marked "imported"). Empty while `indicatorsStatus` is "pending". */
  indicators: CatalogIndicator[];
  indicatorsStatus: "verified" | "imported" | "pending";
  /** The outcome's own official page. */
  url?: string;
  /** 10, 20 or 30. */
  level?: number | null;
  /** Text printed between the statement and the indicators, e.g. mathematics' process codes. */
  printedWith?: string | null;
  /** Unlettered notes printed among the indicators. */
  guidance?: string[];
  /** What the importer noticed on the official page that a person should look at. */
  notes?: string[];
};

export type CatalogUnit = { id: string; name: string; outcomes: CatalogOutcome[]; level?: number | null; url?: string };

export type CatalogSource = {
  url: string;
  publisher: string;
  retrievedOn: string;
  /** The version or year printed on the source, or null when the page shows none. */
  versionLabel: string | null;
  /** Reuse terms as stated on the source, or null when none are stated. */
  reuseTerms: string | null;
};

export type CatalogCourse = {
  id: string;
  name: string;
  /** The lowest grade the course covers. */
  grade: number;
  source: CatalogSource;
  units: CatalogUnit[];
  /** The id on curriculum.gov.sk.ca. */
  curriculumId?: number;
  subject?: string | null;
  /** 10, 20 and/or 30. */
  levels?: number[];
  /** How the course's outcomes were brought into Funza. */
  origin?: "import";
};

export type Jurisdiction = { id: string; name: string; courses: CatalogCourse[] };

/** Only these hosts count as an official source. */
export const OFFICIAL_SOURCE_HOSTS = ["curriculum.gov.sk.ca"] as const;

/** Statuses a teacher may build a resource on. Automatic ones are disclosed in `outcomeLimitations` and the review checklist. */
export const USABLE_STATUSES: readonly VerificationStatus[] = ["verified", "source-checked", "cross-checked", "imported"];

/** Statuses no person has checked. */
export const AUTOMATIC_STATUSES: readonly VerificationStatus[] = ["cross-checked", "imported"];

/** The jurisdictions Funza knows. Courses are registered from the imported dataset. */
export const CATALOG: Jurisdiction[] = [{ id: "sk", name: "Saskatchewan", courses: [] }];

/* ---------- imported courses known to this runtime ---------- */

const imported = new Map<string, CatalogCourse>();
let current: Jurisdiction[] = CATALOG;
let version = 0;
const catalogListeners = new Set<() => void>();

/** Adds imported courses to the catalog this runtime knows. */
export function registerCourses(courses: CatalogCourse[]) {
  if (courses.length === 0) return;
  for (const c of courses) imported.set(c.id, c);
  current = CATALOG.map((j) => (j.id !== "sk" ? j : { ...j, courses: [...j.courses, ...imported.values()] }));
  version++;
  catalogListeners.forEach((l) => l());
}
export const registeredCourses = (): CatalogCourse[] => [...imported.values()];
export const isRegistered = (courseId: string) => imported.has(courseId);
/** The catalog as this runtime knows it: the registered imported courses. */
export const currentCatalog = (): Jurisdiction[] => current;
export const catalogVersion = () => version;
export function subscribeCatalog(listener: () => void) {
  catalogListeners.add(listener);
  return () => {
    catalogListeners.delete(listener);
  };
}

/** Funza outcome ids: "sk-<curriculum id>-<outcome id>", such as "sk-63-110477". */
export const OUTCOME_ID = /^sk-[a-z0-9]+(?:-[a-z0-9]+){1,3}$/;

export type FoundOutcome = { jurisdiction: Jurisdiction; course: CatalogCourse; unit: CatalogUnit; outcome: CatalogOutcome };

export function findOutcome(id: string, catalog: Jurisdiction[] = current): FoundOutcome | null {
  for (const jurisdiction of catalog) {
    for (const course of jurisdiction.courses) {
      for (const unit of course.units) {
        const outcome = unit.outcomes.find((o) => o.id === id);
        if (outcome) return { jurisdiction, course, unit, outcome };
      }
    }
  }
  return null;
}

/** A SHA-256 hex digest of a UTF-8 string; injected so this module stays usable in the browser. */
export type Hasher = (text: string) => string;

/** Why an entry may not be used. Empty means it is sound. Pass a hasher to also check the wording against its fingerprint. */
export function outcomeProblems(found: FoundOutcome, hasher?: Hasher): string[] {
  const { course, outcome } = found;
  const problems: string[] = [];
  let host = "";
  try {
    host = new URL(course.source.url).hostname;
  } catch {
    problems.push("The course has no valid source URL.");
  }
  if (host && !(OFFICIAL_SOURCE_HOSTS as readonly string[]).includes(host)) problems.push(`The source ${host} is not an official curriculum site.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(course.source.retrievedOn)) problems.push("The source has no retrieval date.");
  if (!outcome.code.trim() || !outcome.statement.trim()) problems.push("The outcome has no code or wording.");
  if (!USABLE_STATUSES.includes(outcome.status)) problems.push(`${outcome.code} has not been checked against its source.`);
  if (!/^sha256:[0-9a-f]{64}$/.test(outcome.fingerprint)) problems.push(`${outcome.code} has no fingerprint of its wording.`);
  else if (hasher && `sha256:${hasher(outcome.statement)}` !== outcome.fingerprint) problems.push(`${outcome.code}'s wording no longer matches its fingerprint.`);
  if (outcome.indicators.some((i) => !USABLE_STATUSES.includes(i.status))) problems.push(`${outcome.code} lists an indicator that is not verified.`);
  if (outcome.indicatorsStatus === "pending" && outcome.indicators.length > 0) problems.push(`${outcome.code} lists indicators while they are marked pending.`);
  if (outcome.url) {
    try {
      const h = new URL(outcome.url).hostname;
      if (!(OFFICIAL_SOURCE_HOSTS as readonly string[]).includes(h)) problems.push(`${outcome.code}'s page ${h} is not an official curriculum site.`);
    } catch {
      problems.push(`${outcome.code} has an invalid source URL.`);
    }
  }
  return problems;
}

/** True when no person has compared the outcome's wording with the official page. */
export const isAutomatic = (o: CatalogOutcome) => AUTOMATIC_STATUSES.includes(o.status);

export type UsableOutcome = { ok: true; found: FoundOutcome } | { ok: false; reason: string };

/** An outcome Funza may build on: it must exist, be checked against its source, and be sound. */
export function usableOutcome(id: unknown, hasher?: Hasher, catalog: Jurisdiction[] = current): UsableOutcome {
  if (typeof id !== "string" || !id) return { ok: false, reason: "No curriculum outcome was given." };
  const found = findOutcome(id, catalog);
  if (!found) return { ok: false, reason: `"${id.slice(0, 40)}" is not an outcome in Funza's curriculum catalog.` };
  const problems = outcomeProblems(found, hasher);
  if (problems.length > 0) return { ok: false, reason: problems[0] };
  return { ok: true, found };
}

/** What a teacher must know before relying on this outcome, in plain words. */
export function outcomeLimitations(found: FoundOutcome): string[] {
  const { course, outcome } = found;
  const out: string[] = [];
  if (outcome.status === "cross-checked") {
    out.push(`The wording was copied automatically from the official page on ${course.source.retrievedOn} and matches the Ministry's CSV file. No person has compared it with the page yet.`);
  } else if (outcome.status === "imported") {
    out.push(`The wording was copied automatically from the official page on ${course.source.retrievedOn}. No second source confirmed it and no person has compared it with the page yet.`);
  }
  if (outcome.indicatorsStatus === "pending") {
    out.push("Indicators have not been copied yet, so resources are aligned to the outcome statement only.");
  } else if (outcome.indicatorsStatus === "imported") {
    out.push("The indicators were copied automatically from the official page. No second source lists them and no person has checked them.");
  }
  if (outcome.secondCheck === "pending" && !isAutomatic(outcome)) {
    out.push(`The wording was copied from the official page on ${course.source.retrievedOn}; a second check against the source is still pending.`);
  }
  for (const n of outcome.notes ?? []) out.push(`Noted on import: ${n}`);
  if (!course.source.versionLabel) {
    out.push("The source page shows no version or year, so this wording is pinned by its retrieval date and fingerprint.");
  }
  if (!course.source.reuseTerms) {
    out.push("The source states no reuse terms; confirm use of the wording with the Ministry before commercial use.");
  }
  return out;
}

export function allowedIndicatorIds(outcome: CatalogOutcome): Set<string> {
  return new Set(outcome.indicators.filter((i) => USABLE_STATUSES.includes(i.status)).map((i) => i.id));
}
