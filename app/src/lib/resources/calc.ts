import { compileExpr } from "@/lib/math/expr";
import type { Calc } from "@/lib/resources/types";

/**
 * Numbers behind answer keys. Kept apart from checks.ts so the live answer route
 * can mark a number without loading the curriculum catalog.
 */

/** Recomputes a calculation's expression from its variables; null if it can't be computed. */
export function evalCalc(c: Calc): number | null {
  try {
    const v = compileExpr(c.expr, Object.keys(c.vars))(c.vars);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** The first number in a key written by Funza or the teacher, such as "13.3 min". Too lenient for student input. */
export const firstNumber = (text: string): number | null => {
  const m = text.replace(/−/g, "-").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/** Within 0.5% of the expected value, or 0.01, whichever is larger (keys are rounded for display). */
export const closeEnough = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.005 * Math.abs(b), 0.01);
