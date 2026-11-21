import { codeOf, placeOf } from "@/lib/curriculum/sources";
import { BANK, NOTES } from "@/lib/resources/bank";
import { isQuestionKind, kindInfo, MINUTES_PER, NOTES_STYLES, QTYPE_LABEL, QTYPE_ORDER } from "@/lib/resources/kinds";
import type { Brief, ResourceKind } from "@/lib/resources/types";

/**
 * The blueprint: what a resource will contain, computed from the brief by code
 * before any AI call. It is the preview the teacher sees, the contract the AI
 * must fill, and what the review compares the draft against.
 */

export const PRESETS = {
  balanced: { label: "Balanced", split: [30, 50, 20] },
  review: { label: "Review", split: [50, 40, 10] },
  challenge: { label: "Challenge", split: [20, 45, 35] },
} as const;

export type Blueprint = {
  sentence: string;
  parts: { title: string; detail: string; marks: number | null }[];
  questions: number;
  marks: number;
  estMinutes: number | null;
  spec: { outcomeId: string; code: string; cells: [number, number, number]; total: number }[];
  includes: string[];
  warnings: string[];
};

/** Outcomes the starter bank has no content for, for this kind of resource. */
export function bankGaps(outcomeIds: string[], kind: ResourceKind): string[] {
  const covered = (id: string) =>
    kind === "notes" || kind === "presentation" ? !!NOTES[id] : BANK.some((p) => p.outcomeIds.includes(id));
  return outcomeIds.filter((id) => !covered(id));
}

export function blueprintOf(b: Brief): Blueprint {
  const codes = b.outcomeIds.map(codeOf);
  const codeText = codes.length === 0 ? "no outcome yet" : codes.join(" and ");
  const courseText = placeOf(b.outcomeIds).courseName || "your course";
  const info = kindInfo(b.kind);
  const includes: string[] = [];
  const warnings: string[] = [];
  if (b.outcomeIds.length === 0) warnings.push("Choose at least one curriculum outcome.");
  if (b.material) includes.push(`Uses your file “${b.material.name}” as ${b.material.use === "source" ? "the source" : "ideas"}`);

  if (isQuestionKind(b.kind)) {
    const rows = b.mix.filter((r) => r.count > 0);
    const questions = rows.reduce((n, r) => n + r.count, 0);
    const marks = rows.reduce((n, r) => n + r.count * r.marks, 0);
    const est = Math.round(rows.reduce((n, r) => n + r.count * MINUTES_PER[r.type], 0));
    const split = PRESETS[b.difficulty].split;
    const per = b.outcomeIds.length > 0 ? marks / b.outcomeIds.length : 0;
    const spec = b.outcomeIds.map((id) => {
      const cells = split.map((s) => Math.round((per * s) / 100)) as [number, number, number];
      return { outcomeId: id, code: codeOf(id), cells, total: cells[0] + cells[1] + cells[2] };
    });
    if (b.answerKey) includes.push("Answer key, kept for you only");
    if (b.workedSolutions && rows.some((r) => r.type === "calc")) includes.push("Worked solutions for calculations");
    if (b.rubric && rows.some((r) => r.type === "short" || r.type === "long")) includes.push("Marking rubric for written answers");
    if (est > b.duration) warnings.push(`About ${est} minutes of work for a ${b.duration}-minute sitting. Consider fewer questions.`);
    if (questions === 0) warnings.push("Add at least one question.");
    return {
      sentence: `A ${b.duration}-minute ${info.label.toLowerCase()} for ${courseText} on ${codeText}: ${questions} questions, ${marks} marks.`,
      parts: QTYPE_ORDER.flatMap((t) => rows.filter((r) => r.type === t)).map((r, i) => ({
        title: `Part ${String.fromCharCode(65 + i)} · ${QTYPE_LABEL[r.type]}`,
        detail: `${r.count} × ${r.marks} mark${r.marks === 1 ? "" : "s"}`,
        marks: r.count * r.marks,
      })),
      questions,
      marks,
      estMinutes: est,
      spec,
      includes,
      warnings,
    };
  }

  const style = NOTES_STYLES.find((s) => s.id === b.notesStyle)!;
  const sections = b.outcomeIds.map((id) => ({ title: codeOf(id), detail: NOTES[id] ? NOTES[id].map((n) => n.title).join(" · ") : "Sections written for this outcome", marks: null }));
  if (b.kind === "presentation") {
    if (b.speakerNotes) includes.push("Speaker notes on every slide");
    return {
      sentence: `A ${b.slides}-slide outline for ${courseText} on ${codeText}.`,
      parts: [{ title: "Slides", detail: `${b.slides} slides`, marks: null }, ...sections],
      questions: 0,
      marks: 0,
      estMinutes: null,
      spec: [],
      includes,
      warnings,
    };
  }
  if (b.keyTerms) includes.push("Key terms");
  if (b.checkQuestions) includes.push("Check-your-understanding questions with answers");
  return {
    sentence: `${style.label} for ${courseText} on ${codeText}.`,
    parts: sections,
    questions: b.checkQuestions ? b.outcomeIds.length : 0,
    marks: 0,
    estMinutes: null,
    spec: [],
    includes,
    warnings,
  };
}
