import { codeOf } from "@/lib/curriculum/sources";
import type { Brief, QType, ResourceKind, Verb } from "@/lib/resources/types";

export type KindInfo = { kind: ResourceKind; label: string; group: "notes" | "assessment" | "classroom"; blurb: string; forStudents: boolean };

export const KINDS: KindInfo[] = [
  { kind: "notes", label: "Teaching notes", group: "notes", blurb: "Notes, summaries, worked examples, revision sheets", forStudents: true },
  { kind: "quiz", label: "Quiz", group: "assessment", blurb: "A short check, 10 to 25 marks", forStudents: true },
  { kind: "test", label: "Unit test", group: "assessment", blurb: "Mixed formats, about one class period", forStudents: true },
  { kind: "exam", label: "Exam", group: "assessment", blurb: "Several parts with a marking guide", forStudents: true },
  { kind: "lesson-plan", label: "Lesson plan", group: "classroom", blurb: "Timed phases, materials and adaptations", forStudents: false },
  { kind: "worksheet", label: "Worksheet", group: "classroom", blurb: "A worked example, then practice", forStudents: true },
  { kind: "homework", label: "Homework", group: "classroom", blurb: "Short practice to finish at home", forStudents: true },
  { kind: "presentation", label: "Presentation", group: "classroom", blurb: "Slide-by-slide outline with speaker notes", forStudents: true },
  { kind: "visualization", label: "Interactive graph", group: "classroom", blurb: "A distance–time graph to explore in class", forStudents: true },
];

export const kindInfo = (k: ResourceKind) => KINDS.find((x) => x.kind === k)!;

export const QUESTION_KINDS: ResourceKind[] = ["quiz", "test", "exam", "worksheet", "homework"];
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
  "sk-sci10-fm1": ["explore"],
  "sk-sci10-fm2": ["investigate", "represent"],
  "sk-sci10-fm3": ["investigate", "represent"],
  "sk-sci10-fm4": ["explore"],
};

const MIX: Record<"quiz" | "test" | "exam" | "worksheet" | "homework", [QType, number, number][]> = {
  quiz: [["mcq", 4, 1], ["tf", 2, 1], ["fill", 1, 1], ["match", 1, 3], ["calc", 3, 2], ["short", 1, 4], ["long", 0, 6]],
  test: [["mcq", 6, 1], ["tf", 4, 1], ["fill", 2, 1], ["match", 1, 3], ["calc", 4, 2], ["short", 2, 3], ["long", 0, 6]],
  exam: [["mcq", 6, 1], ["tf", 4, 1], ["fill", 2, 1], ["match", 1, 3], ["calc", 4, 3], ["short", 2, 4], ["long", 1, 6]],
  worksheet: [["mcq", 0, 1], ["tf", 0, 1], ["fill", 2, 1], ["match", 0, 3], ["calc", 4, 2], ["short", 1, 3], ["long", 0, 6]],
  homework: [["mcq", 3, 1], ["tf", 2, 1], ["fill", 0, 1], ["match", 0, 3], ["calc", 3, 2], ["short", 0, 3], ["long", 0, 6]],
};

const DURATION: Partial<Record<ResourceKind, number>> = { quiz: 30, test: 60, exam: 90, worksheet: 40, homework: 25 };

const TITLE: Record<ResourceKind, string> = {
  notes: "Teaching notes",
  quiz: "Quiz",
  test: "Unit test",
  exam: "Exam",
  "lesson-plan": "Lesson plan",
  worksheet: "Worksheet",
  homework: "Homework",
  presentation: "Presentation",
  visualization: "Interactive graph",
};

const TOPIC: Record<string, string> = {
  "sk-sci10-fm1": "Motion technologies",
  "sk-sci10-fm2": "Constant speed in a straight line",
  "sk-sci10-fm3": "Acceleration",
  "sk-sci10-fm4": "Force and motion",
};

export function suggestedTitle(kind: ResourceKind, outcomeIds: string[]) {
  const topic = outcomeIds.length > 1 ? "Force and Motion" : (TOPIC[outcomeIds[0]] ?? codeOf(outcomeIds[0] ?? "") ?? "Untitled");
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
    includeGraph: true,
    planMinutes: 60,
    adaptations: true,
    slides: 6,
    speakerNotes: true,
    material: null,
    reuseId: null,
    instructions: "",
  };
}
