import type { ExtractedDoc } from "@/lib/pdf/extract";

export type DocKind = "notes" | "questions";
export type Confidence = "high" | "medium" | "low";
export type Classification = { kind: DocKind; confidence: Confidence; score: number; reasons: string[] };

const TITLE_WORDS =
  /\b(assignment|homework|problem\s*set|tutorial|exercise|exercises|worksheet|quiz|exam|examination|midterm|final\s+exam|practice\s+(problems|questions)|questions|past\s+paper|test\s+\d|revision\s+questions)\b/i;
const NUMBERED =
  /^(q(uestion)?\s*\d{1,3}[a-z]?[.):\s]|\d{1,3}\s*[.)]\s+\S|\(\d{1,3}\)\s+\S|[a-h][.)]\s+\S|\([a-h]\)\s+\S|\((i|ii|iii|iv|v|vi)\)\s+\S)/i;
const LEADING_LABEL = /^(q(uestion)?\s*\d+[a-z]?[.):]?\s*|\d+\s*[.)]\s*|\([a-z0-9]+\)\s*|[a-h][.)]\s*)/i;
const IMPERATIVE =
  /^(calculate|compute|determine|explain|describe|define|show|prove|find|derive|solve|write|list|compare|contrast|draw|evaluate|estimate|sketch|state|discuss|identify|outline|justify|what|why|how|which|when|where|consider|suppose|given|assume|let|if|name|briefly)\b/i;
const MARKS = /[([]\s*\d+\s*(marks?|pts?|points?)\s*[)\]]|\b\d+\s*marks?\b/i;

/**
 * Decides whether a PDF is lecture-style notes or a set of questions
 * (assignment, tutorial sheet, past exam). Rule-based; the student can override.
 */
export function classifyDocument(doc: ExtractedDoc): Classification {
  const lines = doc.pages.flatMap((p) => p.lines.map((l) => l.text.trim())).filter((t) => t.length > 1);
  if (lines.length === 0) return { kind: "notes", confidence: "low", score: 0, reasons: ["No text found"] };

  const reasons: string[] = [];
  let score = 0;
  const head = `${doc.fileName} ${lines.slice(0, 12).join(" ")}`;
  if (TITLE_WORDS.test(head)) {
    score += 3;
    reasons.push("The file name or title mentions questions, exercises, an assignment or an exam");
  }

  const n = lines.length;
  const numbered = lines.filter((l) => NUMBERED.test(l)).length;
  const imperative = lines.filter((l) => IMPERATIVE.test(l.replace(LEADING_LABEL, ""))).length;
  const questionMarks = lines.filter((l) => l.includes("?")).length;
  const marks = lines.filter((l) => MARKS.test(l)).length;
  const longLines = lines.filter((l) => l.length > 120).length;

  if (numbered / n > 0.15) {
    score += 2;
    reasons.push(`${Math.round((numbered / n) * 100)}% of lines start like a numbered question or part`);
  }
  if (imperative / n > 0.12) {
    score += 2;
    reasons.push("Many lines start with an instruction such as calculate, explain or show");
  }
  if (questionMarks / n > 0.08) {
    score += 2;
    reasons.push(`${questionMarks} lines contain a question mark`);
  }
  if (marks >= 2) {
    score += 2;
    reasons.push(`${marks} mark allocations found`);
  }
  if (longLines / n > 0.3 && questionMarks / n < 0.05) {
    score -= 2;
    reasons.push("Mostly long explanatory sentences, which reads like notes");
  }

  const kind: DocKind = score >= 4 ? "questions" : "notes";
  const confidence: Confidence = score >= 6 || score <= 0 ? "high" : score === 3 ? "low" : "medium";
  return { kind, confidence, score, reasons };
}
