import { SchemaError } from "@/lib/ai/json";
import { emptySection, INSTRUCTIONS, questionSections, rubricFor } from "@/lib/resources/assemble";
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

export function validateResourceReply(b: Brief, reply: Record<string, unknown>): ValidatedDraft {
  const allowed = new Set(b.outcomeIds);
  assertOnlyAllowed(reply, allowed);
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
