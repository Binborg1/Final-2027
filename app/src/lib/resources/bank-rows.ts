import type { Draft, Item } from "@/lib/resources/types";

/**
 * Approving a version copies its questions into the chapter's bank (FR-27). This
 * turns the version's question parts into rows for approve_version() in the
 * database. Pure: the server passes its SHA-256 function in.
 *
 * The fingerprint covers the same fields as the review fingerprint (itemFp in
 * checks.ts), so changing only the marks keeps the same bank question.
 */

export type BankChapter = { id: string; outcomeRefs: string[] };
export type BankRow = {
  position: number;
  chapter_id: string;
  type: Item["type"];
  stem: string;
  options: { id: string; text: string }[] | null;
  answer: Record<string, unknown>;
  marks: number;
  outcome_ref: string | null;
  fingerprint: string;
};

/** The answer key and worked solution, by question type. It never reaches a phone before Reveal. */
export function answerOf(item: Item): Record<string, unknown> {
  const key: Record<string, unknown> =
    item.type === "mcq" ? { correctId: item.correctId } : item.type === "tf" ? { tf: item.tf } : item.type === "match" ? { pairs: item.pairs } : item.type === "short" || item.type === "long" ? { rubric: item.rubric } : { answer: item.answer };
  if (item.solution) key.solution = item.solution;
  if (item.calc) key.calc = item.calc;
  return key;
}

export function canonicalOf(item: Item): string {
  return JSON.stringify([item.type, item.prompt, item.options, item.correctId, item.tf, item.answer, item.pairs, item.calc, item.solution, item.rubric, item.outcomeIds]);
}

/** The chapter whose outcomes include the question's first outcome, else the first chapter. */
function chapterFor(item: Item, chapters: BankChapter[]): string {
  const outcome = item.outcomeIds[0];
  return (outcome && chapters.find((c) => c.outcomeRefs.includes(outcome))?.id) || chapters[0].id;
}

export function bankRowsFor(draft: Pick<Draft, "sections">, chapters: BankChapter[], hash: (text: string) => string): BankRow[] {
  if (chapters.length === 0) return [];
  const rows: BankRow[] = [];
  for (const section of draft.sections) {
    if (section.kind !== "questions") continue;
    for (const item of section.items) {
      if (!item.prompt.trim()) continue;
      rows.push({
        position: rows.length + 1,
        chapter_id: chapterFor(item, chapters),
        type: item.type,
        stem: item.prompt.slice(0, 5000),
        options: item.type === "mcq" ? item.options : null,
        answer: answerOf(item),
        marks: Math.max(0, Math.min(100, Math.round(item.marks))),
        outcome_ref: item.outcomeIds[0] ?? null,
        fingerprint: hash(canonicalOf(item)),
      });
    }
  }
  return rows;
}
