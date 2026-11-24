import { SchemaError } from "@/lib/ai/json";
import { emptySection, INSTRUCTIONS, layoutSections, questionSections, rubricFor } from "@/lib/resources/assemble";
import { isQuestionKind, QTYPE_LABEL } from "@/lib/resources/kinds";
import { isObject, sanitizeItem, sanitizeSection } from "@/lib/resources/sanitize";
import type { Brief, Item, Section } from "@/lib/resources/types";

/**
 * Turns a model reply into draft sections. Two rules come from the curriculum
 * design: a reply that cites any outcome id Funza did not supply is rejected
 * outright, and malformed items are dropped and reported, never repaired by guessing.
 */

export type ValidatedDraft = { sections: Section[]; notices: string[] };

function assertOnlyAllowed(raw: unknown, allowed: ReadonlySet<string>) {
  const seen: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (isObject(v)) {
      for (const [k, val] of Object.entries(v)) {
        if (k === "outcomeIds" && Array.isArray(val)) val.forEach((x) => seen.push(String(x)));
        else walk(val);
      }
    }
  };
  walk(raw);
  const bad = seen.filter((x) => !allowed.has(x));
  if (bad.length > 0) throw new SchemaError(`The reply cited an outcome Funza did not supply (${bad[0].slice(0, 40)}), so the whole reply was rejected.`);
}

function itemProblem(i: Item): string | null {
  if (!i.prompt) return "no question text";
  if (i.type === "mcq" && (i.options.filter((o) => o.text).length < 2 || !i.correctId)) return "no usable options";
  if (i.type === "tf" && i.tf === null) return "no true or false answer";
  if (i.type === "match" && i.pairs.filter((p) => p.left && p.right).length < 2) return "fewer than two pairs";
  if ((i.type === "fill" || i.type === "calc") && !i.answer) return "no answer";
  return null;
}

/**
 * A reply for a template's layout: for each section, up to its count of each type,
 * with the marks the template sets. Items the model put in no section (or a wrong
 * one) fill the gaps of their type, in order, with a notice.
 */
function validateLayoutReply(b: Brief, reply: Record<string, unknown>, layout: NonNullable<Brief["layout"]>): ValidatedDraft {
  const allowed = new Set(b.outcomeIds);
  const notices: string[] = [];
  const defaultOutcome = b.outcomeIds.length === 1 ? b.outcomeIds : null;
  const raw = (Array.isArray(reply.items) ? reply.items : []).map((x, n) => ({ x, n })).filter((r): r is { x: Record<string, unknown>; n: number } => isObject(r.x));
  const used = new Set<number>();
  let moved = 0;
  const take = (candidates: typeof raw, row: { type: Item["type"]; count: number; marks: number }, k: number, into: Item[], have: () => number) => {
    let dropped = 0;
    for (const { x, n } of candidates) {
      if (have() >= row.count) break;
      if (used.has(n)) continue;
      used.add(n);
      const id = `ai-t${k + 1}-${row.type}-${n + 1}`;
      const it = sanitizeItem(x, { allowedOutcomes: allowed, fallbackId: id, origin: "ai" });
      const fixed = it ? { ...it, id, reviewedFp: null, outcomeIds: it.outcomeIds.length === 0 && defaultOutcome ? defaultOutcome : it.outcomeIds } : null;
      if (!fixed || itemProblem(fixed) || fixed.outcomeIds.length === 0) {
        dropped++;
        continue;
      }
      into.push({ ...fixed, marks: row.marks, rubric: fixed.type === "short" || fixed.type === "long" ? rubricFor(fixed.rubric.map((r) => r.text), row.marks) : [] });
    }
    return dropped;
  };
  const groups: Item[][] = layout.map(() => []);
  const drops: number[][] = layout.map((s) => s.rows.map(() => 0));
  // First pass: items the model placed in this section.
  layout.forEach((s, k) =>
    s.rows.forEach((row, j) => {
      const have = () => groups[k].filter((i) => i.type === row.type).length;
      drops[k][j] += take(raw.filter((r) => r.x.type === row.type && Number(r.x.section) === k + 1), row, k, groups[k], have);
    }),
  );
  // Second pass: unplaced or misplaced items fill what is still missing.
  layout.forEach((s, k) =>
    s.rows.forEach((row, j) => {
      const have = () => groups[k].filter((i) => i.type === row.type).length;
      const before = have();
      drops[k][j] += take(raw.filter((r) => r.x.type === row.type), row, k, groups[k], have);
      moved += have() - before;
      const got = have();
      if (got < row.count)
        notices.push(`${s.title}: drafted ${got} of ${row.count} ${QTYPE_LABEL[row.type].toLowerCase()} question${row.count === 1 ? "" : "s"}.${drops[k][j] > 0 ? ` ${drops[k][j]} failed validation and ${drops[k][j] === 1 ? "was" : "were"} dropped.` : " The reply had no more."} Add the rest yourself.`);
    }),
  );
  if (moved > 0) notices.push(`${moved} question${moved === 1 ? " was" : "s were"} placed in a section by type, because the reply didn’t say which section ${moved === 1 ? "it" : "they"} belonged to.`);
  if (groups.every((g) => g.length === 0)) throw new SchemaError("The reply had no usable questions.");
  return { sections: layoutSections(b, groups).map((s) => ({ ...s, origin: "ai" })), notices };
}

export function validateResourceReply(b: Brief, reply: Record<string, unknown>): ValidatedDraft {
  const allowed = new Set(b.outcomeIds);
  assertOnlyAllowed(reply, allowed);
  if (isQuestionKind(b.kind) && b.layout && b.layout.length > 0) return validateLayoutReply(b, reply, b.layout);
  const notices: string[] = [];
  const defaultOutcome = b.outcomeIds.length === 1 ? b.outcomeIds : null;
  const withOutcome = (it: Item) => (it.outcomeIds.length === 0 && defaultOutcome ? { ...it, outcomeIds: defaultOutcome } : it);

  if (isQuestionKind(b.kind)) {
    const raw = Array.isArray(reply.items) ? reply.items : [];
    const items: Item[] = [];
    for (const row of b.mix.filter((r) => r.count > 0)) {
      const candidates = raw.filter((x) => isObject(x) && x.type === row.type);
      let dropped = 0;
      for (const [n, c] of candidates.entries()) {
        if (items.filter((i) => i.type === row.type).length >= row.count) break;
        const it = sanitizeItem(c, { allowedOutcomes: allowed, fallbackId: `ai-${row.type}-${n + 1}`, origin: "ai" });
        const fixed = it ? withOutcome({ ...it, id: `ai-${row.type}-${n + 1}`, reviewedFp: null }) : null;
        if (!fixed || itemProblem(fixed) || fixed.outcomeIds.length === 0) {
          dropped++;
          continue;
        }
        const rubricLines = fixed.rubric.map((r) => r.text);
        items.push({ ...fixed, marks: row.marks, rubric: fixed.type === "short" || fixed.type === "long" ? rubricFor(rubricLines, row.marks) : [] });
      }
      const got = items.filter((i) => i.type === row.type).length;
      if (got < row.count)
        notices.push(`Drafted ${got} of ${row.count} ${QTYPE_LABEL[row.type].toLowerCase()} question${row.count === 1 ? "" : "s"}.${dropped > 0 ? ` ${dropped} failed validation and ${dropped === 1 ? "was" : "were"} dropped.` : " The reply had no more."} Add the rest yourself.`);
    }
    if (items.length === 0) throw new SchemaError("The reply had no usable questions.");
    const sections: Section[] = questionSections(b, items).map((s) => ({ ...s, origin: "ai" }));
    return { sections, notices };
  }

  const rawSections = Array.isArray(reply.sections) ? reply.sections : [];
  const sections: Section[] = [];
  rawSections.slice(0, 30).forEach((s, i) => {
    if (!isObject(s)) return;
    const sec = sanitizeSection({ ...s, kind: "text", id: `s-ai-${i + 1}` }, { allowedOutcomes: allowed, fallbackId: `s-ai-${i + 1}`, origin: "ai" });
    if (!sec || !sec.title || !sec.body) return;
    sections.push({ ...sec, outcomeIds: sec.outcomeIds.length ? sec.outcomeIds : (defaultOutcome ?? []) });
  });
  if (sections.length === 0) throw new SchemaError("The reply had no usable sections.");
  if (b.kind === "notes" && b.checkQuestions && Array.isArray(reply.items)) {
    const items = reply.items
      .map((x, n) => sanitizeItem(x, { allowedOutcomes: allowed, fallbackId: `ai-check-${n + 1}`, origin: "ai" }))
      .filter((x): x is Item => x !== null)
      .map((it, n) => withOutcome({ ...it, id: `ai-check-${n + 1}`, marks: 1, reviewedFp: null }))
      .filter((it) => it.type === "mcq" && !itemProblem(it) && it.outcomeIds.length > 0)
      .slice(0, 6);
    if (items.length > 0) sections.push(emptySection({ id: "s-check", kind: "questions", title: "Check your understanding", body: INSTRUCTIONS.mcq, items, outcomeIds: b.outcomeIds, origin: "ai" }));
  }
  return { sections, notices };
}

export function validateItemReply(b: Brief, reply: Record<string, unknown>, type: Item["type"], marks: number): Item {
  const allowed = new Set(b.outcomeIds);
  assertOnlyAllowed(reply, allowed);
  const it = sanitizeItem(reply.item, { allowedOutcomes: allowed, fallbackId: "ai-alt", origin: "ai" });
  if (!it || it.type !== type) throw new SchemaError("The reply was not a question of the requested type.");
  const problem = itemProblem(it);
  if (problem) throw new SchemaError(`The new question has ${problem}.`);
  if (it.outcomeIds.length === 0) throw new SchemaError("The new question cites no outcome.");
  return { ...it, marks, rubric: it.type === "short" || it.type === "long" ? rubricFor(it.rubric.map((r) => r.text), marks) : [], reviewedFp: null };
}
