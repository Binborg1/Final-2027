import type { Results } from "@/lib/live/results";

/**
 * The results as a CSV file (FR-15): one row per student with their mark on each
 * question, then one row per question. Opens in Excel and Google Sheets: UTF-8
 * with a byte-order mark, CRLF line ends. A text cell that starts like a formula
 * (= + - @, tab or carriage return) gets a leading apostrophe, so a student's name
 * or answer can't run as a formula.
 */

/** A byte-order mark, so Excel reads the file as UTF-8. */
const BOM = String.fromCharCode(0xfeff);
const FORMULA = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const text = FORMULA.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const row = (cells: (string | number | null | undefined)[]) => cells.map(csvCell).join(",");

export function resultsCsv(r: Results, marksByStudent: Map<string, Map<string, number | null>>): string {
  const lines: string[] = [];
  const qs = r.questions;
  lines.push(row(["Student", "Student number", "Score", "Out of", "Percent", ...qs.map((q) => `Q${q.n} (${q.marks})`)]));
  for (const s of r.students) {
    const marks = marksByStudent.get(s.id) ?? new Map();
    lines.push(row([s.name, s.studentNo ?? "", s.score, s.max, s.percent, ...qs.map((q) => (marks.has(q.id) ? (marks.get(q.id) ?? "") : ""))]));
  }
  lines.push("");
  lines.push(row(["Question", "Type", "Marks", "Answered", "Right", "Percent right", "Correct answer", "Most common wrong answer"]));
  for (const q of qs) {
    lines.push(row([`Q${q.n}. ${q.stem}`, q.type, q.marks, q.answered, q.right, q.percentRight, q.key, q.commonWrong ? `${q.commonWrong.text} (${q.commonWrong.count})` : ""]));
  }
  return BOM + lines.join("\r\n") + "\r\n";
}

/** "Motion check" on 2026-11-23 → "funza-motion-check-2026-11-23.csv". */
export function csvFilename(title: string, date: Date): string {
  const slug = title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `funza-${slug || "live"}-${date.toISOString().slice(0, 10)}.csv`;
}
