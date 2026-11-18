import { approvalStillValid, lessonContext, lessonPublishProblems } from "@/lib/curriculum/checks";
import {
  blockConcepts,
  curriculumFromCatalog,
  sanitizeBlock,
  type CurriculumBlock,
  type LessonCurriculum,
} from "@/lib/curriculum/lesson";
import type { Concept, IllustrationId, Question } from "@/lib/types";
import { validateVisualization } from "@/lib/visualizations/registry";

/**
 * Classes: a professor or teacher turns material into reviewed study content
 * and publishes it; students join with the class code and study only what was
 * published. Pure data and rules, shared by the server routes and the pages.
 *
 * Two kinds of lecture share these rules:
 * - university lectures: concepts drafted from a PDF (the original Model 2 flow);
 * - curriculum lessons: typed blocks aligned to a catalog outcome
 *   (src/lib/curriculum), each carried on its concept as `block`.
 */

export type ReviewStatus = "pending" | "approved" | "removed";

/** A drafted concept and where it stands in review. Curriculum lessons carry their block, the source of truth. */
export type DraftConcept = Concept & { review: ReviewStatus; block?: CurriculumBlock };

/** How the drafts were made: by the AI provider, by the on-device rules, or from Funza's starter template. */
export type DraftSource = "ai" | "rules" | "template";

/** The outcome shown to students with a published curriculum lesson. */
export type PublishedOutcome = { code: string; statement: string; sourceUrl: string };

export type PublishedSnapshot = { at: string; title: string; concepts: Concept[]; outcome?: PublishedOutcome | null };

export type Lecture = {
  id: string;
  title: string;
  fileName: string;
  draftedBy: DraftSource;
  objectives: string[];
  concepts: DraftConcept[];
  createdAt: string;
  updatedAt: string;
  /** What students see: the approved concepts as they were at the last publish. Null until published. */
  published: PublishedSnapshot | null;
  /** Set for curriculum lessons: the catalog outcome the lesson is aligned to. */
  curriculum?: LessonCurriculum | null;
};

export type ClassInfo = { code: string; name: string; term: string; professor: string; createdAt: string };

export type ClassRecord = ClassInfo & { updatedAt: string; lectures: Lecture[] };

export type PublicLecture = { id: string; title: string; publishedAt: string; concepts: Concept[]; outcome?: PublishedOutcome | null };

/** The student's view of a class: published lectures only, no drafts. */
export type PublicClass = ClassInfo & { lectures: PublicLecture[] };

/* ---------- class codes ---------- */

/** No 0/O or 1/I, so a code read off a slide is typed correctly. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

export function makeCode(randomInt: (max: number) => number): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** "k7q 2px" -> "K7Q2PX". */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidCode(code: string): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code);
}

/** A student's progress on a class is kept in the usual progress store under this id. */
export function classCourseId(code: string) {
  return `class-${code}`;
}

/* ---------- review and publishing ---------- */

export function reviewCounts(lecture: Lecture) {
  const counts = { approved: 0, pending: 0, removed: 0 };
  for (const c of lecture.concepts) counts[c.review]++;
  return { ...counts, kept: counts.approved + counts.pending };
}

/** A curriculum lesson: linked to an outcome, or made of blocks (even if its link was lost). */
export function isCurriculumLesson(lecture: Lecture): boolean {
  return !!lecture.curriculum || lecture.concepts.some((c) => !!c.block);
}

/** For a curriculum lesson, what stops publishing; empty for a university lecture. */
export function curriculumProblems(lecture: Lecture): string[] {
  if (!isCurriculumLesson(lecture)) return [];
  if (lecture.concepts.some((c) => !c.block)) return ["Every part of a curriculum lesson must be a lesson block."];
  return lessonPublishProblems(
    lecture.curriculum ?? null,
    lecture.concepts.map((c) => ({ block: c.block as CurriculumBlock, review: c.review })),
  );
}

/** Every concept left in has been approved, at least one is, and a curriculum lesson passes its checks. */
export function canPublish(lecture: Lecture): boolean {
  const { approved, pending } = reviewCounts(lecture);
  return pending === 0 && approved > 0 && curriculumProblems(lecture).length === 0;
}

/** The approved concepts as students will get them: normalized, and only those complete enough to show. */
export function approvedConcepts(lecture: Lecture): Concept[] {
  return lecture.concepts
    .filter((c) => c.review === "approved")
    .flatMap((c) => (c.block ? blockConcepts(c.block) : [stripReview(c)]))
    .map((c) => sanitizeConcept(c))
    .filter((c): c is Concept => c !== null);
}

function stripReview(concept: DraftConcept): Concept {
  const copy: Partial<DraftConcept> = { ...concept };
  delete copy.review;
  delete copy.block;
  return copy as Concept;
}

/** A block as a concept in review: the block is kept, and the concept fields are derived from it. */
export function draftFromBlock(block: CurriculumBlock, review: ReviewStatus): DraftConcept {
  return { ...blockConcepts(block)[0], id: block.id, review, block };
}

function publishedOutcome(lecture: Lecture): PublishedOutcome | null {
  const c = lecture.curriculum;
  return c ? { code: c.code, statement: c.statement, sourceUrl: c.sourceUrl } : null;
}

export function publishLecture(lecture: Lecture, now: string): Lecture {
  return {
    ...lecture,
    updatedAt: now,
    published: { at: now, title: lecture.title, concepts: approvedConcepts(lecture), outcome: publishedOutcome(lecture) },
  };
}

export function unpublishLecture(lecture: Lecture, now: string): Lecture {
  return { ...lecture, updatedAt: now, published: null };
}

export type LectureState = "draft" | "published" | "changed";

/** "changed": published, but the approved material or title has moved on since. */
export function lectureState(lecture: Lecture): LectureState {
  if (!lecture.published) return "draft";
  // Compared in the normalized form, so key order or trimming never reads as a change.
  const canon = (list: Concept[]) => JSON.stringify(list.map(sanitizeConcept));
  const same = lecture.published.title === lecture.title && canon(lecture.published.concepts) === canon(approvedConcepts(lecture));
  return same ? "published" : "changed";
}

export function publicView(record: ClassRecord): PublicClass {
  return {
    code: record.code,
    name: record.name,
    term: record.term,
    professor: record.professor,
    createdAt: record.createdAt,
    lectures: record.lectures
      .filter((l): l is Lecture & { published: PublishedSnapshot } => l.published !== null && l.published.concepts.length > 0)
      .map((l) => ({
        id: l.id,
        title: l.published.title,
        publishedAt: l.published.at,
        concepts: l.published.concepts,
        ...(l.published.outcome ? { outcome: l.published.outcome } : {}),
      })),
  };
}

/**
 * Server-side guard on publishing: a lecture whose snapshot is new in `next`
 * must be publishable, and its snapshot must be exactly its approved content.
 * Returns one message per refused lecture; empty means the save may go ahead.
 */
export function publishingProblems(prev: ClassRecord | null, next: ClassRecord): string[] {
  const problems: string[] = [];
  for (const lecture of next.lectures) {
    if (!lecture.published) continue;
    const before = prev?.lectures.find((l) => l.id === lecture.id)?.published ?? null;
    if (before && before.at === lecture.published.at) continue; // an existing snapshot, unchanged
    const name = `"${lecture.title}"`;
    if (!canPublish(lecture)) {
      const why = curriculumProblems(lecture)[0] ?? "every kept part must be approved first";
      problems.push(`${name} cannot be published: ${why}`);
      continue;
    }
    const canon = (list: Concept[]) => JSON.stringify(list.map(sanitizeConcept));
    if (canon(lecture.published.concepts) !== canon(approvedConcepts(lecture))) {
      problems.push(`${name} cannot be published: the snapshot must be exactly its approved content.`);
    }
  }
  return problems;
}

/* ---------- validation of what a professor's browser sends ---------- */

export class ClassValidationError extends Error {}

export const LIMITS = {
  name: 80,
  term: 40,
  professor: 80,
  lectures: 50,
  conceptsPerLecture: 15,
  title: 140,
  fileName: 200,
  objectives: 8,
  explanation: 3000,
  alternate: 2000,
  whyCorrect: 1500,
  hints: 4,
  hint: 800,
  prompt: 1200,
  options: 6,
  option: 300,
  keywordGroups: 8,
  keywordsPerGroup: 6,
} as const;

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/i;
const ILLUSTRATIONS: IllustrationId[] = ["packets", "routes", "handshake", "layers"];

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => !!v && typeof v === "object" && !Array.isArray(v);
const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const iso = (v: unknown, fallback: string): string =>
  typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : fallback;

/** The class details a professor can set. Throws when the name is missing. */
export function sanitizeInfo(raw: unknown): { name: string; term: string; professor: string } {
  const r = isObject(raw) ? raw : {};
  const info = { name: clean(r.name, LIMITS.name), term: clean(r.term, LIMITS.term), professor: clean(r.professor, LIMITS.professor) };
  if (!info.name) throw new ClassValidationError("Give the class a name.");
  if (!info.professor) throw new ClassValidationError("Add the name students know you by.");
  return info;
}

function sanitizeQuestion(raw: unknown): Question | null {
  if (!isObject(raw)) return null;
  const prompt = clean(raw.prompt, LIMITS.prompt);
  if (!prompt) return null;
  if (raw.kind === "mcq") {
    const options = (Array.isArray(raw.options) ? raw.options : [])
      .filter(isObject)
      .map((o) => ({ id: clean(o.id, 4), text: clean(o.text, LIMITS.option) }))
      .filter((o) => o.id && o.text)
      .slice(0, LIMITS.options);
    const ids = new Set(options.map((o) => o.id));
    const correctOptionId = clean(raw.correctOptionId, 4);
    if (options.length < 2 || ids.size !== options.length || !ids.has(correctOptionId)) return null;
    return { kind: "mcq", prompt, options, correctOptionId };
  }
  if (raw.kind === "short") {
    const keywordGroups = cleanGroups(raw.keywordGroups);
    const sampleAnswer = clean(raw.sampleAnswer, LIMITS.whyCorrect);
    if (!sampleAnswer) return null;
    const min = Number.isInteger(raw.minGroups) ? (raw.minGroups as number) : 1;
    const placeholder = clean(raw.placeholder, 200);
    return {
      kind: "short",
      prompt,
      keywordGroups,
      minGroups: Math.max(0, Math.min(min, keywordGroups.length)),
      sampleAnswer,
      ...(placeholder ? { placeholder } : {}),
    };
  }
  return null;
}

/** A concept as students will see it; null when it lacks what the lesson screen needs. */
export function sanitizeConcept(raw: unknown): Concept | null {
  if (!isObject(raw)) return null;
  const id = clean(raw.id, 80);
  const title = clean(raw.title, LIMITS.title);
  const explanation = clean(raw.explanation, LIMITS.explanation);
  const question = sanitizeQuestion(raw.question);
  if (!ID_PATTERN.test(id) || !title || !explanation || !question) return null;
  const hints = (Array.isArray(raw.hints) ? raw.hints : [])
    .map((h) => clean(h, LIMITS.hint))
    .filter(Boolean)
    .slice(0, LIMITS.hints);
  const objective = clean(raw.objective, 300);
  const illustration = ILLUSTRATIONS.find((i) => i === raw.illustration);
  // Only a registered demo with valid, in-range parameters survives (the same gate AI-chosen demos pass).
  const visualization = raw.visualization === undefined ? null : validateVisualization(raw.visualization);
  return {
    id,
    title,
    explanation,
    alternateExplanation: clean(raw.alternateExplanation, LIMITS.alternate),
    question,
    whyCorrect: clean(raw.whyCorrect, LIMITS.whyCorrect),
    hints: hints.length > 0 ? hints : ["Read the explanation again and look for the idea the question is about."],
    ...(objective ? { objective } : {}),
    ...(illustration ? { illustration } : {}),
    ...(visualization ? { visualization } : {}),
  };
}

const cleanGroups = (v: unknown): string[][] =>
  (Array.isArray(v) ? v : [])
    .map((g) =>
      (Array.isArray(g) ? g : [])
        .map((w) => clean(w, 60).toLowerCase())
        .filter(Boolean)
        .slice(0, LIMITS.keywordsPerGroup),
    )
    .filter((g) => g.length > 0)
    .slice(0, LIMITS.keywordGroups);

/** A question mid-edit: blanks allowed, structure kept. */
function draftQuestion(raw: unknown): Question {
  const r = isObject(raw) ? raw : {};
  const prompt = clean(r.prompt, LIMITS.prompt);
  if (r.kind === "short") {
    const keywordGroups = cleanGroups(r.keywordGroups);
    const min = Number.isInteger(r.minGroups) ? (r.minGroups as number) : 1;
    return { kind: "short", prompt, keywordGroups, minGroups: Math.max(0, Math.min(min, keywordGroups.length)), sampleAnswer: clean(r.sampleAnswer, LIMITS.whyCorrect) };
  }
  const seen = new Set<string>();
  const options = (Array.isArray(r.options) ? r.options : [])
    .filter(isObject)
    .map((o) => ({ id: clean(o.id, 4), text: clean(o.text, LIMITS.option) }))
    .filter((o) => /^[a-z]$/.test(o.id) && (seen.has(o.id) ? false : (seen.add(o.id), true)))
    .slice(0, LIMITS.options);
  const wanted = clean(r.correctOptionId, 4);
  return { kind: "mcq", prompt, options, correctOptionId: options.some((o) => o.id === wanted) ? wanted : (options[0]?.id ?? "a") };
}

/**
 * A concept in review. Complete ones are normalized like published ones; an
 * incomplete one is kept as it is, so a professor's half-finished edit is
 * never lost, but it cannot stay approved.
 */
function sanitizeDraftConcept(raw: unknown): DraftConcept | null {
  if (!isObject(raw)) return null;
  const id = clean(raw.id, 80);
  if (!ID_PATTERN.test(id)) return null;
  const wanted: ReviewStatus = raw.review === "approved" || raw.review === "removed" ? raw.review : "pending";
  if (raw.block !== undefined) {
    // A curriculum block: the block is the source of truth; the concept fields are re-derived from it.
    const block = sanitizeBlock(raw.block);
    return block ? draftFromBlock(block, wanted) : null;
  }
  const complete = sanitizeConcept(raw);
  if (complete && conceptProblems(complete).length === 0) return { ...complete, review: wanted };
  const objective = clean(raw.objective, 300);
  return {
    id,
    title: clean(raw.title, LIMITS.title),
    explanation: clean(raw.explanation, LIMITS.explanation),
    alternateExplanation: clean(raw.alternateExplanation, LIMITS.alternate),
    question: draftQuestion(raw.question),
    whyCorrect: clean(raw.whyCorrect, LIMITS.whyCorrect),
    hints: (Array.isArray(raw.hints) ? raw.hints : []).map((h) => clean(h, LIMITS.hint)).slice(0, LIMITS.hints),
    ...(objective ? { objective } : {}),
    review: wanted === "removed" ? "removed" : "pending",
  };
}

/** What stops a concept from being approved; empty when it is ready for students. */
export function conceptProblems(concept: Concept): string[] {
  const problems: string[] = [];
  const q = concept.question;
  if (!concept.title.trim()) problems.push("Add a title.");
  if (!concept.explanation.trim()) problems.push("Add an explanation.");
  if (!q.prompt.trim()) problems.push("Write the question.");
  if (q.kind === "mcq") {
    if (q.options.filter((o) => o.text.trim()).length < 2) problems.push("Give at least two answer options.");
    else if (!q.options.find((o) => o.id === q.correctOptionId)?.text.trim()) problems.push("Mark which option is correct.");
  } else if (!q.sampleAnswer.trim()) {
    problems.push("Write a model answer.");
  }
  if (!concept.hints.some((h) => h.trim())) problems.push("Add at least one hint.");
  return problems;
}

function sanitizeLecture(raw: unknown, now: string): Lecture | null {
  if (!isObject(raw)) return null;
  const id = clean(raw.id, 80);
  if (!ID_PATTERN.test(id)) return null;
  const concepts = (Array.isArray(raw.concepts) ? raw.concepts : [])
    .map(sanitizeDraftConcept)
    .filter((c): c is DraftConcept => c !== null)
    .slice(0, LIMITS.conceptsPerLecture);
  const seen = new Set<string>();
  const unique = concepts.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  // The outcome comes from the catalog, never from what the browser says it is.
  const curriculum = isObject(raw.curriculum) ? curriculumFromCatalog(raw.curriculum.outcomeId) : null;
  // An approval stands only for the exact content approved, and only while it passes its checks.
  const ctx = lessonContext(curriculum);
  const reviewed = unique.map((c) =>
    c.block && c.review === "approved" && !approvalStillValid(c.block, ctx, curriculum)
      ? draftFromBlock({ ...c.block, approvedFingerprint: null }, "pending")
      : c,
  );
  let published: PublishedSnapshot | null = null;
  if (isObject(raw.published)) {
    const pc = (Array.isArray(raw.published.concepts) ? raw.published.concepts : [])
      .map(sanitizeConcept)
      .filter((c): c is Concept => c !== null)
      .slice(0, LIMITS.conceptsPerLecture);
    if (pc.length > 0) {
      published = {
        at: iso(raw.published.at, now),
        title: clean(raw.published.title, LIMITS.title) || "Lecture",
        concepts: pc,
        ...(curriculum ? { outcome: { code: curriculum.code, statement: curriculum.statement, sourceUrl: curriculum.sourceUrl } } : {}),
      };
    }
  }
  return {
    id,
    title: clean(raw.title, LIMITS.title) || "Untitled lecture",
    fileName: clean(raw.fileName, LIMITS.fileName),
    draftedBy: raw.draftedBy === "ai" ? "ai" : raw.draftedBy === "template" ? "template" : "rules",
    objectives: (Array.isArray(raw.objectives) ? raw.objectives : [])
      .map((o) => clean(o, 300))
      .filter(Boolean)
      .slice(0, LIMITS.objectives),
    concepts: reviewed,
    createdAt: iso(raw.createdAt, now),
    updatedAt: iso(raw.updatedAt, now),
    published,
    ...(curriculum ? { curriculum } : {}),
  };
}

/**
 * Rebuilds a class from what the professor's browser sent, keeping the stored
 * code and creation date. Anything malformed is dropped or capped, so the
 * student view never receives something the lesson screen cannot show.
 */
export function sanitizeRecord(raw: unknown, stored: ClassInfo, now: string): ClassRecord {
  if (!isObject(raw)) throw new ClassValidationError("Expected a class.");
  const info = sanitizeInfo(raw);
  const lectures = (Array.isArray(raw.lectures) ? raw.lectures : [])
    .map((l) => sanitizeLecture(l, now))
    .filter((l): l is Lecture => l !== null)
    .slice(0, LIMITS.lectures);
  const seen = new Set<string>();
  return {
    code: stored.code,
    createdAt: stored.createdAt,
    ...info,
    updatedAt: now,
    lectures: lectures.filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true))),
  };
}
