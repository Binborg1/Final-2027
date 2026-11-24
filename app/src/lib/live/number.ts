/**
 * A student's typed number, read strictly. No expressions (that's
 * lib/math/expr.ts, which is for keys only): "sqrt(50)", "1/2", "12 or 13" and
 * "1.2.3" are refused. Commas are refused too, so "1,5" can't be read as 15.
 *
 * Accepted: 13.3, +4, -4, .5, 5., 12 500 (spaces between groups of three),
 * 1.5e3, 1.5×10^3, 1.5 x 10^3, and a trailing unit equal to the key's unit
 * (spaces ignored, ²/³ read as ^2/^3, not case-sensitive): "13.3 min", "13.3min".
 */

export type NumberProblem = "empty" | "comma" | "format" | "unit" | "range";
export type NumberParse = { ok: true; value: number } | { ok: false; reason: NumberProblem };

const CORE = String.raw`([+-]?(?:\d{1,3}(?: \d{3})+|\d+)(?:\.\d*)?|[+-]?\.\d+)`;
const EXP = String.raw`((?:[eE][+-]?\d+)|(?:\s*[x×*·]\s*10\s*\^\s*[+-]?\d+))?`;
const SHAPE = new RegExp(`^${CORE}${EXP}\\s*(.*)$`);

/** Minus sign, figure dash, en dash and em dash, read as a minus. */
const DASHES = new RegExp(`[${[0x2212, 0x2012, 0x2013, 0x2014].map((c) => String.fromCharCode(c)).join("")}]`, "g");

const normUnit = (u: string) => u.replace(/²/g, "^2").replace(/³/g, "^3").normalize("NFKC").replace(/\s+/g, "").toLowerCase();

function tidy(text: string): string {
  return text
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .normalize("NFKC")
    .replace(DASHES, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseStudentNumber(text: string, unit = ""): NumberParse {
  const s = tidy(text);
  if (!s) return { ok: false, reason: "empty" };
  if (s.includes(",")) return { ok: false, reason: "comma" };
  const m = s.match(SHAPE);
  if (!m) return { ok: false, reason: "format" };
  const [, core, exp, restRaw] = m;
  const rest = normUnit(restRaw ?? "");
  if (rest) {
    const bare = rest.replace(/\^[23]/g, "");
    if (/\d|[=()]/.test(bare) || /^[+\-*/^.]/.test(bare)) return { ok: false, reason: "format" };
    if (!unit || rest !== normUnit(unit)) return { ok: false, reason: "unit" };
  }
  let value = Number(core.replace(/ /g, ""));
  if (exp) {
    const power = Number(exp.replace(/.*?([+-]?\d+)$/, "$1"));
    value *= 10 ** power;
  }
  if (!Number.isFinite(value) || Math.abs(value) >= 1e15) return { ok: false, reason: "range" };
  return { ok: true, value };
}

/** The hint a phone shows under a number box that can't be read. */
export function numberHint(reason: NumberProblem, unit = ""): string {
  switch (reason) {
    case "empty":
      return "";
    case "comma":
      return "Use a point for decimals, and no commas.";
    case "unit":
      return unit ? `Give the answer in ${unit}, or leave the unit out.` : "Leave the unit out.";
    case "range":
      return "That number is too large.";
    default:
      return "Type one number, like 12.5.";
  }
}
