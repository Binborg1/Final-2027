import { findOutcome } from "@/lib/curriculum/catalog";
import { codeOf } from "@/lib/curriculum/sources";
import type { Brief, QType, ResourceKind, Verb } from "@/lib/resources/types";

export type KindInfo = { kind: ResourceKind; label: string; group: "notes" | "assessment" | "classroom"; blurb: string; forStudents: boolean };

export const KINDS: KindInfo[] = [
  { kind: "notes", label: "Teaching notes", group: "notes", blurb: "Notes, summaries, worked examples, revision sheets", forStudents: true },
  { kind: "quiz", label: "Quiz", group: "assessment", blurb: "A short check, 10 to 25 marks", forStudents: true },
  { kind: "test", label: "Unit test", group: "assessment", blurb: "Mixed formats, about one class period", forStudents: true },
  { kind: "exam", label: "Exam", group: "assessment", blurb: "Several parts with a marking guide", forStudents: true },
  { kind: "presentation", label: "Slides", group: "classroom", blurb: "Slide-by-slide outline with speaker notes", forStudents: true },
];

export const kindInfo = (k: ResourceKind) => KINDS.find((x) => x.kind === k)!;

export const QUESTION_KINDS: ResourceKind[] = ["quiz", "test", "exam"];
export const isQuestionKind = (k: ResourceKind) => QUESTION_KINDS.includes(k);

export const QTYPE_LABEL: Record<QType, string> = {
  mcq: "Multiple choice",
  tf: "True or false",
  fill: "Fill in the blank",
  match: "Matching",
  calc: "Calculation",
  short: "Short answer",
  long: "Long answer",
};
export const QTYPE_ORDER: QType[] = ["mcq", "tf", "fill", "match", "calc", "short", "long"];

/** Rough minutes per question for the blueprint's time estimate (a stated rule of thumb). */
export const MINUTES_PER: Record<QType, number> = { mcq: 1, tf: 0.5, fill: 1, match: 2, calc: 3, short: 4, long: 10 };

export const NOTES_STYLES = [
  { id: "comprehensive", label: "Comprehensive notes", blurb: "Full explanations with examples" },
  { id: "summary", label: "Concise summary", blurb: "One or two pages of essentials" },
  { id: "worked", label: "Worked examples", blurb: "Step-by-step solutions to typical problems" },
  { id: "simplified", label: "Simplified explanation", blurb: "Plain language, shorter sentences" },
  { id: "revision", label: "Revision sheet", blurb: "Key facts, formulas and quick checks" },
] as const;

/** Action verbs read from each outcome statement's opening words. Shown as suggestions, never as a score. */
export const OUTCOME_VERBS: Record<string, Verb[]> = {
  "sk-63-110470": ["explore"],
  "sk-63-110477": ["investigate", "represent"],
  "sk-63-110487": ["investigate", "represent"],
  "sk-63-110496": ["explore"],
};

const MIX: Record<"quiz" | "test" | "exam", [QType, number, number][]> = {
  quiz: [["mcq", 4, 1], ["tf", 2, 1], ["fill", 1, 1], ["match", 1, 3], ["calc", 3, 2], ["short", 1, 4], ["long", 0, 6]],
  test: [["mcq", 6, 1], ["tf", 4, 1], ["fill", 2, 1], ["match", 1, 3], ["calc", 4, 2], ["short", 2, 3], ["long", 0, 6]],
  exam: [["mcq", 6, 1], ["tf", 4, 1], ["fill", 2, 1], ["match", 1, 3], ["calc", 4, 3], ["short", 2, 4], ["long", 1, 6]],
};

const DURATION: Partial<Record<ResourceKind, number>> = { quiz: 30, test: 60, exam: 90 };

const TITLE: Record<ResourceKind, string> = {
  notes: "Teaching notes",
  quiz: "Quiz",
  test: "Unit test",
  exam: "Exam",
  presentation: "Slides",
};

const TOPIC: Record<string, string> = {
  "sk-63-110470": "Motion technologies",
  "sk-63-110477": "Constant speed in a straight line",
  "sk-63-110487": "Acceleration",
  "sk-63-110496": "Force and motion",
};

/** A topic for the title: Funza's short names for FM1 to FM4, else the unit (several outcomes) or the code. */
export function suggestedTitle(kind: ResourceKind, outcomeIds: string[]) {
  const found = outcomeIds.map((id) => findOutcome(id));
  const units = new Set(found.map((f) => f?.unit.id));
  const unitName = found[0]?.unit.name;
  const topic =
    outcomeIds.length > 1
      ? units.size === 1 && unitName && unitName !== "Outcomes"
        ? unitName === "Force and Motion in Our World"
          ? "Force and Motion"
          : unitName
        : (found[0]?.course.name ?? "Several outcomes")
      : (TOPIC[outcomeIds[0]] ?? codeOf(outcomeIds[0] ?? ""));
  return `${topic || "Untitled"} · ${TITLE[kind]}`;
}

export function defaultBrief(kind: ResourceKind = "quiz", outcomeIds: string[] = []): Brief {
  const mixKey = kind in MIX ? (kind as keyof typeof MIX) : "quiz";
  return {
    kind,
    title: suggestedTitle(kind, outcomeIds),
    outcomeIds,
    mix: MIX[mixKey].map(([type, count, marks]) => ({ type, count, marks })),
    duration: DURATION[kind] ?? 30,
    difficulty: "balanced",
    ordering: "by-type",
    answerKey: true,
    workedSolutions: true,
    rubric: true,
    notesStyle: "comprehensive",
    keyTerms: true,
    checkQuestions: true,
    slides: 6,
    speakerNotes: true,
    material: null,
    reuseId: null,
    instructions: "",
    courseId: null,
    chapterIds: [],
  };
}
