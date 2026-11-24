import { answerOf } from "@/lib/resources/bank-rows";
import { firstNumber } from "@/lib/resources/calc";
import type { Item, QType, RubricLine } from "@/lib/resources/types";
import type { LiveContent, LiveKey, LiveResponse, LiveType } from "@/lib/live/types";

/**
 * Live questions: the snapshot kept for each question in a session, what a phone
 * may see of it, and how a phone's answer is read. A phone sees an allow-list of
 * fields (publicQuestion), never the key.
 */

export const LIVE_TYPES: readonly LiveType[] = ["mcq", "tf", "calc", "short"];
export const isLiveType = (t: unknown): t is LiveType => typeof t === "string" && (LIVE_TYPES as readonly string[]).includes(t);
export const LIVE_TYPE_LABEL: Record<LiveType, string> = { mcq: "Multiple choice", tf: "True or false", calc: "Number", short: "Short answer" };

/** Why a bank type can't go on phones yet. */
export const NOT_ON_PHONES: Partial<Record<QType, string>> = {
  fill: "Not on phones yet",
  match: "Not on phones yet",
  long: "Not on phones yet",
};

export const MAX_TEXT: Record<"calc" | "short", number> = { calc: 60, short: 1000 };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function readKey(raw: unknown): LiveKey {
  if (!isObj(raw)) return {};
  const key: LiveKey = {};
  if (typeof raw.correctId === "string" || raw.correctId === null) key.correctId = raw.correctId as string | null;
  if (typeof raw.tf === "boolean" || raw.tf === null) key.tf = raw.tf as boolean | null;
  if (typeof raw.answer === "string") key.answer = raw.answer.slice(0, 500);
  if (Array.isArray(raw.rubric)) {
    key.rubric = raw.rubric
      .filter(isObj)
      .map((r) => ({ text: str(r.text, 600), marks: typeof r.marks === "number" && Number.isFinite(r.marks) ? r.marks : 0 }))
      .filter((r) => r.text.trim());
  }
  if (typeof raw.solution === "string" && raw.solution.trim()) key.solution = raw.solution.slice(0, 2000);
  if (isObj(raw.calc) && typeof raw.calc.expr === "string" && isObj(raw.calc.vars)) {
    const vars: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw.calc.vars)) if (typeof v === "number" && Number.isFinite(v)) vars[k] = v;
    key.calc = { expr: raw.calc.expr.slice(0, 300), vars, unit: str(raw.calc.unit, 40), show: str(raw.calc.show, 300) };
  }
  return key;
}

function readOptions(raw: unknown): { id: string; text: string }[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw.filter(isObj).map((o) => ({ id: str(o.id, 8), text: str(o.text, 500) })).filter((o) => o.id && o.text.trim());
  return out.length ? out : null;
}

/** Reads a stored snapshot; null if it isn't a question a phone can answer. */
export function parseContent(raw: unknown): LiveContent | null {
  if (!isObj(raw) || !isLiveType(raw.type)) return null;
  const stem = str(raw.stem, 5000);
  if (!stem.trim()) return null;
  const marks = typeof raw.marks === "number" && Number.isFinite(raw.marks) ? Math.max(0, Math.min(100, Math.round(raw.marks))) : 1;
  return {
    type: raw.type,
    stem,
    options: raw.type === "mcq" ? readOptions(raw.options) : null,
    answer: readKey(raw.answer),
    marks,
    outcomeRef: typeof raw.outcomeRef === "string" ? raw.outcomeRef.slice(0, 200) : null,
  };
}

/** The snapshot of a bank row; null for types phones can't answer. */
export function contentFromBank(row: { type: string; stem: string; options: unknown; answer: unknown; marks: number; outcome_ref: string | null }): LiveContent | null {
  return parseContent({ type: row.type, stem: row.stem, options: row.options, answer: row.answer, marks: row.marks, outcomeRef: row.outcome_ref });
}

/** The snapshot of a draft question (from Funza or edited by the teacher). */
export function contentFromItem(item: Item): LiveContent | null {
  return parseContent({ type: item.type, stem: item.prompt, options: item.options, answer: answerOf(item), marks: item.marks, outcomeRef: item.outcomeIds[0] ?? null });
}

/** The unit a number answer is given in: the calculation's unit, else what follows the number in the key ("13.3 min" → "min"). */
export function unitOf(c: LiveContent): string {
  if (c.type !== "calc") return "";
  const fromCalc = c.answer.calc?.unit?.trim();
  if (fromCalc) return fromCalc;
  const key = (c.answer.answer ?? "").replace(/−/g, "-").trim();
  const m = key.match(/^[-+]?(?:\d[\d ,]*)?(?:\.\d+)?(?:\s*(?:[eE][-+]?\d+|[x×]\s*10\^[-+]?\d+))?\s*(.*)$/);
  const rest = (m?.[1] ?? "").trim();
  return rest && rest.length <= 16 && !/\d{2,}|[=(]/.test(rest) ? rest : "";
}

export type PublicQuestion = {
  id: string;
  n: number;
  type: LiveType;
  stem: string;
  options?: { id: string; text: string }[];
  marks: number;
  unit?: string;
};

/** What a phone may see of a question while answering: no key, no solution. */
export function publicQuestion(id: string, n: number, c: LiveContent): PublicQuestion {
  const q: PublicQuestion = { id, n, type: c.type, stem: c.stem, marks: c.marks };
  if (c.type === "mcq" && c.options) q.options = c.options.map((o) => ({ id: o.id, text: o.text }));
  const unit = unitOf(c);
  if (unit) q.unit = unit;
  return q;
}

/** Reads what a phone sent for a question; "empty" means the student cleared it. */
export function parseResponse(c: LiveContent, raw: unknown): LiveResponse | "empty" | null {
  if (!isObj(raw)) return null;
  if (c.type === "mcq") {
    if (typeof raw.choice !== "string") return null;
    return c.options?.some((o) => o.id === raw.choice) ? { choice: raw.choice } : null;
  }
  if (c.type === "tf") return raw.choice === "true" || raw.choice === "false" ? { choice: raw.choice } : null;
  if (typeof raw.text !== "string") return null;
  const text = raw.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (!text) return "empty";
  if (text.length > MAX_TEXT[c.type]) return null;
  return { text };
}

/** A response as the teacher reads it. */
export function displayResponse(c: LiveContent, r: LiveResponse | null): string {
  if (!r) return "";
  if ("text" in r) return r.text;
  if (c.type === "tf") return r.choice === "true" ? "True" : "False";
  return c.options?.find((o) => o.id === r.choice)?.text ?? "";
}

const rubricText = (lines: RubricLine[] | undefined) => (lines ?? []).map((r) => r.text).join("; ");

/** The correct answer as shown at Reveal and in results. */
export function displayKey(c: LiveContent): string {
  const k = c.answer;
  if (c.type === "mcq") return c.options?.find((o) => o.id === k.correctId)?.text ?? "";
  if (c.type === "tf") return k.tf === true ? "True" : k.tf === false ? "False" : "";
  if (c.type === "calc") return (k.answer ?? "").trim() || (k.calc?.show ?? "");
  return (k.solution ?? "").trim() || rubricText(k.rubric);
}

/** The key's number as written ("13.3 min" → 13.3). */
export const writtenKeyNumber = (c: LiveContent) => firstNumber(c.answer.answer ?? "");

/** A bank question as an editable draft question (the reverse of answerOf in bank-rows.ts). */
export function itemFromBank(row: { id: string; type: string; stem: string; options: unknown; answer: unknown; marks: number; outcome_ref: string | null }): Item {
  const a = isObj(row.answer) ? row.answer : {};
  const key = readKey(row.answer);
  const type = (["mcq", "tf", "fill", "match", "calc", "short", "long"] as QType[]).find((t) => t === row.type) ?? "short";
  const pairs = Array.isArray(a.pairs) ? a.pairs.filter(isObj).map((p) => ({ left: str(p.left, 300), right: str(p.right, 300) })) : [];
  return {
    id: row.id,
    type,
    prompt: row.stem,
    options: type === "mcq" ? (readOptions(row.options) ?? []) : [],
    correctId: key.correctId ?? null,
    tf: key.tf ?? null,
    answer: key.answer ?? "",
    pairs,
    calc: key.calc ?? null,
    solution: key.solution ?? "",
    rubric: key.rubric ?? [],
    marks: row.marks,
    difficulty: "grade",
    outcomeIds: row.outcome_ref ? [row.outcome_ref] : [],
    verbs: [],
    origin: "bank",
    reviewedFp: null,
  };
}
