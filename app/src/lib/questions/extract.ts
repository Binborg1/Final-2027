import type { ExtractedDoc } from "@/lib/pdf/extract";
import type { QuestionItem, QuestionPart } from "@/lib/types";

const Q_WORD = /^question\s+(\d{1,3})\s*[.:)-]?\s*(.*)$/i;
const Q_START = /^(?:q\s*)?(\d{1,3})[.):]\s+(.*)$/i;
const PART = /^\(?([a-h]|i{1,3}|iv|vi{0,3}|ix|x)\)[.:]?\s+(.*)$/i;
const ANSWER = /^(answer|solution|ans|soln)\s*[:.\-–]\s*(.*)$/i;
const MAX_QUESTIONS = 80;

/**
 * Splits a question PDF into numbered questions with lettered parts.
 * Lines after "Answer:" or "Solution:" are kept as the PDF's own answer.
 */
export function extractQuestions(doc: ExtractedDoc): QuestionItem[] {
  const items: QuestionItem[] = [];
  let current: QuestionItem | null = null;
  let part: QuestionPart | null = null;
  let inAnswer = false;

  for (const page of doc.pages) {
    for (const line of page.lines) {
      const t = line.text.trim();
      if (!t) continue;

      const q = t.match(Q_WORD) ?? t.match(Q_START);
      if (q && (!current || q[1] !== current.number || t.match(Q_WORD))) {
        current = {
          id: `q${q[1]}-${items.length + 1}`,
          number: q[1],
          label: `Question ${q[1]}`,
          text: q[2].trim(),
          parts: [],
          page: page.page,
        };
        items.push(current);
        part = null;
        inAnswer = false;
        continue;
      }
      if (!current) continue; // preamble before the first question

      const a = t.match(ANSWER);
      if (a) {
        inAnswer = true;
        current.providedAnswer = a[2].trim();
        continue;
      }
      if (inAnswer) {
        current.providedAnswer = join(current.providedAnswer ?? "", t);
        continue;
      }
      const p = t.match(PART);
      if (p) {
        part = { label: p[1].toLowerCase(), text: p[2].trim() };
        current.parts.push(part);
        continue;
      }
      if (part) part.text = join(part.text, t);
      else current.text = join(current.text, t);
    }
  }

  for (const q of items) {
    const all = `${q.text} ${q.parts.map((p) => p.text).join(" ")}`;
    const m = all.match(/(\d+)\s*marks?\b/i);
    if (m) q.marks = `${m[1]} marks`;
    if (q.providedAnswer !== undefined && q.providedAnswer.trim() === "") delete q.providedAnswer;
  }

  return items
    .filter((q) => q.text.length + q.parts.reduce((n, p) => n + p.text.length, 0) >= 15)
    .slice(0, MAX_QUESTIONS);
}

function join(a: string, b: string) {
  if (!a) return b;
  if (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + b;
  return `${a} ${b}`;
}

export function questionFullText(q: QuestionItem) {
  return [q.text, ...q.parts.map((p) => `(${p.label}) ${p.text}`)].join(" ");
}
