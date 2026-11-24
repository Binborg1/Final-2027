import { OUTCOME_ID } from "@/lib/curriculum/catalog";
import { defaultBrief, KINDS, NOTES_STYLES, QTYPE_ORDER } from "@/lib/resources/kinds";
import type { Brief, Calc, Delivery, Difficulty, Draft, Item, Origin, QType, Resource, ResourceKind, Section, SectionKind, Verb } from "@/lib/resources/types";
import { compileExpr, isIdentifier } from "@/lib/math/expr";
import { sanitizeLayout, sanitizeParts, sanitizeStyle } from "@/lib/templates/model";

/**
 * Rebuilds resources field by field from untrusted JSON: AI replies, browser
 * storage, and requests to the server. Types, lengths and allowed values are
 * enforced; formulas must compile in the expression engine (never `eval`).
 * Whether the content is right is the checks' job, not this file's.
 */

type Raw = Record<string, unknown>;
export const isObject = (v: unknown): v is Raw => !!v && typeof v === "object" && !Array.isArray(v);
export const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "");
const num = (v: unknown, min: number, max: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback);
const int = (v: unknown, min: number, max: number, fallback: number) => Math.round(num(v, min, max, fallback));
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const oneOf = <T extends string>(v: unknown, values: readonly T[], fallback: T): T => (values.includes(v as T) ? (v as T) : fallback);
const ID = /^[a-z0-9][a-z0-9-]{0,47}$/i;
const id = (v: unknown, fallback: string) => (typeof v === "string" && ID.test(v) ? v : fallback);

const DIFFICULTIES: readonly Difficulty[] = ["foundational", "grade", "extending"];
const VERBS: readonly Verb[] = ["investigate", "represent", "explore"];
const ORIGINS: readonly Origin[] = ["ai", "bank", "teacher"];
const KIND_IDS = KINDS.map((k) => k.kind) as readonly ResourceKind[];
const SECTION_KINDS: readonly SectionKind[] = ["questions", "text"];

/**
 * Only well-formed outcome ids, and only those allowed, survive. Whether an id is in the
 * catalog is checked where it is used (the browser may not have loaded its course yet;
 * the server re-checks every id against its own copy before drafting).
 */
export function outcomeList(v: unknown, allowed?: ReadonlySet<string>): string[] {
  const list = (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string" && OUTCOME_ID.test(x));
  return [...new Set(list)].filter((x) => !allowed || allowed.has(x)).slice(0, 6);
}

export function sanitizeCalc(raw: unknown): Calc | null {
  if (!isObject(raw) || !isObject(raw.vars)) return null;
  const expr = str(raw.expr, 120);
  const entries = Object.entries(raw.vars).slice(0, 8);
  const vars: Record<string, number> = {};
  for (const [k, v] of entries) {
    if (!isIdentifier(k) || typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1e9) return null;
    vars[k] = v;
  }
  if (!expr) return null;
  try {
    const value = compileExpr(expr, Object.keys(vars))(vars);
    if (!Number.isFinite(value)) return null;
  } catch {
    return null;
  }
  return { expr, vars, unit: str(raw.unit, 16), show: str(raw.show, 120) || expr };
}

export type ItemContext = { allowedOutcomes?: ReadonlySet<string>; fallbackId: string; origin?: Origin };

export function sanitizeItem(raw: unknown, ctx: ItemContext): Item | null {
  if (!isObject(raw)) return null;
  const type = oneOf<QType>(raw.type, QTYPE_ORDER, "mcq");
  if (raw.type !== type) return null;
  const seen = new Set<string>();
  const options = (Array.isArray(raw.options) ? raw.options : [])
    .filter(isObject)
    .map((o, i) => ({ id: /^[a-f]$/.test(String(o.id)) ? String(o.id) : String.fromCharCode(97 + i), text: str(o.text, 400) }))
    .filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)))
    .slice(0, 6);
  const correctId = typeof raw.correctId === "string" && options.some((o) => o.id === raw.correctId) ? raw.correctId : type === "mcq" ? (options[0]?.id ?? null) : null;
  const marks = int(raw.marks, 1, 50, 1);
  const rubric = (Array.isArray(raw.rubric) ? raw.rubric : []).filter(isObject).map((r) => ({ text: str(r.text, 400), marks: int(r.marks, 0, 50, 1) })).slice(0, 10);
  return {
    id: id(raw.id, ctx.fallbackId),
    type,
    prompt: str(raw.prompt, 1500),
    options: type === "mcq" ? options : [],
    correctId: type === "mcq" ? correctId : null,
    tf: type === "tf" && typeof raw.tf === "boolean" ? raw.tf : null,
    answer: type === "fill" || type === "calc" ? str(raw.answer, 200) : "",
    pairs:
      type === "match"
        ? (Array.isArray(raw.pairs) ? raw.pairs : [])
            .filter(isObject)
            .map((p) => ({ left: str(p.left, 200), right: str(p.right, 200) }))
            .slice(0, 8)
        : [],
    calc: type === "calc" || type === "mcq" ? sanitizeCalc(raw.calc) : null,
    solution: str(raw.solution, 1500),
    rubric: type === "short" || type === "long" ? rubric : [],
    marks,
    difficulty: oneOf(raw.difficulty, DIFFICULTIES, "grade"),
    outcomeIds: outcomeList(raw.outcomeIds, ctx.allowedOutcomes),
    verbs: (Array.isArray(raw.verbs) ? raw.verbs : []).filter((v): v is Verb => VERBS.includes(v as Verb)).slice(0, 3),
    origin: ctx.origin ?? oneOf(raw.origin, ORIGINS, "teacher"),
    reviewedFp: typeof raw.reviewedFp === "string" ? raw.reviewedFp.slice(0, 16) : null,
  };
}

export function sanitizeSection(raw: unknown, ctx: { allowedOutcomes?: ReadonlySet<string>; fallbackId: string; origin?: Origin }): Section | null {
  if (!isObject(raw)) return null;
  const kind = oneOf(raw.kind, SECTION_KINDS, "text");
  if (raw.kind !== kind) return null;
  const sid = id(raw.id, ctx.fallbackId);
  const items =
    kind === "questions"
      ? (Array.isArray(raw.items) ? raw.items : [])
          .map((it, i) => sanitizeItem(it, { allowedOutcomes: ctx.allowedOutcomes, fallbackId: `${sid}-q${i + 1}`, origin: ctx.origin }))
          .filter((x): x is Item => x !== null)
          .slice(0, 40)
      : [];
  const claim = isObject(raw.claim) ? sanitizeCalc(raw.claim) : null;
  const stated = isObject(raw.claim) ? str(raw.claim.stated, 60) : "";
  return {
    id: sid,
    kind,
    title: str(raw.title, 160),
    body: str(raw.body, 6000),
    items,
    claim: claim && stated ? { ...claim, stated } : null,
    outcomeIds: outcomeList(raw.outcomeIds, ctx.allowedOutcomes),
    verbs: (Array.isArray(raw.verbs) ? raw.verbs : []).filter((v): v is Verb => VERBS.includes(v as Verb)).slice(0, 3),
    origin: ctx.origin ?? oneOf(raw.origin, ORIGINS, "teacher"),
    reviewedFp: typeof raw.reviewedFp === "string" ? raw.reviewedFp.slice(0, 16) : null,
  };
}

export function sanitizeSections(raw: unknown, ctx: { allowedOutcomes?: ReadonlySet<string>; origin?: Origin } = {}): Section[] {
  const out: Section[] = [];
  const used = new Set<string>();
  (Array.isArray(raw) ? raw : []).slice(0, 40).forEach((s, i) => {
    const sec = sanitizeSection(s, { ...ctx, fallbackId: `s-${i + 1}` });
    if (!sec) return;
    if (used.has(sec.id)) sec.id = `${sec.id}-${i}`;
    used.add(sec.id);
    sec.items = sec.items.map((it, j) => {
      if (used.has(it.id)) it = { ...it, id: `${sec.id}-q${j + 1}` };
      used.add(it.id);
      return it;
    });
    out.push(sec);
  });
  return out;
}

export function sanitizeBrief(raw: unknown): Brief | null {
  if (!isObject(raw)) return null;
  const kind = oneOf(raw.kind, KIND_IDS, "quiz");
  if (raw.kind !== kind) return null;
  const base = defaultBrief(kind, outcomeList(raw.outcomeIds));
  const mixIn = Array.isArray(raw.mix) ? raw.mix.filter(isObject) : [];
  const material = isObject(raw.material) ? { name: str(raw.material.name, 120), use: oneOf(raw.material.use, ["source", "inspiration"] as const, "source"), text: str(raw.material.text, 12000) } : null;
  // Without a template, a layout or parts can't come in: Funza's own controls work exactly as before.
  const templateId = typeof raw.templateId === "string" && GUID.test(raw.templateId) ? raw.templateId.toLowerCase() : null;
  const questionKind = kind === "quiz" || kind === "test" || kind === "exam";
  const layout = templateId && questionKind ? sanitizeLayout(raw.layout) : [];
  const parts = templateId && !questionKind ? sanitizeParts(raw.parts) : [];
  return {
    ...base,
    title: str(raw.title, 160) || base.title,
    mix: base.mix.map((r) => {
      const m = mixIn.find((x) => x.type === r.type);
      return m ? { type: r.type, count: int(m.count, 0, 25, r.count), marks: int(m.marks, 1, 20, r.marks) } : r;
    }),
    duration: int(raw.duration, 5, 240, base.duration),
    difficulty: oneOf(raw.difficulty, ["balanced", "review", "challenge"] as const, base.difficulty),
    ordering: oneOf(raw.ordering, ["by-type", "by-difficulty", "by-outcome"] as const, base.ordering),
    answerKey: bool(raw.answerKey, true),
    workedSolutions: bool(raw.workedSolutions, true),
    rubric: bool(raw.rubric, true),
    notesStyle: oneOf(raw.notesStyle, NOTES_STYLES.map((s) => s.id), base.notesStyle),
    keyTerms: bool(raw.keyTerms, true),
    checkQuestions: bool(raw.checkQuestions, true),
    slides: int(raw.slides, 2, 30, 6),
    speakerNotes: bool(raw.speakerNotes, true),
    material: material && material.name ? material : null,
    reuseId: typeof raw.reuseId === "string" ? raw.reuseId.slice(0, 64) : null,
    instructions: str(raw.instructions, 600),
    courseId: typeof raw.courseId === "string" && GUID.test(raw.courseId) ? raw.courseId.toLowerCase() : null,
    chapterIds: [...new Set((Array.isArray(raw.chapterIds) ? raw.chapterIds : []).filter((x): x is string => typeof x === "string" && GUID.test(x)).map((x) => x.toLowerCase()))].slice(0, 20),
    templateId,
    layout: layout.length > 0 ? layout : null,
    parts: parts.length > 0 ? parts : null,
    style: templateId && isObject(raw.style) ? sanitizeStyle(raw.style) : null,
  };
}

/** A database id (Postgres uuid). */
export const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeDelivery(raw: unknown): Delivery | null {
  if (!isObject(raw)) return null;
  return {
    id: str(raw.id, 64) || "d",
    at: str(raw.at, 60),
    version: int(raw.version, 1, 999, 1),
    what: str(raw.what, 120),
    where: str(raw.where, 200),
    state: oneOf(raw.state, ["done", "failed"] as const, "done"),
    detail: str(raw.detail, 400) || undefined,
    link: typeof raw.link === "string" && /^https:\/\//.test(raw.link) ? raw.link.slice(0, 500) : undefined,
  };
}

export function sanitizeResource(raw: unknown): Resource | null {
  if (!isObject(raw)) return null;
  const brief = sanitizeBrief(raw.brief);
  const rid = id(raw.id, "");
  if (!brief || !rid) return null;
  return {
    id: rid,
    kind: brief.kind,
    title: str(raw.title, 160) || brief.title,
    courseName: str(raw.courseName, 120) || "Science 10",
    unitName: str(raw.unitName, 160) || "Force and Motion in Our World",
    outcomeIds: outcomeList(raw.outcomeIds),
    createdAt: str(raw.createdAt, 40),
    updatedAt: str(raw.updatedAt, 40),
    deliveries: (Array.isArray(raw.deliveries) ? raw.deliveries : []).map(sanitizeDelivery).filter((x): x is Delivery => x !== null).slice(0, 200),
    brief,
  };
}

export function sanitizeDraft(raw: unknown, resource: Resource): Draft | null {
  if (!isObject(raw)) return null;
  const approved = isObject(raw.approved)
    ? { at: str(raw.approved.at, 60), version: int(raw.approved.version, 1, 999, 1), title: str(raw.approved.title, 160), sections: sanitizeSections(raw.approved.sections) }
    : null;
  const alt = isObject(raw.pendingAlt) ? sanitizeItem(raw.pendingAlt.item, { fallbackId: "alt" }) : null;
  return {
    resourceId: resource.id,
    kind: resource.kind,
    title: str(raw.title, 160) || resource.title,
    courseName: resource.courseName,
    outcomeIds: outcomeList(raw.outcomeIds),
    sections: sanitizeSections(raw.sections),
    duration: raw.duration === null || raw.duration === undefined ? null : int(raw.duration, 1, 240, 30),
    draftedBy: oneOf(raw.draftedBy, ORIGINS, "teacher"),
    provider: str(raw.provider, 40) || null,
    version: int(raw.version, 1, 999, 1),
    status: oneOf(raw.status, ["draft", "approved"] as const, "draft"),
    approved,
    notices: (Array.isArray(raw.notices) ? raw.notices : []).map((n) => str(n, 400)).filter(Boolean).slice(0, 10),
    globals: isObject(raw.globals) ? { readingLevel: bool(raw.globals.readingLevel, false), indicatorsPending: bool(raw.globals.indicatorsPending, false) } : { readingLevel: false, indicatorsPending: false },
    pendingAlt: alt && isObject(raw.pendingAlt) && typeof raw.pendingAlt.targetId === "string" ? { targetId: raw.pendingAlt.targetId.slice(0, 48), item: alt } : null,
  };
}
