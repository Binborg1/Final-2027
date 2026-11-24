import { closeEnough, evalCalc } from "@/lib/resources/calc";
import { parseStudentNumber } from "@/lib/live/number";
import { unitOf, writtenKeyNumber } from "@/lib/live/questions";
import type { LiveContent, LiveResponse } from "@/lib/live/types";

/**
 * Exact marking, done in code when an answer is saved: multiple choice, true or
 * false, and numbers. Short answers are marked later by Funza (mark-ai.ts).
 */

/** The values a number answer is compared with: the recomputed calculation and the key as written. */
export function keyNumbers(c: LiveContent): number[] {
  const out: number[] = [];
  const computed = c.answer.calc ? evalCalc(c.answer.calc) : null;
  if (computed !== null) out.push(computed);
  const written = writtenKeyNumber(c);
  if (written !== null && !out.some((v) => v === written)) out.push(written);
  return out;
}

export type ExactMark = { correct: boolean; marks: number };

/**
 * The mark for an exact type, or null when the question is a short answer or its
 * key can't be read (the teacher marks it then). A number that can't be read is
 * marked wrong; the phone shows the student why while they can still fix it.
 */
export function markExact(c: LiveContent, r: LiveResponse): ExactMark | null {
  const right = (ok: boolean): ExactMark => ({ correct: ok, marks: ok ? c.marks : 0 });
  if (c.type === "mcq") {
    if (!c.answer.correctId || !("choice" in r)) return null;
    return right(r.choice === c.answer.correctId);
  }
  if (c.type === "tf") {
    if (typeof c.answer.tf !== "boolean" || !("choice" in r)) return null;
    return right(r.choice === String(c.answer.tf));
  }
  if (c.type === "calc") {
    const keys = keyNumbers(c);
    if (keys.length === 0 || !("text" in r)) return null;
    const parsed = parseStudentNumber(r.text, unitOf(c));
    return right(parsed.ok && keys.some((k) => closeEnough(parsed.value, k)));
  }
  return null;
}

export type Verdict = "right" | "partly" | "wrong" | "unmarked";

export function verdict(marks: number | null, max: number): Verdict {
  if (marks === null) return "unmarked";
  if (marks >= max) return "right";
  return marks > 0 ? "partly" : "wrong";
}
