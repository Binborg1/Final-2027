/**
 * The curriculum catalog: official outcomes Funza may align lessons to.
 *
 * Everything here was copied from the official source named on the course and
 * must never be written by an AI or edited from memory. An outcome enters the
 * catalog only with its source, retrieval date and a SHA-256 fingerprint of the
 * exact wording, so any change to the text is detectable. Indicators are listed
 * only once independently verified; until then the outcome says so.
 *
 * See docs/architecture-evolution/03_curriculum_verification.md.
 */

export type VerificationStatus =
  /** Retrieved from the official source and compared by two people. */
  | "verified"
  /** Copied from the official source on the retrieval date; the second-person check is still pending. */
  | "source-checked"
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
  /** Only independently verified indicators. Empty while `indicatorsStatus` is "pending". */
  indicators: CatalogIndicator[];
  indicatorsStatus: "verified" | "pending";
  /** Which lesson template exists for this outcome; null means teachers can read it but not yet generate a lesson. */
  lessonTemplate: "sci10-fm2" | null;
};

export type CatalogUnit = { id: string; name: string; outcomes: CatalogOutcome[] };

export type CatalogSource = {
  url: string;
  publisher: string;
  retrievedOn: string;
  /** The version or year printed on the source, or null when the page shows none. */
  versionLabel: string | null;
  /** Reuse terms as stated on the source, or null when none are stated. */
  reuseTerms: string | null;
};

export type CatalogCourse = { id: string; name: string; grade: number; source: CatalogSource; units: CatalogUnit[] };

export type Jurisdiction = { id: string; name: string; courses: CatalogCourse[] };

/** Only these hosts count as an official source. */
export const OFFICIAL_SOURCE_HOSTS = ["curriculum.gov.sk.ca"] as const;

/** Statuses a teacher may build a lesson on. */
export const USABLE_STATUSES: readonly VerificationStatus[] = ["verified", "source-checked"];

const RETRIEVED = "2026-11-17";
const METHOD = "Copied from the official Science 10 outcomes page (curriculum.gov.sk.ca, id=63).";

function sourceChecked(id: string, code: string, statement: string, fingerprint: string, lessonTemplate: CatalogOutcome["lessonTemplate"]): CatalogOutcome {
  return {
    id,
    code,
    statement,
    fingerprint,
    status: "source-checked",
    checkedOn: RETRIEVED,
    method: METHOD,
    secondCheck: "pending",
    indicators: [],
    indicatorsStatus: "pending",
    lessonTemplate,
  };
}

export const CATALOG: Jurisdiction[] = [
  {
    id: "sk",
    name: "Saskatchewan",
    courses: [
      {
        id: "sk-science-10",
        name: "Science 10",
        grade: 10,
        source: {
          url: "https://curriculum.gov.sk.ca/CurriculumOutcomeContent?id=63",
          publisher: "Saskatchewan Ministry of Education",
          retrievedOn: RETRIEVED,
          versionLabel: null,
          reuseTerms: null,
        },
        units: [
          {
            id: "sk-sci10-fm",
            name: "Force and Motion in Our World",
            outcomes: [
              sourceChecked(
                "sk-sci10-fm1",
                "SCI10-FM1",
                "Explore the development of motion-related technologies and their impacts on self and society.",
                "sha256:3ba9b04ca12dae8339e45d15ee0f16c7ba2adcc90eec857161c526e21f91baaf",
                null,
              ),
              sourceChecked(
                "sk-sci10-fm2",
                "SCI10-FM2",
                "Investigate and represent the motion of objects that travel at a constant speed in a straight line.",
                "sha256:9b2fd61fb03d229e5f7100e14744f1f7ac1d6470ab7e061cd70b212f968a0631",
                "sci10-fm2",
              ),
              sourceChecked(
                "sk-sci10-fm3",
                "SCI10-FM3",
                "Investigate and represent the motion of objects that undergo acceleration.",
                "sha256:7ff23004853ce65df8b2cfc4edffc5ac94b62f09995ba082374d5d7fe4a6f159",
                null,
              ),
              sourceChecked(
                "sk-sci10-fm4",
                "SCI10-FM4",
                "Explore the relationship between force and motion for objects moving in one and two dimensions.",
                "sha256:5a3cd6a2aa2c5f6f757c8cf6d5b802733a3fd727f9e5d27b71f5a9f5e06fdc70",
                null,
              ),
            ],
          },
        ],
      },
    ],
  },
];

export type FoundOutcome = { jurisdiction: Jurisdiction; course: CatalogCourse; unit: CatalogUnit; outcome: CatalogOutcome };

export function findOutcome(id: string, catalog: Jurisdiction[] = CATALOG): FoundOutcome | null {
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
  return problems;
}

export type UsableOutcome = { ok: true; found: FoundOutcome } | { ok: false; reason: string };

/** The only way lesson generation gets an outcome: it must exist, be checked against its source, and be sound. */
export function usableOutcome(id: unknown, hasher?: Hasher, catalog: Jurisdiction[] = CATALOG): UsableOutcome {
  if (typeof id !== "string" || !id) return { ok: false, reason: "No curriculum outcome was given." };
  const found = findOutcome(id, catalog);
  if (!found) return { ok: false, reason: `"${id.slice(0, 40)}" is not an outcome in Funza's curriculum catalog.` };
  const problems = outcomeProblems(found, hasher);
  if (problems.length > 0) return { ok: false, reason: problems[0] };
  if (!found.outcome.lessonTemplate) return { ok: false, reason: `Lessons for ${found.outcome.code} are not available yet.` };
  return { ok: true, found };
}

/** What a teacher must know before relying on this outcome, in plain words. */
export function outcomeLimitations(found: FoundOutcome): string[] {
  const { course, outcome } = found;
  const out: string[] = [];
  if (outcome.indicatorsStatus === "pending") {
    out.push("Indicators have not been verified yet, so lessons are aligned to the outcome statement only.");
  }
  if (outcome.secondCheck === "pending") {
    out.push(`The wording was copied from the official page on ${course.source.retrievedOn}; a second check against the source is still pending.`);
  }
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
